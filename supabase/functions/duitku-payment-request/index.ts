import { createClient } from '@supabase/supabase-js'

// Use crypto.subtle for MD5 if available
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Ambil kredensial dari environment variables (Secrets)
const merchantCode = Deno.env.get("DUITKU_MERCHANT_CODE") || "DS25746"
const apiKey = Deno.env.get("DUITKU_MERCHANT_KEY") || "318ee30197037540d3e145562ccdf491"
const callbackUrl = Deno.env.get("CALLBACK_URL") || "https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback"
const returnUrl = Deno.env.get("RETURN_URL") || "https://idcashier.my.id/payment/finish"
const duitkuEndpoint = "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry" // Sandbox Endpoint

console.log('🔧 Environment Variables Loaded:', {
  merchantCode,
  apiKey: apiKey.substring(0, 10) + '...',
  callbackUrl,
  returnUrl,
  duitkuEndpoint
})

const allowedOrigins = ['http://localhost:5173','https://idcashier.my.id']

const toHex = (ab: ArrayBuffer) => Array.from(new Uint8Array(ab)).map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha256hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return toHex(d)
}

// Signature generation function sesuai template
async function buildSignature(merchantOrderId: string, paymentAmount: number) {
  // 1. --- BAGIAN KRITIS: MEMBUAT SIGNATURE ---
  // Pastikan urutannya benar: merchantCode + merchantOrderId + paymentAmount + apiKey
  const stringToSign = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}` 

  // 2. --- TAMBAHKAN LOGGING UNTUK DEBUGGING ---
  console.log("Creating signature for OrderId:", merchantOrderId);
  console.log("String to Sign:", stringToSign); // Ini akan menampilkan string sebelum di-hash

  // Gunakan crypto.subtle untuk MD5
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  console.log("Generated Signature:", signature); // Ini akan menampilkan signature hasil MD5

  return signature;
}

const cors = (req: Request) => {
  const origin = req.headers.get('Origin') || ''
  const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  }
}

console.log('🚀 Function starting...')

// Ambil kredensial dari environment variables (Secrets)
const merchantCode = Deno.env.get("DUITKU_MERCHANT_CODE") || "DS25746"
const apiKey = Deno.env.get("DUITKU_MERCHANT_KEY") || "318ee30197037540d3e145562ccdf491"
const callbackUrl = Deno.env.get("CALLBACK_URL") || "https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback"
const returnUrl = Deno.env.get("RETURN_URL") || "https://idcashier.my.id/payment/finish"
const duitkuEndpoint = "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry" // Sandbox Endpoint

console.log('🔧 Environment Variables Loaded:', {
  merchantCode,
  apiKey: apiKey.substring(0, 10) + '...',
  callbackUrl,
  returnUrl,
  duitkuEndpoint
})

// Signature generation function sesuai template
async function buildSignature(merchantOrderId: string, paymentAmount: number) {
  // 1. --- BAGIAN KRITIS: MEMBUAT SIGNATURE ---
  // Pastikan urutannya benar: merchantCode + merchantOrderId + paymentAmount + apiKey
  const stringToSign = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}` 

  // 2. --- TAMBAHKAN LOGGING UNTUK DEBUGGING ---
  console.log("Creating signature for OrderId:", merchantOrderId);
  console.log("String to Sign:", stringToSign); // Ini akan menampilkan string sebelum di-hash

  // Gunakan crypto.subtle untuk MD5
  const encoder = new TextEncoder()
  const data = encoder.encode(stringToSign)
  const hashBuffer = await crypto.subtle.digest('MD5', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  console.log("Generated Signature:", signature); // Ini akan menampilkan signature hasil MD5

  return signature;
}

Deno.serve(async (req) => {
  console.log('📥 Request received:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
      }
    })
  }

  try {
    console.log('🔍 Parsing request body...')
    const body = await req.json()
    console.log('📋 Request body:', body)

    // Extract parameters
    const paymentAmount = Number(body.amount)
    const paymentMethod = String(body.paymentMethod || 'VC')
    const merchantOrderId = String(body.orderId || `TEST-${Date.now()}`)
    const productDetails = String(body.productDetails || 'Test Payment')
    const customerEmail = String(body.customerEmail || body.email || 'test@example.com')
    const customerPhone = String(body.customerPhone || body.phone || '081234567890')

    console.log('📋 Extracted parameters:', {
      paymentAmount,
      paymentMethod,
      merchantOrderId,
      productDetails,
      customerEmail,
      customerPhone
    })

    if (!paymentAmount || !Number.isFinite(paymentAmount) || paymentAmount < 100) {
      console.log('❌ Invalid amount:', paymentAmount)
      return new Response(JSON.stringify({ 
        code: 400, 
        message: 'Invalid amount' 
      }), { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // Generate signature using the new function
    const signature = await buildSignature(merchantOrderId, paymentAmount)

    const payload = {
      merchantCode,
      paymentAmount,
      paymentMethod,
      merchantOrderId,
      productDetails,
      email: customerEmail,
      phoneNumber: customerPhone,
      additionalParam: '',
      merchantUserInfo: '',
      customerVaName: customerEmail.split('@')[0] || 'Customer',
      callbackUrl,
      returnUrl,
      signature,
      expiryPeriod: 60 // atur waktu kadaluarsa dalam hitungan menit
    }

    console.log('📤 Calling Duitku API:', {
      url: duitkuEndpoint,
      orderId: merchantOrderId,
      amount: paymentAmount,
      method: paymentMethod,
      signature
    })

    const res = await fetch(duitkuEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const rawText = await res.text()
    let out: any
    try { out = JSON.parse(rawText) } catch { out = { raw: rawText } }

    console.log('📥 Duitku API response:', {
      status: res.status,
      ok: res.ok,
      response: out
    })

    if (!res.ok) {
      // Map error 4xx jadi 400 (validasi), 5xx jadi 502 (upstream)
      const status = res.status >= 400 && res.status < 500 ? 400 : 502
      return new Response(JSON.stringify({
        code: status,
        message: 'Duitku API error',
        reason: res.statusText,
        providerStatus: res.status,
        details: {
          paymentMethod,
          merchantOrderId,
          amount: paymentAmount,
          payloadPreview: {
            merchantCode: payload.merchantCode,
            merchantOrderId: payload.merchantOrderId,
            paymentAmount: payload.paymentAmount,
            returnUrl: payload.returnUrl,
            callbackUrl: payload.callbackUrl
          },
          providerResponse: out
        }
      }), { 
        status, 
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }

    // Success
    console.log('✅ Duitku API success!')
    return new Response(JSON.stringify({
      success: true,
      paymentUrl: out.paymentUrl,
      reference: out.reference,
      responseCode: out.responseCode,
      responseMessage: out.responseMessage
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error) {
    console.error('❌ Function error:', error.message)
    return new Response(JSON.stringify({
      code: 500,
      message: error.message || 'Internal server error'
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})