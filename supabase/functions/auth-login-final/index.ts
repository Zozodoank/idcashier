/// <reference path="../deno-stubs.d.ts" />
// Final auth-login function with explicit handling - OPTIMIZED for speed
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { getEffectiveSubscription, isSubscriptionActive } from '../_shared/subscription.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const isWhitelistAccount = normalizedEmail === 'demo@idcashier.com' ||
      normalizedEmail === 'jho.j80@gmail.com';

    // Background auto-confirm for whitelist (non-blocking)
    if (isWhitelistAccount) {
      (async () => {
        try {
          const { data: publicUser } = await supabaseAdmin.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
          if (publicUser?.id) {
            const { data: authUserResult } = await supabaseAdmin.auth.admin.getUserById(publicUser.id);
            if (authUserResult?.user && !authUserResult.user.email_confirmed_at) {
              await supabaseAdmin.auth.admin.updateUserById(publicUser.id, {
                email_confirm: true,
                user_metadata: { ...authUserResult.user.user_metadata, email_verified: true }
              });
            }
          }
        } catch (e: any) {
          console.error('Auto-confirm error:', e);
        }
      })();
    }

    // Parallelize Auth and User Profile Fetch to improve speed
    const [authResult, userResult] = await Promise.all([
      supabaseAnon.auth.signInWithPassword({
        email: normalizedEmail,
        password: password
      }),
      supabaseAdmin
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', normalizedEmail)
        .single()
    ]);

    // Use let so we can retry login after auto-confirm (price-card flow)
    let authData = authResult.data;
    let authError = authResult.error;
    // We'll process userResult later after verifying auth
    const { data: userData, error: userError } = userResult;

    if (authError) {
      let errorMessage = 'Invalid email or password'

      if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
        if (isWhitelistAccount) {
          errorMessage = 'Email not confirmed. Please try again in 10 seconds.'
        } else {
          // Price-card (register-with-payment) users MUST NOT be forced to verify email.
          // They should be able to login, but app access is gated by subscription.
          // Recovery strategy:
          // - detect if this auth user is a price-card/pending-payment user
          // - auto-confirm the email (admin)
          // - retry signInWithPassword once
          try {
            const publicUserId = userData?.id;
            if (publicUserId) {
              const { data: authUserResult } = await supabaseAdmin.auth.admin.getUserById(publicUserId);
              const meta = authUserResult?.user?.user_metadata || {};
              const isTrialUser = Boolean((meta as any)?.is_trial_user);
              const isPriceCardUser = Boolean((meta as any)?.is_price_card_registration || (meta as any)?.payment_pending);

              if (isPriceCardUser && !isTrialUser) {
                console.log('= Auto-confirming email for price-card user to allow login (payment pending)...', {
                  email: normalizedEmail,
                  userId: publicUserId
                });

                await supabaseAdmin.auth.admin.updateUserById(publicUserId, {
                  email_confirm: true,
                  user_metadata: { ...meta, email_verified: true }
                });

                const retry = await supabaseAnon.auth.signInWithPassword({
                  email: normalizedEmail,
                  password: password
                });

                if (!retry.error && retry.data?.session) {
                  authData = retry.data;
                  authError = null;
                } else {
                  // Still failed, fallback to generic message
                  authError = retry.error || authError;
                }
              }
            }
          } catch (e: any) {
            console.error('Price-card auto-confirm retry failed:', e?.message || e);
          }

          if (authError) {
            // If still failing, keep a safe message.
            errorMessage = 'Akun ini dibuat melalui proses pembayaran. Silakan coba login lagi.'
          }
        }
      } else if (authError.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.'
      }

      // If we successfully recovered login above, continue normal flow.
      if (!authError && authData?.session) {
        // fall through
      } else {
      return new Response(
        JSON.stringify({ error: errorMessage, details: authError.message }),
        { headers: corsHeaders, status: 401 }
      )
      }
    }

    if (!authData.user && !authData.session) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    if (userError) {
      if (userError.code === 'PGRST116') {
        const { data: newUserData, error: insertError } = await supabaseAdmin
          .from('users')
          .insert([{
            id: authData.user.id,
            name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User',
            email: normalizedEmail,
            role: authData.user.user_metadata?.role || 'owner',
            tenant_id: authData.user.id,
            permissions: null
          }])
          .select('id, name, email, role, tenant_id, permissions, created_at')
          .single()

        if (insertError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user profile' }),
            { headers: corsHeaders, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({
            user: { ...newUserData, tenantId: newUserData.tenant_id },
            token: authData.session.access_token,
            session: {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
              expires_at: authData.session.expires_at,
              expires_in: authData.session.expires_in
            },
            message: 'Login successful'
          }),
          { headers: corsHeaders, status: 200 }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { headers: corsHeaders, status: 500 }
      )
    }

    let subscriptionExpired = false;
    let paymentPending = false;

    // Subscription check (skip for whitelist accounts)
    if (!isWhitelistAccount) {
      try {
        const effectiveUserId = userData.role === 'cashier' ? userData.tenant_id : userData.id;

        // Safety check for effectiveUserId
        if (!effectiveUserId) {
          console.warn('No effectiveUserId found for subscription check', userData);
        } else {
          const { data: subscription, error: subscriptionError } = await getEffectiveSubscription(
            supabaseAdmin,
            effectiveUserId,
            'end_date, status, updated_at, created_at'
          );

          // Log subscription check for debugging
          console.log('Subscription check for user:', { effectiveUserId, subscription, subscriptionError });

          // If there is no subscription row at all, treat it as payment pending (no app access yet)
          if (!subscription && !subscriptionError) {
            paymentPending = true;
            subscriptionExpired = true;
          }

          // Only check expiration if subscription exists and has end_date
          if (subscription && !subscriptionError && subscription.end_date) {
            try {
              const endDate = new Date(subscription.end_date);
              if (isNaN(endDate.getTime())) {
                console.warn('Invalid subscription end_date:', subscription.end_date);
              } else {
                if (!isSubscriptionActive(subscription.end_date, new Date())) {
                  console.log('User subscription expired but allowing login (warning only)');
                  subscriptionExpired = true;
                  // NON-BLOCKING: logic changed to allow login even if expired
                  // The frontend should handle the warning display based on subscriptionExpired flag
                }
              }
            } catch (dateError) {
              console.error('Date parsing error:', dateError);
            }
          }
        }
      } catch (subCheckError) {
        console.error('Subscription check critical error:', subCheckError);
      }
    }

    return new Response(
      JSON.stringify({
        user: {
          ...userData,
          tenantId: userData.tenant_id,
          subscriptionExpired: subscriptionExpired,
          paymentPending: paymentPending
        },
        token: authData.session.access_token,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in
        },
        subscriptionExpired: subscriptionExpired, // Top level also for convenience
        paymentPending: paymentPending,
        message: subscriptionExpired ? 'Login successful (Subscription Expired)' : 'Login successful'
      }),
      { headers: corsHeaders, status: 200 }
    )


  } catch (error: any) {
    console.error('Unexpected error:', error)

    // Return actual error details for debugging purposes
    // IN PRODUCTION: You might want to sanitize this, but for debugging we need the details
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message || String(error),
        stack: error.stack
      }),
      { headers: corsHeaders, status: 500 }
    )
  }
})
