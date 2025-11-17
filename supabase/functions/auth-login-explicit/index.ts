// Auth-login function with explicit authorization handling
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Explicitly handle authorization header to bypass Supabase's automatic checking
  const authHeader = req.headers.get('Authorization');
  
  // We don't require authorization for this function, so we'll ignore it
  // but we need to acknowledge its presence to prevent the "Missing authorization header" error
  
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

    // Get user profile from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, tenant_id, permissions, created_at')
      .eq('email', normalizedEmail)
      .single()

    if (userError) {
      console.error('Error fetching user profile:', userError)
      
      // If user exists in auth but not in public.users, create the entry
      if (userError.code === 'PGRST116') { // No rows returned
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

        // Subscription check for new user (though unlikely to have subscription)
        // Special handling for test account - should always be treated as expired
        if (normalizedEmail === 'testing@idcashier.my.id') {
          return new Response(
            JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.', subscriptionExpired: true }),
            {
              headers: corsHeaders,
              status: 403
            }
          );
        } else if (normalizedEmail !== 'demo@idcashier.my.id' && normalizedEmail !== 'jho.j80@gmail.com') {
          let effectiveUserId = newUserData.id;
          if (newUserData.role === 'cashier') {
            effectiveUserId = newUserData.tenant_id;
          }
          const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', effectiveUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (subscription) {
            // Normalize dates to start of day (date-only) to avoid timezone boundary issues
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = new Date(subscription.end_date);
            endDate.setHours(0, 0, 0, 0);
            // Treat end_date as inclusive - subscription expires at end of day
            // Add one day to end_date before comparing to treat it as inclusive
            const endDateInclusive = new Date(endDate);
            endDateInclusive.setDate(endDateInclusive.getDate() + 1);
            if (today >= endDateInclusive) {
              return new Response(
                JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.', subscriptionExpired: true }),
                {
                  headers: corsHeaders,
                  status: 403
                }
              );
            }
          }
        }

        const userResponse = {
          ...newUserData,
          tenantId: newUserData.tenant_id
        }

        // Return user, token, and session info for proper client-side session management
        return new Response(
          JSON.stringify({
            user: userResponse,
            token: authData.session.access_token,
            session: {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
              expires_at: authData.session.expires_at,
              expires_in: authData.session.expires_in
            },
            message: 'Login successful'
          }),
          { 
            headers: corsHeaders,
            status: 200
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

    // Subscription check
    // Special handling for test account - should always be treated as expired
    if (normalizedEmail === 'testing@idcashier.my.id') {
      return new Response(
        JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.', subscriptionExpired: true }),
        {
          headers: corsHeaders,
          status: 403
        }
      );
    } else if (normalizedEmail !== 'demo@idcashier.my.id' && normalizedEmail !== 'jho.j80@gmail.com') {
      let effectiveUserId = userData.id;
      if (userData.role === 'cashier') {
        effectiveUserId = userData.tenant_id;
      }
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subscription) {
        // Normalize dates to start of day (date-only) to avoid timezone boundary issues
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(subscription.end_date);
        endDate.setHours(0, 0, 0, 0);
        // Treat end_date as inclusive - subscription expires at end of day
        // Add one day to end_date before comparing to treat it as inclusive
        const endDateInclusive = new Date(endDate);
        endDateInclusive.setDate(endDateInclusive.getDate() + 1);
        if (today >= endDateInclusive) {
          return new Response(
            JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.', subscriptionExpired: true }),
            {
              headers: corsHeaders,
              status: 403
            }
          );
        }
      }
    }

    const userResponse = {
      ...userData,
      tenantId: userData.tenant_id
    }

    // Return user, token, and session info for proper client-side session management
    return new Response(
      JSON.stringify({
        user: userResponse,
        token: authData.session.access_token,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in
        },
        message: 'Login successful'
      }),
      { 
        headers: corsHeaders,
        status: 200
      }
    )

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