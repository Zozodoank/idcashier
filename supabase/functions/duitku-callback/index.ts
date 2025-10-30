// @supabase/verify-jwt false
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Duitku callback handler
Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use Record<string, any> for dynamic object that will be populated
    let callbackData: Record<string, any> = {};

    // Helper to normalize keys to lower-case for case-insensitive providers
    const normalizeKeys = (data: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(data)) {
        out[k] = v;
        out[k.toLowerCase()] = v;
      }
      return out;
    };

    // Try multiple parsing strategies to be resilient to provider behavior
    const contentType = req.headers.get('content-type') || '';

    // 1) JSON
    if (contentType.includes('application/json')) {
      try {
        const json = await req.json();
        callbackData = normalizeKeys(json as Record<string, any>);
        console.log('Parsed JSON data:', callbackData);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
      }
    }

    // 2) Form (multipart or urlencoded)
    if (!Object.keys(callbackData).length && (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data'))) {
      try {
        // Prefer formData() when available (multipart) but also support urlencoded
        if (contentType.includes('multipart/form-data')) {
          const fd = await req.formData();
          const temp: Record<string, any> = {};
          for (const [key, value] of fd.entries()) {
            temp[key] = typeof value === 'string' ? value : (value as File).name;
          }
          callbackData = normalizeKeys(temp);
        } else {
          const bodyText = await req.text();
          const params = new URLSearchParams(bodyText);
          const temp: Record<string, any> = {};
          params.forEach((value, key) => { temp[key] = value; });
          callbackData = normalizeKeys(temp);
        }
        console.log('Parsed form data:', callbackData);
      } catch (formError) {
        console.error('Form parsing error:', formError);
      }
    }

    // 3) Raw text as urlencoded fallback
    if (!Object.keys(callbackData).length) {
      try {
        const rawData = await req.text();
        if (rawData) {
          try {
            const json = JSON.parse(rawData);
            callbackData = normalizeKeys(json as Record<string, any>);
            console.log('Parsed raw JSON:', callbackData);
          } catch {
            const params = new URLSearchParams(rawData);
            const temp: Record<string, any> = {};
            params.forEach((value, key) => { temp[key] = value; });
            callbackData = normalizeKeys(temp);
            console.log('Parsed raw form data:', callbackData);
          }
        }
      } catch (rawError) {
        console.error('Raw body parsing error:', rawError);
      }
    }

    // 4) GET query params support (some gateways may call via GET)
    if (!Object.keys(callbackData).length && req.method === 'GET') {
      const url = new URL(req.url);
      const temp: Record<string, any> = {};
      url.searchParams.forEach((value, key) => { temp[key] = value; });
      callbackData = normalizeKeys(temp);
      console.log('Parsed query params:', callbackData);
    }
    
    // Log the callback data for debugging
    console.log('Final parsed callback data:', callbackData);
    
    // Extract relevant information with proper typing
    const merchantCode = (callbackData.merchantCode || callbackData['merchantcode']) as string | undefined;
    const amount = (callbackData.amount || callbackData['paymentamount']) as string | number | undefined;
    const merchantOrderId = (callbackData.merchantOrderId || callbackData['merchantorderid']) as string | undefined;
    const productDetail = (callbackData.productDetail || callbackData['productdetails'] || callbackData['productdetail']) as string | undefined;
    const additionalParam = (callbackData.additionalParam || callbackData['additionalparam']) as string | undefined;
    const paymentMethod = (callbackData.paymentMethod || callbackData['paymentmethod']) as string | undefined;
    const resultCode = (callbackData.resultCode || callbackData['resultcode']) as string | undefined;
    const resultMessage = (callbackData.resultMessage || callbackData['resultmessage']) as string | undefined;
    const signature = (callbackData.signature || callbackData['x-signature'] || callbackData['Signature']) as string | undefined;

    // Load Duitku configuration from environment
    // @ts-ignore: Deno is available at runtime
    const DUITKU_MERCHANT_CODE = Deno.env.get('DUITKU_MERCHANT_CODE') || '';
    // @ts-ignore: Deno is available at runtime
    const DUITKU_MERCHANT_KEY = Deno.env.get('DUITKU_MERCHANT_KEY') || '';
    // @ts-ignore: Deno is available at runtime
    const DUITKU_SIGNATURE_ALGO = (Deno.env.get('DUITKU_SIGNATURE_ALGO') || 'md5').toLowerCase();

    // MD5 implementation for callback verification
    async function md5hex(s: string): Promise<string> {
      try {
        const { md5 } = await import('https://deno.land/std@0.177.0/crypto/md5.ts');
        return md5(s);
      } catch (e) {
        console.log('MD5 import failed, using fallback');
        const encoder = new TextEncoder();
        const data = encoder.encode(s);
        const hashBuffer = await crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    }

    // Helper for timing-safe comparison
    const timingSafeEqual = (a: string, b: string) => {
      const aBytes = new TextEncoder().encode(a);
      const bBytes = new TextEncoder().encode(b);
      const len = Math.max(aBytes.length, bBytes.length);
      let result = 0;
      for (let i = 0; i < len; i++) {
        result |= (aBytes[i] || 0) ^ (bBytes[i] || 0);
      }
      return result === 0 && a.length === b.length;
    };

    if (!merchantCode || !merchantOrderId || !amount) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required fields for signature verification',
          receivedData: callbackData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    if (!DUITKU_MERCHANT_KEY) {
      console.warn('Duitku merchant key not set in environment, skipping signature verification');
    } else {
      try {
        // FIXED: Use MD5 signature verification according to Duitku PHP library
        // For callback: MD5(merchantCode + amount + merchantOrderId + merchantKey)
        const rawString = `${merchantCode}${amount}${merchantOrderId}${DUITKU_MERCHANT_KEY}`;
        
        console.log('🔍 Callback Signature Debug:', {
          merchantCode,
          amount,
          merchantOrderId,
          merchantKey: DUITKU_MERCHANT_KEY.substring(0, 10) + '...',
          signatureString: rawString,
          algorithm: DUITKU_SIGNATURE_ALGO
        });

        let expected: string;
        if (DUITKU_SIGNATURE_ALGO === 'md5') {
          expected = await md5hex(rawString);
        } else {
          // Fallback to SHA-256 if specified
          const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
          const enc = new TextEncoder();
          const digest = await crypto.subtle.digest('SHA-256', enc.encode(rawString));
          expected = toHex(digest);
        }

        console.log('🔐 Signature Verification:', {
          expected,
          provided: signature,
          valid: signature && timingSafeEqual(expected.toLowerCase(), String(signature).toLowerCase())
        });

        if (!signature || !timingSafeEqual(expected.toLowerCase(), String(signature).toLowerCase())) {
          console.error('❌ Invalid or missing signature', { expected, provided: signature });
          return new Response(
            JSON.stringify({ success: false, message: 'Invalid signature' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          );
        }

        console.log('✅ Signature verification successful');
      } catch (sigErr) {
        console.error('❌ Signature verification error:', sigErr);
        return new Response(
          JSON.stringify({ success: false, message: 'Signature verification error' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }
    
    // Validate required fields
    if (!merchantOrderId || !resultCode) {
      console.error('Missing required fields in callback data');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required fields: merchantOrderId and resultCode are required',
          receivedData: callbackData,
          extractedValues: { merchantOrderId, resultCode, paymentMethod }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    
    // Create Supabase client with service role key for full access
    const supabase = createClient(
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          // @ts-ignore: Deno is available at runtime
          headers: { Authorization: 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Update transaction status based on resultCode
    // Result codes typically:
    // 00: Success
    // 01: Expired
    // 02: Failed
    
    let status = 'pending';
    if (resultCode === '00') {
      status = 'completed';
    } else if (resultCode === '01') {
      status = 'expired';
    } else if (resultCode === '02') {
      status = 'failed';
    }
    
    // Update the payment record in database
    const { data, error } = await supabase
      .from('payments')
      .update({ 
        status: status,
        payment_method: paymentMethod,
        reference: merchantOrderId,
        updated_at: new Date().toISOString()
      })
      .eq('merchant_order_id', merchantOrderId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating payment record:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to update payment record',
          error: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
    
    // If payment is successful, we might want to update user subscription
    if (status === 'completed' && data.user_id) {
      // Here you could update user subscription status
      // This is just an example - adjust based on your needs
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', data.user_id)
        .select()
        .single();
      
      if (subscriptionError) {
        console.error('Error updating subscription:', subscriptionError);
      }
    }
    
    console.log('Payment record updated successfully:', data);
    
    // Return success response to Duitku
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Callback processed successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Duitku callback processing error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error',
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});