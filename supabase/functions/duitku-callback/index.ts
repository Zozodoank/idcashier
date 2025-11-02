// @supabase/verify-jwt false
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';

// Duitku callback handler
Deno.serve(async (req) => {
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
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
    // Duitku callbacks always use MD5 according to spec
    const DUITKU_SIGNATURE_ALGO = 'md5';

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
          headers: corsHeaders,
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
            { headers: corsHeaders, status: 401 }
          );
        }
      } catch (signatureError) {
        console.error('Signature verification error:', signatureError);
        return new Response(
          JSON.stringify({ success: false, message: 'Signature verification failed' }),
          { headers: corsHeaders, status: 500 }
        );
      }
    }

    // Create Supabase client with service role key for full access
    const supabase = createClient(
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_URL') || '',
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Extract payment ID from merchantOrderId (format: "RENEWAL-{userId}-{timestamp}" or "PAYMENT-{userId}-{timestamp}")
    let paymentId: string | null = null;
    const merchantOrderIdParts = merchantOrderId?.split('-');
    if (merchantOrderIdParts && merchantOrderIdParts.length >= 3) {
      // Try to find payment by merchant_order_id
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('id')
        .eq('merchant_order_id', merchantOrderId)
        .single();

      if (paymentData) {
        paymentId = paymentData.id;
      } else {
        console.error('Payment not found for merchantOrderId:', merchantOrderId);
      }
    }

    // Update payment status based on resultCode
    const isSuccess = resultCode === '00';
    const paymentStatus = isSuccess ? 'completed' : 'failed';
    const paymentMessage = resultMessage || (isSuccess ? 'Payment successful' : 'Payment failed');

    if (paymentId) {
      const updateData: any = {
        status: paymentStatus,
        result_code: resultCode,
        result_message: paymentMessage,
        updated_at: new Date().toISOString()
      };

      // Add payment URL for successful payments if available
      if (isSuccess && callbackData.paymentUrl) {
        updateData.payment_url = callbackData.paymentUrl;
      }

      const { error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
      } else {
        console.log(`Payment ${paymentId} status updated to ${paymentStatus}`);
      }
    }

    // If this is a successful renewal payment, update subscription
    if (isSuccess && merchantOrderId?.startsWith('RENEWAL-')) {
      // Extract user ID from merchantOrderId
      const userId = merchantOrderIdParts?.[1];
      
      if (userId) {
        // Get payment record to access product details
        let paymentRecord: any = null;
        if (paymentId) {
          const { data, error: paymentError } = await supabase
            .from('payments')
            .select('amount, product_details')
            .eq('id', paymentId)
            .single();
          
          if (!paymentError && data) {
            paymentRecord = data;
          }
        }
        
        // Get the payment amount to determine extension period
        let extensionMonths = 1; // Default fallback
        const amountNum = typeof amount === 'string' ? parseInt(amount) : amount;
        
        // Determine extension period and plan name based on amount and product details
        let planName = '1_month';
        if (amountNum === 50000) {
          extensionMonths = 1;
          planName = paymentRecord?.product_details?.includes('1 Bulan') ? '1_month' : '1_month';
        } else if (amountNum === 150000) {
          extensionMonths = 3;
          planName = '3_months';
        } else if (amountNum === 270000) {
          extensionMonths = 6;
          planName = '6_months';
        } else if (amountNum === 500000) {
          extensionMonths = 12;
          planName = '12_months';
        }
        
        // Find existing subscription or create new one
        const { data: existingSubscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const newEndDate = new Date();
        
        if (existingSubscription) {
          // Extend existing subscription
          const currentEndDate = new Date(existingSubscription.end_date);
          // If current end date is in the past, start from today
          if (currentEndDate < new Date()) {
            newEndDate.setDate(newEndDate.getDate() + (extensionMonths * 30));
          } else {
            // Extend from current end date
            newEndDate.setTime(currentEndDate.getTime() + (extensionMonths * 30 * 24 * 60 * 60 * 1000));
          }
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              plan_name: planName,
              duration: extensionMonths,
              amount: amountNum,
              end_date: newEndDate.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
              status: 'active'
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log(`Subscription ${existingSubscription.id} extended by ${extensionMonths} months`);
          }
        } else {
          // Create new subscription
          newEndDate.setDate(newEndDate.getDate() + (extensionMonths * 30));
          
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              plan_name: planName,
              duration: extensionMonths,
              amount: amountNum,
              start_date: new Date().toISOString().split('T')[0],
              end_date: newEndDate.toISOString().split('T')[0],
              status: 'active'
            });

          if (insertError) {
            console.error('Error creating subscription:', insertError);
          } else {
            console.log(`New subscription created for user ${userId}, valid until ${newEndDate.toISOString().split('T')[0]}`);
          }
        }
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Callback processed successfully',
        paymentId,
        status: paymentStatus
      }),
      { 
        headers: corsHeaders,
        status: 200
      }
    );

  } catch (error) {
    console.error('Error processing Duitku callback:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error processing callback',
        error: error.message
      }),
      { 
        headers: corsHeaders,
        status: 500
      }
    );
  }
});