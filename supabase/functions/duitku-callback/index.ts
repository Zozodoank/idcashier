// @supabase/verify-jwt false
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { md5 } from '../_shared/md5.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

// Duitku callback handler
// Duitku callback handler
// @ts-ignore: Deno is available in Supabase Edge Functions runtime
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
    let additionalInfo: any = {};
    if (!userIdFromPayment && additionalParam) {
      try {
        additionalInfo = JSON.parse(additionalParam);
        console.log('Parsed additionalParam:', additionalInfo);

        if (additionalInfo.userId) {
          userIdFromPayment = additionalInfo.userId;
          console.log('User found via additionalParam userId:', userIdFromPayment);
        }
      } catch (e: any) {
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
        .eq('email', targetEmail.toLowerCase().trim())
        .maybeSingle();

      if (userByEmail) {
        userIdFromPayment = userByEmail.id;
        console.log('User found via email fallback:', userIdFromPayment);
      } else {
        console.warn('User not found via email fallback:', targetEmail);
        // Try to find in auth.users as last resort
        try {
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const foundAuthUser = authUsers?.users.find((u: any) =>
            u.email?.toLowerCase().trim() === targetEmail.toLowerCase().trim()
          );
          if (foundAuthUser) {
            userIdFromPayment = foundAuthUser.id;
            console.log('User found in auth.users, creating profile in public.users...');
            // Create user profile in public.users
            const { error: createError } = await supabase
              .from('users')
              .insert({
                id: foundAuthUser.id,
                email: foundAuthUser.email,
                name: foundAuthUser.user_metadata?.name || foundAuthUser.email?.split('@')[0] || 'User',
                role: 'owner',
                tenant_id: foundAuthUser.id
              });
            if (createError && !createError.message.includes('duplicate')) {
              console.error('Failed to create user profile:', createError);
            } else {
              console.log('✅ User profile created in public.users');
            }
          }
        } catch (authError) {
          console.error('Error checking auth.users:', authError);
        }
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
      let userId = userIdFromPayment;

      console.log('🔍 [Subscription Creation] Starting subscription creation process', {
        merchantOrderId,
        userIdFromPayment,
        merchantOrderIdParts,
        additionalInfo
      });

      // For ORD- format: ORD-userIdNoDash-timestamp, userId is at index 1
      // For ORDER- format: ORDER-userId-timestamp, userId is at index 1  
      // For RENEWAL- format: RENEWAL-userId-timestamp, userId is at index 1
      if (!userId && merchantOrderIdParts && merchantOrderIdParts.length >= 2) {
        userId = merchantOrderIdParts[1];
        console.log('🔍 [Subscription Creation] Extracted userId from merchantOrderId:', userId);

        // If userId doesn't have dashes (was stripped), reconstruct UUID: 8-4-4-4-12
        if (userId && !userId.includes('-') && userId.length === 32) {
          userId = userId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
          console.log('🔍 [Subscription Creation] Reconstructed UUID:', userId);
        }
      }

      // Final fallback: use additionalParam userId
      if (!userId && additionalInfo.userId) {
        userId = additionalInfo.userId;
        console.log('🔍 [Subscription Creation] Using userId from additionalParam:', userId);
      }

      if (!userId) {
        console.error('❌ [Subscription Creation] Failed to extract userId from all sources', {
          merchantOrderId,
          userIdFromPayment,
          additionalInfo
        });
      }

      if (userId) {
        // First, ensure user exists in public.users table
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id, role, tenant_id')
          .eq('id', userId)
          .maybeSingle();

        if (!existingUser) {
          // User doesn't exist in public.users, create it
          console.log(`⚠️ User ${userId} not found in public.users, creating profile...`);
          const userEmail = additionalInfo.email || customerEmail || '';
          const userName = additionalInfo.name || 'User';

          const { error: createUserError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: userEmail.toLowerCase().trim(),
              name: userName,
              role: 'owner',
              tenant_id: userId
            });

          if (createUserError) {
            console.error('❌ Failed to create user profile in callback:', createUserError);
            // Don't return here - try to create subscription anyway
          } else {
            console.log(`✅ User profile created for ${userId}`);
          }
        } else {
          console.log(`✅ User profile exists for ${userId}`);
        }

        // For cashiers, use the owner's ID for subscription
        let effectiveUserId = userId;

        // Get user data to check if user is a cashier
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, tenant_id')
          .eq('id', userId)
          .maybeSingle();

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

        console.log(`💰 Payment amount: ${amountNum}, Extension: ${extensionMonths} months, Plan: ${planName}`);

        // Find existing subscription or create new one
        console.log('🔍 [Subscription Creation] Looking for existing subscription for user:', effectiveUserId);
        const { data: existingSubscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', effectiveUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('❌ [Subscription Creation] Error checking existing subscription:', subError);
        } else {
          console.log('🔍 [Subscription Creation] Existing subscription check result:', existingSubscription ? 'Found' : 'Not found');
        }

        // Always create subscription for registration payments (ORD- prefix)
        // Don't extend existing subscription for new registrations
        const isNewRegistration = merchantOrderId?.startsWith('ORD-');
        if (isNewRegistration && existingSubscription) {
          console.log('🔍 [Subscription Creation] New registration detected, will create new subscription instead of extending');
        }

        const newEndDate = new Date();

        // For new registrations (ORD-), always create new subscription
        // For renewals (RENEWAL-), extend existing subscription
        if (existingSubscription && !isNewRegistration) {
          // Extend existing subscription (renewal case)
          const currentEndDate = new Date(existingSubscription.end_date);
          // If current end date is in the past, start from today
          if (currentEndDate < new Date()) {
            newEndDate.setDate(newEndDate.getDate() + (extensionMonths * 30));
          } else {
            // Extend from current end date
            newEndDate.setTime(currentEndDate.getTime() + (extensionMonths * 30 * 24 * 60 * 60 * 1000));
          }

          console.log(`🔄 [Subscription Extension] Extending subscription ${existingSubscription.id} from ${existingSubscription.end_date} to ${newEndDate.toISOString().split('T')[0]}`);

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              end_date: newEndDate.toISOString().split('T')[0],
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id);

          if (updateError) {
            console.error('❌ [Subscription Creation] Error updating subscription:', updateError);
          } else {
            console.log(`✅ [Subscription Creation] Subscription ${existingSubscription.id} extended by ${extensionMonths} months`);
          }
        } else {
          // Create new subscription
          newEndDate.setDate(newEndDate.getDate() + (extensionMonths * 30));

          console.log('🔍 [Subscription Creation] Creating new subscription', {
            user_id: effectiveUserId,
            plan_name: planName,
            duration: extensionMonths,
            start_date: new Date().toISOString().split('T')[0],
            end_date: newEndDate.toISOString().split('T')[0],
            status: 'active'
          });

          const { data: newSubscription, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: effectiveUserId,
              plan_name: planName,
              duration: extensionMonths,
              start_date: new Date().toISOString().split('T')[0],
              end_date: newEndDate.toISOString().split('T')[0],
              status: 'active'
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ [Subscription Creation] Error creating subscription:', insertError);
            console.error('❌ [Subscription Creation] Insert error details:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint
            });
          } else {
            console.log(`✅ [Subscription Creation] New subscription created for user ${effectiveUserId}`, {
              subscriptionId: newSubscription?.id,
              validUntil: newEndDate.toISOString().split('T')[0],
              planName,
              duration: extensionMonths
            });
          }
        }

        // Auto-confirm user email and set payment completed on successful payment
        // CRITICAL: Handle both OAuth and non-OAuth users
        const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);

        if (getUserError) {
          console.error(`Failed to get auth user ${userId}:`, getUserError);
        } else {
          const isOAuthUser = authUser?.user?.user_metadata?.oauth_provider !== undefined;

          const updateData: any = {
            email_confirm: true,
            user_metadata: {
              ...authUser?.user?.user_metadata,
              payment_completed: true,
              is_trial_user: false
            }
          };

          // For OAuth users, ensure OAuth metadata is preserved
          if (isOAuthUser) {
            updateData.user_metadata.oauth_provider = authUser.user.user_metadata.oauth_provider;
            if (authUser.user.user_metadata.oauth_user_id) {
              updateData.user_metadata.oauth_user_id = authUser.user.user_metadata.oauth_user_id;
            }
            console.log(`Updating OAuth user ${userId} with payment metadata`);
          } else {
            console.log(`Updating regular user ${userId} with payment metadata`);
          }

          const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, updateData);

          if (confirmError) {
            console.error(`Failed to update user ${userId} payment status:`, confirmError);
          } else {
            console.log(`✅ User ${userId} payment status updated (OAuth: ${isOAuthUser})`);
          }
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

  } catch (error: any) {
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
