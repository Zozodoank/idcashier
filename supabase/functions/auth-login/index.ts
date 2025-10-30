// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      console.error('Supabase Auth login failed for ${normalizedEmail}:', authError.message)
      
      // Provide specific error messages based on the error
      let errorMessage = 'Invalid credentials'
      
      if (authError.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email before logging in. Check your inbox for the confirmation link.'
      } else if (authError.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            }
          )
        }

        const userResponse = {
          ...newUserData,
          tenantId: newUserData.tenant_id
        }

        return new Response(
          JSON.stringify({
            user: userResponse,
            token: authData.session.access_token,
            message: 'Login successful'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    const userResponse = {
      ...userData,
      tenantId: userData.tenant_id
    }

    return new Response(
      JSON.stringify({
        user: userResponse,
        token: authData.session.access_token,
        message: 'Login successful'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})