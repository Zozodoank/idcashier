// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'

// Helper function to check subscription status
async function checkSubscription(supabase: SupabaseClient, user: any, authUser: any = null) {
  const { id, role, tenant_id, email } = user;
  
  // Check if user email is confirmed first
  const isEmailConfirmed = authUser?.email_confirmed_at;
  
  // Check if user has completed payment (paid user)
  const paymentCompleted = authUser?.user_metadata?.payment_completed;
  const isPaidUser = paymentCompleted || isEmailConfirmed;
  
  // If email is not confirmed AND user is not paid, user should verify email first
  if (!isEmailConfirmed && !paymentCompleted) {
    return {
      data: {
        subscriptionExpired: true,
        daysRemaining: 0,
        hasSubscription: false,
        emailNotConfirmed: true,
        isPaidUser: false,
        message: 'Email not verified. Please verify your email before accessing the application.'
      }
    };
  }
  
  // Accounts that bypass subscription checks
  const bypassEmails = ['demo@idcashier.com', 'jho.j80@gmail.com'];
  if (bypassEmails.includes(email)) {
    return {
      data: {
        subscriptionExpired: false,
        daysRemaining: Infinity,
        hasSubscription: true,
        emailNotConfirmed: false,
        isPaidUser: true
      }
    };
  }
  
  // For paid users, skip subscription check and mark as active
  if (isPaidUser) {
    return {
      data: {
        subscriptionExpired: false,
        daysRemaining: Infinity,
        hasSubscription: true,
        emailNotConfirmed: false,
        isPaidUser: true,
        message: 'Paid user - full access granted'
      }
    };
  }
  
  // The user ID to check for the subscription
  const effectiveUserId = role === 'cashier' ? tenant_id : id;

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('user_id', effectiveUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !subscription) {
    // If no subscription found, treat as expired
    return {
      data: {
        subscriptionExpired: true,
        daysRemaining: 0,
        hasSubscription: false,
        emailNotConfirmed: false,
        isPaidUser: false,
        message: 'No active subscription found. Please subscribe to continue.'
      }
    };
  }

  // Calculate days remaining
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(subscription.end_date);
  endDate.setHours(0, 0, 0, 0);

  const timeDiff = endDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  const subscriptionExpired = daysRemaining < 0;

  return {
    data: {
      subscriptionExpired,
      daysRemaining,
      hasSubscription: true,
      emailNotConfirmed: false,
      isPaidUser: false,
      message: subscriptionExpired ? 'Your subscription has expired. Please renew to continue.' : null
    }
  };
}


Deno.serve(async (req) => {
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const { email, password } = await req.json()
    
    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          headers: corsHeaders,
          status: 400
        }
      )
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase()

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Login via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password
    })

    if (authError) {
      console.error(`Supabase Auth login failed for ${normalizedEmail}:`, authError.message)
      
      // Provide specific error messages based on the error
      let errorMessage = 'Invalid email or password'
      
      if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
        errorMessage = 'Please confirm your email before logging in. Check your inbox for the confirmation link.'
      } else if (authError.message.includes('Invalid login credentials') || authError.message.includes('invalid_credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.'
      } else if (authError.message.includes('User not found')) {
        errorMessage = 'No account found with this email address.'
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: authError.message // Include original error for debugging
        }),
        { 
          headers: corsHeaders,
          status: 401
        }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { 
          headers: corsHeaders,
          status: 401
        }
      )
    }

    // Get user profile from users table with timeout protection
    let userData
    try {
      // Create abort signal for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', normalizedEmail)
        .abortSignal(controller.signal)
        .maybeSingle()
      
      clearTimeout(timeoutId)
      
      if (error) {
        console.error('Error fetching user profile:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user profile' }),
          { 
            headers: corsHeaders,
            status: 500
          }
        )
      }

      userData = data
    } catch (fetchError) {
      console.error('User profile fetch error:', fetchError)
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'User profile fetch timeout - check RLS policies' }),
          { 
            headers: corsHeaders,
            status: 500
          }
        )
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { 
          headers: corsHeaders,
          status: 500
        }
      )
    }

    // If user exists in auth but not in public.users, create the entry
    if (!userData) {
      console.log('User exists in Auth but not in public.users, creating profile...')
      
      const { data: newUserData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User',
            email: normalizedEmail,
            role: authData.user.user_metadata?.role || 'owner',
            tenant_id: authData.user.id, // Self-referencing for owner
            permissions: null
          }
        ])
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .single()

      if (insertError) {
        console.error('Error creating user profile:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user profile' }),
          { 
            headers: corsHeaders,
            status: 500
          }
        )
      }

      // Check subscription status for the new user
      const { data: subscriptionStatus } = await checkSubscription(supabase, newUserData, authData.user);

      const userResponse = {
        ...newUserData,
        email_confirmed_at: authData.user.email_confirmed_at,
        user_metadata: authData.user.user_metadata,
        tenantId: newUserData.tenant_id
      };

      // Return user, token, session, and subscription status
      return new Response(
        JSON.stringify({
          user: userResponse,
          token: authData.session.access_token,
          session: authData.session,
          message: 'Login successful',
          ...subscriptionStatus
        }),
        { 
          headers: corsHeaders,
          status: 200
        }
      );
    }

    // Check subscription status
    const { data: subscriptionStatus } = await checkSubscription(supabase, userData, authData.user);

    const userResponse = {
      ...userData,
      email_confirmed_at: authData.user.email_confirmed_at,
      user_metadata: authData.user.user_metadata,
      tenantId: userData.tenant_id
    };

    // Return user, token, session info, and subscription status
    return new Response(
      JSON.stringify({
        user: userResponse,
        token: authData.session.access_token,
        session: authData.session,
        message: 'Login successful',
        ...subscriptionStatus
      }),
      { 
        headers: corsHeaders,
        status: 200
      }
    );

  } catch (error) {
    console.error('Unexpected error in auth-login function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: corsHeaders,
        status: 500
      }
    )
  }
})
