// @supabase/verify-jwt false
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { md5 } from '../_shared/md5.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  calculateExtendedEndDate,
  getDerivedSubscriptionStatus,
  getEffectiveSubscription,
  getRenewalStartDate,
  toDateOnly,
} from '../_shared/subscription.ts';

// Duitku callback handler
// Duitku callback handler
Deno.serve(async (req: Request) => {
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
    const customerEmail = (callbackData.email || callbackData['customerEmail'] || callbackData['customeremail']) as string | undefined;

    // Load Duitku configuration from environment
    // @ts-ignore: Deno is available at runtime
    const DUITKU_MERCHANT_CODE = Deno.env.get('DUITKU_MERCHANT_CODE') || '';
          // @ts-ignore: Deno is available at runtime
      const DUITKU_API_KEY = Deno.env.get('DUITKU_API_KEY')?.trim() || Deno.env.get('DUITKU_MERCHANT_KEY')?.trim() || '';
      // Duitku callbacks always use MD5 according to spec
      const DUITKU_SIGNATURE_ALGO = 'md5';

    

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

      if (!DUITKU_API_KEY) {
    console.warn('Duitku API key not set in environment, skipping signature verification');
  } else {
      try {
          // For callback: MD5(merchantCode + amount + merchantOrderId + apiKey)
  const rawString = `${merchantCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
  
  console.log('🔍 Callback Signature Debug:', {
          merchantCode,
          amount,
          merchantOrderId,
                      merchantKey: DUITKU_API_KEY.substring(0, 10) + '...',
          signatureString: rawString,
          algorithm: DUITKU_SIGNATURE_ALGO
        });

        const expected = md5(rawString);

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
    let userIdFromPayment: string | null = null;
    if (merchantOrderIdParts && merchantOrderIdParts.length >= 2) {
      // Try to find payment by merchant_order_id
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('id, user_id')
        .eq('merchant_order_id', merchantOrderId)
        .single();

      if (paymentData) {
        paymentId = paymentData.id;
        userIdFromPayment = paymentData.user_id;
      } else {
        console.error('Payment not found for merchantOrderId:', merchantOrderId);
      }
    }

    // Fallback: Check additionalParam for userId and email (Most Reliable Fallback)
    // NOTE (Duitku spec): additionalParam is expected to be URL-encoded.
    let additionalInfo: any = {};
    if (!userIdFromPayment && additionalParam) {
      try {
        let decoded = additionalParam;
        try {
          decoded = decodeURIComponent(additionalParam);
        } catch {
          // If it's not URI encoded, keep original
        }

        additionalInfo = JSON.parse(decoded);
        console.log('Parsed additionalParam:', additionalInfo);

        if (additionalInfo.userId) {
          userIdFromPayment = additionalInfo.userId;
          console.log('User found via additionalParam userId:', userIdFromPayment);
        }
      } catch (e) {
        console.error('Error parsing additionalParam:', e);
      }
    }

    // Fallback: If payment not found, find user by email (from additionalParam or callback)
    const targetEmail = additionalInfo.email || customerEmail;
    if (!userIdFromPayment && targetEmail) {
       console.log('Payment lookup failed, attempting fallback with email:', targetEmail);
       const { data: userByEmail } = await supabase
         .from('users')
         .select('id')
         .eq('email', targetEmail)
         .single();
       
       if (userByEmail) {
          userIdFromPayment = userByEmail.id;
          console.log('User found via email fallback:', userIdFromPayment);
       } else {
          console.warn('User not found via email fallback:', targetEmail);
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

    // If this is a successful payment (renewal or new order), update subscription
    if (isSuccess && (merchantOrderId?.startsWith('RENEWAL-') || merchantOrderId?.startsWith('ORDER-') || merchantOrderId?.startsWith('ORD-'))) {
      // Use user ID from payment record if available, otherwise extract from merchantOrderId
      let userId = userIdFromPayment || merchantOrderIdParts?.[1];

      if (!userIdFromPayment && (merchantOrderId?.startsWith('ORDER-') || merchantOrderId?.startsWith('ORD-')) && userId && !userId.includes('-')) {
         // Reconstruct UUID: 8-4-4-4-12
         userId = userId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      }
      
      if (userId) {
        // --- CRITICAL FIX ---
        // In price-card OAuth flow, it's possible that Supabase Auth user exists but public.users row
        // hasn't been created yet when Duitku callback arrives.
        // Since subscriptions.user_id has FK to public.users, inserting subscription will fail.
        // Previously this failure was only logged and the callback still returned 200, leaving users "expired".
        // Fix: ensure public.users row exists BEFORE any subscription upsert.
        try {
          const ensuredEmail = targetEmail;
          // Create minimal public.users if missing
          const { data: existingPublicUser, error: existingUserErr } = await supabase
            .from('users')
            .select('id, email, role, tenant_id')
            .eq('id', userId)
            .maybeSingle();

          if (existingUserErr) {
            console.warn('Error checking existing public.users:', existingUserErr);
          }

          if (!existingPublicUser) {
            console.log('🧩 public.users missing for paid user. Creating public.users before subscription...', { userId, ensuredEmail });
            const insertPayload: any = {
              id: userId,
              name: (ensuredEmail ? ensuredEmail.split('@')[0] : 'User'),
              email: ensuredEmail || `unknown-${userId}@invalid.local`,
              role: 'owner',
              tenant_id: userId
            };

            const { error: insertUserErr } = await supabase
              .from('users')
              .insert(insertPayload);

            if (insertUserErr) {
              // If duplicate due to race, ignore. Otherwise throw to stop silently-success response.
              const msg = (insertUserErr as any)?.message || '';
              if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already') || (insertUserErr as any)?.code === '23505') {
                console.log('public.users already created by race, continuing.');
              } else {
                console.error('❌ Failed to create public.users before subscription:', insertUserErr);
                throw insertUserErr;
              }
            }
          }
        } catch (ensureUserErr) {
          console.error('❌ Failed to ensure public.users exists; aborting subscription update to avoid silent success:', ensureUserErr);
          return new Response(
            JSON.stringify({ success: false, message: 'Failed to ensure user profile exists before subscription update' }),
            { headers: corsHeaders, status: 500 }
          );
        }

        // For cashiers, use the owner's ID for subscription
        let effectiveUserId = userId;
        
        // Get user data to check if user is a cashier
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, tenant_id')
          .eq('id', userId)
          .single();
          
        if (!userError && userData && userData.role === 'cashier') {
          effectiveUserId = userData.tenant_id;
          console.log(`User ${userId} is a cashier, using tenant_id ${effectiveUserId} for subscription`);
        }
        
        // Get payment record to access product details
        let paymentRecord: any = null;
        let isHPPActivation = false;
        if (paymentId) {
          const { data, error: paymentError } = await supabase
            .from('payments')
            .select('amount, product_details')
            .eq('id', paymentId)
            .single();
          
          if (!paymentError && data) {
            paymentRecord = data;
            // Check if this is HPP activation payment
            isHPPActivation = paymentRecord.product_details?.includes('HPP') || 
                             paymentRecord.product_details?.includes('Aktivasi HPP') ||
                             paymentRecord.product_details?.toLowerCase().includes('hpp') ||
                             false;
            console.log(`[HPP Activation Check] product_details: "${paymentRecord.product_details}", isHPPActivation: ${isHPPActivation}`);
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
        } else if (amountNum === 250000 || amountNum === 270000) {
          extensionMonths = 6;
          planName = '6_months';
        } else if (amountNum === 500000) {
          extensionMonths = 12;
          planName = '12_months';
        }
        
        // Find existing subscription or create new one
        const { data: existingSubscription, error: subError } = await getEffectiveSubscription(
          supabase,
          effectiveUserId,
          '*'
        );

        if (subError) {
          console.error('Error selecting effective subscription:', subError);
        }

        const startDate = getRenewalStartDate(existingSubscription, new Date());
        const newEndDate = calculateExtendedEndDate(
          existingSubscription?.end_date,
          extensionMonths,
          new Date()
        );
        const subscriptionStatus = getDerivedSubscriptionStatus(toDateOnly(newEndDate), new Date());
        
        if (existingSubscription) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              start_date: toDateOnly(startDate),
              end_date: toDateOnly(newEndDate),
              status: subscriptionStatus,
              updated_at: new Date().toISOString(),
              plan_name: paymentRecord?.product_details || planName,
              duration: extensionMonths
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log(`Subscription ${existingSubscription.id} extended by ${extensionMonths} months, status: ${subscriptionStatus}`);
          }
        } else {
          // Create new subscription
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              // IMPORTANT: subscriptions.id is NOT NULL and has no default in this project.
              // Always provide id to avoid silent failures where payment is completed but subscription is missing.
              id: crypto.randomUUID(),
              user_id: effectiveUserId,
              start_date: toDateOnly(startDate),
              end_date: toDateOnly(newEndDate),
              status: subscriptionStatus,
              plan_name: paymentRecord?.product_details || planName,
              duration: extensionMonths
            });

          if (insertError) {
            console.error('❌ Error creating subscription:', insertError);
            return new Response(
              JSON.stringify({ success: false, message: 'Failed to create subscription', error: (insertError as any)?.message || insertError }),
              { headers: corsHeaders, status: 500 }
            );
          } else {
            console.log(`New subscription created for user ${effectiveUserId}, valid until ${newEndDate.toISOString().split('T')[0]}, status: ${subscriptionStatus}`);
          }
        }
        
        // Auto-confirm user email on successful payment and clear pending-payment metadata
        const { data: currentAuthUserData } = await supabase.auth.admin.getUserById(userId);
        const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, {
          email_confirm: true,
          user_metadata: {
            ...(currentAuthUserData?.user?.user_metadata || {}),
            payment_completed: true,
            payment_pending: false,
            email_verified: true,
            is_trial_user: false
          }
        });
        
        if (confirmError) {
          console.error(`Failed to auto-confirm email for user ${userId}:`, confirmError);
        } else {
          console.log(`Auto-confirmed email for user ${userId} and updated payment_completed to true`);
        }

        // Also update user profile in public.users table
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({
            email: targetEmail || undefined
          })
          .eq('id', userId);

        if (userUpdateError) {
          console.error(`Failed to update user profile:`, userUpdateError);
        } else {
          console.log(`Updated user profile for user ${userId}`);
        }
        
        // If this is HPP activation payment, enable HPP feature
        if (isHPPActivation) {
          console.log(`[HPP Activation] Enabling HPP feature for user ${effectiveUserId}...`);
          try {
            // Check if setting exists
            const { data: existingSetting, error: settingCheckError } = await supabase
              .from('app_settings')
              .select('id, setting_value')
              .eq('user_id', effectiveUserId)
              .eq('setting_key', 'hpp_enabled')
              .maybeSingle();
            
            if (settingCheckError) {
              console.error('[HPP Activation] Error checking existing setting:', settingCheckError);
            }
            
            if (existingSetting) {
              // Update existing setting
              console.log(`[HPP Activation] Updating existing setting (id: ${existingSetting.id})...`);
              const { error: updateSettingError, data: updatedSetting } = await supabase
                .from('app_settings')
                .update({
                  setting_value: { enabled: true },
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingSetting.id)
                .select();
              
              if (updateSettingError) {
                console.error('[HPP Activation] Error updating HPP setting:', updateSettingError);
              } else {
                console.log(`[HPP Activation] ✅ HPP feature enabled for user ${effectiveUserId}`, updatedSetting);
              }
            } else {
              // Create new setting
              console.log(`[HPP Activation] Creating new HPP setting for user ${effectiveUserId}...`);
              const { error: insertSettingError, data: insertedSetting } = await supabase
                .from('app_settings')
                .insert({
                  user_id: effectiveUserId,
                  setting_key: 'hpp_enabled',
                  setting_value: { enabled: true }
                })
                .select();
              
              if (insertSettingError) {
                console.error('[HPP Activation] Error creating HPP setting:', insertSettingError);
              } else {
                console.log(`[HPP Activation] ✅ HPP feature enabled for user ${effectiveUserId}`, insertedSetting);
              }
            }
          } catch (hppError) {
            console.error('[HPP Activation] Unexpected error enabling HPP feature:', hppError);
          }
        } else {
          console.log(`[HPP Activation] Payment is NOT an HPP activation (isHPPActivation: ${isHPPActivation})`);
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
