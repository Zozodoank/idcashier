// Setup type definitions for built-in Supabase Runtime APIs
/// <reference path="../deno-stubs.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserEmailFromToken } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client using service role
    const supabase = createSupabaseClient()

    // Parse the request body
    const { name, email, password, role = 'owner', tenant_id, permissions, trialDays, paymentCompleted, planDuration, oauthProvider, oauthUserId, isPriceCardRegistration } = await req.json()

    // 🔧 FIXED: Handle price card registration - ensure no trial/HPP for price card users
    const isPriceCardUser = isPriceCardRegistration === true;

    // 🔧 DEBUG: Log the registration type
    console.log('🔍 Registration Debug:', {
      paymentCompleted,
      trialDays,
      isPriceCardRegistration,
      isPriceCardUser,
      email,
      oauthProvider,
      oauthUserId
    });

    // Get site URL from environment or use default
    const siteUrl = Deno.env.get('SITE_URL') || 'https://idcashier.com'

    // Check if this is an OAuth user (password is null)
    const isOAuthUser = password === null || password === undefined || oauthProvider !== undefined

    // Validate input
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // For non-OAuth users, password is required
    if (!isOAuthUser && !password) {
      return new Response(
        JSON.stringify({ error: 'Password is required for non-OAuth users' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check password length (only for non-OAuth users)
    if (!isOAuthUser && password && password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Validate permissions for cashier role
    let userPermissions = null
    if (role === 'cashier' && permissions) {
      if (typeof permissions === 'object' &&
        typeof permissions.sales === 'boolean' &&
        typeof permissions.products === 'boolean' &&
        typeof permissions.reports === 'boolean') {
        userPermissions = permissions
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid permissions structure. Must be an object with sales, products, and reports boolean properties.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }
    }

    // -- User Creation Logic --
    let userId: string | null = null;

    // Check if user exists in public.users
    const { data: existingPublic } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingPublic) {
      // User exists, try to update
      try {
        const { data: authUser, error: getAuthError } = await supabase.auth.admin.getUserById(existingPublic.id)

        if (!getAuthError && authUser && authUser.user) {
          userId = existingPublic.id

          // Determine if email verification is needed
          const needsEmailVerification = !paymentCompleted && !isOAuthUser;

          // Update user
          const updateParams: any = {
            email_confirm: !needsEmailVerification, // Only trial users need verification
            user_metadata: {
              name,
              role,
              manual_verification_required: needsEmailVerification,
              payment_completed: !!paymentCompleted,
              is_trial_user: !paymentCompleted
            }
          }

          // Only update password if not OAuth user
          if (!isOAuthUser && password) {
            updateParams.password = password
          }

          // Add OAuth metadata if OAuth user
          if (isOAuthUser) {
            updateParams.user_metadata.oauth_provider = oauthProvider || 'google'
            if (oauthUserId) {
              updateParams.user_metadata.oauth_user_id = oauthUserId
            }
          }

          const { error: updateError } = await supabase.auth.admin.updateUserById(userId as string, updateParams)

          if (updateError) {
            console.error(`Error updating user ${userId}:`, updateError)
          }
        } else {
          // Orphaned public user
          console.log(`Cleaning up orphaned public user for ${email}`)
          await supabase.from('users').delete().eq('id', existingPublic.id)
          userId = null;
        }
      } catch (authCheckError) {
        console.error('Error checking existing user:', authCheckError);
        userId = null;
      }
    }

    // Create new user if needed
    if (!userId) {
      // Determine if email verification is needed:
      // - Paid users (paymentCompleted): no verification needed
      // - OAuth users (password is null): no verification needed (already verified by OAuth provider)
      // - Whitelist users: no verification needed
      // - Trial users: need email verification
      const isWhitelistAccount = email === 'demo@idcashier.com' || email === 'jho.j80@gmail.com';
      const needsEmailVerification = !paymentCompleted && !isOAuthUser && !isWhitelistAccount;

      // For OAuth users, we need to check if user already exists in auth.users
      // OAuth users are created by Supabase OAuth flow BEFORE this function is called
      // So we should use oauthUserId (which is the auth.users.id) if provided
      let existingAuthUserId: string | null = null;

      if (isOAuthUser) {
        // For OAuth, try to find the user in auth.users
        try {
          // 1. Try by ID if provided (This is the most reliable method)
          if (oauthUserId) {
            const { data: authUserData, error: idError } = await supabase.auth.admin.getUserById(oauthUserId)
            if (!idError && authUserData?.user) {
              existingAuthUserId = authUserData.user.id
              console.log(`✅ Found OAuth user by ID: ${existingAuthUserId}`);
            } else {
              console.warn(`⚠️ Could not find OAuth user by ID ${oauthUserId}:`, idError?.message);
            }
          }

          // 2. Try by email if not found by ID
          if (!existingAuthUserId) {
            console.log(`🔍 Searching OAuth user by email: ${email}`)
            // Note: listUsers is not efficient for large user bases but okay for this scale
            // Attempt to fetch more users to avoid pagination issues (limit MAX is often 1000)
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })

            if (listError) {
              console.error('Error listing users:', listError);
            }

            const foundUser = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
            if (foundUser) {
              existingAuthUserId = foundUser.id
              console.log(`✅ Found OAuth user by email scan: ${existingAuthUserId}`);
            }
          }
        } catch (e) {
          console.error('Error finding OAuth user:', e)
        }

        if (existingAuthUserId) {
          userId = existingAuthUserId
          // Update metadata ensuring email is confirmed
          await supabase.auth.admin.updateUserById(userId, {
            email_confirm: true,
            user_metadata: {
              name,
              role,
              payment_completed: !!paymentCompleted,
              is_trial_user: !paymentCompleted,
              oauth_provider: oauthProvider || 'google'
            }
          })
        } else {
          // Fallback: If we have oauthUserId passed from client, assume it is valid and use it
          // This allows public.users creation to proceed even if Admin API didn't find the user (e.g. race condition)
          if (oauthUserId) {
            console.warn(`⚠️ Assuming oauthUserId ${oauthUserId} is valid despite lookup failure.`);
            userId = oauthUserId;
          } else {
            console.warn(`⚠️ OAuth user not found in auth system for ${email}`);
          }
        }
      }

      // If we found an existing OAuth user (or used fallback), we skip the create block
      if (!userId) {
        // Create new user (standard flow)
        console.log(`Creating new standard user for ${email}`);
        const createUserParams: any = {
          email,
          email_confirm: !needsEmailVerification, // Only trial users need verification
          user_metadata: {
            name,
            role,
            manual_verification_required: needsEmailVerification,
            payment_completed: !!paymentCompleted,
            is_trial_user: !paymentCompleted
          }
        }

        // Only add password if not OAuth user
        if (!isOAuthUser && password) {
          createUserParams.password = password
        }

        const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser(createUserParams)

        if (createAuthError) {
          // If user exists, try to recover
          if (createAuthError.message?.includes("already registered") || createAuthError.status === 422) {
            console.log(`User ${email} exists (already registered). Recovering ID.`)
            // Find the existing user to get their ID
            const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
            const foundUser = listData?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
            if (foundUser) {
              userId = foundUser.id
              console.log(`✅ Recovered ID from existing user: ${userId}`);
            } else {
              // Should not happen if "already registered"
              console.error(`❌ User exists but could not be retrieved from list (checked 1000).`);
              return new Response(
                JSON.stringify({ error: 'User exists but could not be retrieved. Please try logging in.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              )
            }
          } else {
            console.error('Error creating user:', createAuthError);
            throw createAuthError
          }
        } else if (authData?.user) {
          userId = authData.user.id
        }
      }
    }

    // Safety check for userId
    if (!userId && oauthUserId && isOAuthUser) {
      // Final Fallback: Use the provided OAuth ID
      userId = oauthUserId
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Failed to resolve user ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // For owner, tenant_id will be set to userId (self-reference)
    const userTenantId = role === 'owner' ? userId : tenant_id

    // Upsert user in public.users
    const { data: newUser, error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name,
        email,
        role,
        tenant_id: userTenantId,
        permissions: userPermissions
      }, { onConflict: 'id' })
      .select('id, name, email, role, tenant_id, permissions, created_at')
      .single()

    if (upsertError) {
      console.error(`Database error upserting user ${email}:`, upsertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user account: Database error creating/updating user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create subscription
    const trialDaysNum = Number(trialDays)

    // 🔧 CRITICAL FIX: For price card registration, always force trialDays to 0 (no trial)
    const effectiveTrialDays = isPriceCardUser ? 0 : trialDaysNum;

    // 🔧 DEBUG: Log subscription creation
    console.log('🔍 Subscription Creation Debug:', {
      trialDaysNum,
      effectiveTrialDays,
      isPriceCardUser,
      paymentCompleted,
      email
    });

    let planDurationNum = Number(planDuration)
    if (paymentCompleted && (isNaN(planDurationNum) || planDurationNum <= 0)) {
      planDurationNum = 1;
    }

    if (paymentCompleted && planDurationNum > 0) {
      // Paid Subscription
      try {
        const today = new Date()
        const endDate = new Date(today)
        endDate.setMonth(endDate.getMonth() + planDurationNum)

        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert([
            {
              id: crypto.randomUUID(),
              user_id: userId,
              start_date: today.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0]
            }
          ])
        if (subscriptionError) console.error('Error creating paid subscription:', subscriptionError)
      } catch (err) {
        console.error('Error creating paid subscription:', err)
      }
    } else if (!isNaN(effectiveTrialDays) && effectiveTrialDays !== 0) {
      // Trial Subscription
      try {
        const today = new Date()
        if (effectiveTrialDays > 0) {
          const endDate = new Date(today)
          endDate.setDate(endDate.getDate() + effectiveTrialDays)
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert([
              {
                id: crypto.randomUUID(),
                user_id: userId,
                start_date: today.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
              }
            ])
          if (subscriptionError) console.error('Error creating trial subscription:', subscriptionError)
        }
      } catch (subscriptionError) {
        console.error('Error creating trial subscription:', subscriptionError)
      }
    }

    // Auto-enable HPP for trial users (7-day free trial)
    if (!paymentCompleted && effectiveTrialDays > 0) {
      try {
        const today = new Date()
        const hppTrialEndDate = new Date(today)
        hppTrialEndDate.setDate(hppTrialEndDate.getDate() + effectiveTrialDays)

        // Insert HPP enabled setting for this user.
        // We intentionally avoid ON CONFLICT here because the table might not
        // have a composite unique constraint on (user_id, setting_key) in all envs.
        // If a duplicate row somehow exists, Postgres will raise a unique error
        // which we log but do not treat as fatal for registration.
        const { error: hppError } = await supabase
          .from('app_settings')
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            setting_key: 'hpp_enabled',
            setting_value: { enabled: true, isTrial: true, trialEndDate: hppTrialEndDate.toISOString() },
            updated_at: new Date().toISOString()
          })

        if (hppError) {
          console.error('Error enabling HPP trial:', hppError)
        } else {
          console.log('✅ HPP trial auto-enabled for user:', email, 'until', hppTrialEndDate.toISOString())
        }
      } catch (hppError) {
        console.error('Error setting HPP trial:', hppError)
      }
    }

    // Prepare user response
    const userResponse = {
      ...newUser,
      tenantId: newUser.tenant_id
    }

    const needsEmailVerification = !paymentCompleted && !isOAuthUser;

    // Send verification email for trial users if needed
    // Note: When using admin API with email_confirm: false, we need to manually send verification email
    if (needsEmailVerification && userId) {
      try {
        // Create a temporary Supabase client with anon key to use resend
        const supabaseAnon = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!
        );

        // Use resend to send verification email
        const { error: resendError } = await supabaseAnon.auth.resend({
          type: 'signup',
          email: email,
          options: {
            emailRedirectTo: `${siteUrl}/login`
          }
        });

        if (resendError) {
          console.error('Error sending verification email:', resendError);
          // Don't fail registration if email sending fails
        } else {
          console.log('✅ Verification email sent to:', email);
        }
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        // Don't fail registration if email sending fails
      }
    }

    const message = paymentCompleted
      ? `User registered successfully with paid subscription.`
      : `User registered successfully with ${effectiveTrialDays} days trial.`

    return new Response(
      JSON.stringify({
        user: userResponse,
        message,
        emailVerificationSent: needsEmailVerification, // Only trial users need verification
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  } catch (error: any) {
    console.error('Auth register error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
