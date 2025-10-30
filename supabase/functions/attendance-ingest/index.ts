// =====================================================
// Attendance Ingest Edge Function
// Single endpoint for all attendance machines
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

// =====================================================
// TYPES
// =====================================================

interface IngestPayload {
  device_id?: string       // alias for device_serial
  device_serial?: string   // unique device identifier
  employee_id?: string     // alias for pin
  pin?: string             // device PIN/card ID
  type?: 'clock-in' | 'clock-out'
  timestamp?: string       // ISO8601 from machine
  event_id?: string        // custom dedupe (optional)
}

interface Device {
  id: string
  device_serial: string
  tenant_id: string
  name: string | null
  secret: string | null
  active: boolean
}

interface IngestResponse {
  success: boolean
  stored: boolean
  reason?: string
  error?: string
}

// =====================================================
// HELPERS
// =====================================================

function sha256(data: string): string {
  const encoder = new TextEncoder()
  const hash = crypto.subtle.digest('SHA-256', encoder.encode(data))
  return hash.then(h => Array.from(new Uint8Array(h))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(''))
}

async function computeDedupeKey(
  serial: string,
  pin: string,
  ts: Date,
  type: string | null
): Promise<string> {
  const data = `${serial}|${pin}|${ts.toISOString()}|${type || ''}`
  return await sha256(data)
}

function verifyHmac(secret: string, body: string, signature: string): boolean {
  try {
    const hmac = createHmac('sha256', secret)
    hmac.update(body)
    const computed = hmac.digest('hex')
    return computed === signature
  } catch (e) {
    console.error('HMAC verification error:', e)
    return false
  }
}

function jsonResponse(data: IngestResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
    },
  })
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
      },
    })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return jsonResponse({
      success: false,
      stored: false,
      error: 'Method not allowed'
    }, 405)
  }

  try {
    // Parse JSON body
    const rawBody = await req.text()
    let payload: IngestPayload

    try {
      payload = JSON.parse(rawBody)
    } catch {
      return jsonResponse({
        success: false,
        stored: false,
        error: 'Invalid JSON'
      }, 400)
    }

    // Extract fields (normalize aliases)
    const deviceSerial = payload.device_serial || payload.device_id
    const devicePin = payload.pin || payload.employee_id
    const type = payload.type || null
    const machineTimestamp = payload.timestamp
    const eventId = payload.event_id

    // Validate required fields
    if (!deviceSerial || !devicePin) {
      return jsonResponse({
        success: false,
        stored: false,
        error: 'Missing required fields: device_serial and pin'
      }, 400)
    }

    // Init Supabase client with service_role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Lookup device by serial
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_serial', deviceSerial)
      .eq('active', true)
      .single<Device>()

    if (deviceError || !device) {
      console.error('Device not found:', deviceSerial, deviceError)
      return jsonResponse({
        success: false,
        stored: false,
        error: 'Device not found or inactive'
      }, 404)
    }

    // Optional HMAC verification if device.secret is set
    if (device.secret) {
      const signature = req.headers.get('X-Signature')
      if (!signature) {
        return jsonResponse({
          success: false,
          stored: false,
          error: 'Missing X-Signature header'
        }, 401)
      }

      if (!verifyHmac(device.secret, rawBody, signature)) {
        return jsonResponse({
          success: false,
          stored: false,
          error: 'Invalid signature'
        }, 401)
      }
    }

    // Determine timestamp (prefer machine_ts if provided, else server time)
    let ts: Date
    if (machineTimestamp) {
      try {
        ts = new Date(machineTimestamp)
        if (isNaN(ts.getTime())) {
          ts = new Date() // fallback to server time
        }
      } catch {
        ts = new Date()
      }
    } else {
      ts = new Date()
    }

    // Compute dedupe key (sha256 of serial|pin|ts|type)
    const dedupeKey = eventId || await computeDedupeKey(deviceSerial, devicePin, ts, type)

    // Insert into attendance_logs (ON CONFLICT DO NOTHING)
    const { data: insertData, error: insertError } = await supabase
      .from('attendance_logs')
      .insert({
        tenant_id: device.tenant_id,
        device_id: device.id,
        device_employee_id: devicePin,
        employee_id: null, // resolved by trigger
        type: type,
        machine_ts: machineTimestamp ? ts.toISOString() : null,
        ts: ts.toISOString(),
        dedupe_key: dedupeKey,
        received_at: new Date().toISOString()
      })
      .select()

    // Check if actually inserted (conflict = duplicate)
    const stored = !insertError && insertData && insertData.length > 0

    if (insertError && !insertError.message?.includes('duplicate')) {
      console.error('Insert error:', insertError)
      return jsonResponse({
        success: false,
        stored: false,
        error: insertError.message
      }, 500)
    }

    return jsonResponse({
      success: true,
      stored: stored,
      reason: stored ? undefined : 'Duplicate event (dedupe_key conflict)'
    }, 200)

  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse({
      success: false,
      stored: false,
      error: 'Internal server error'
    }, 500)
  }
})

// =====================================================
// Run: supabase functions serve attendance-ingest --no-verify-jwt
// Deploy: supabase functions deploy attendance-ingest
// =====================================================

