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
    // Parse the request body first to check if this is a payment callback registration
    const requestData = await req.json()
    const isPaymentCallback = requestData.paymentCompleted === true
    
    // Skip authorization check for payment callback registrations
    if (!isPaymentCallback) {
      // Get authorization token FIRST for normal admin registrations
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authorization token required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        )
      }

      const token = authHeader.substring(7)
      
      // Verify token and get user email
      const userEmail = await getUserEmailFromToken(token)
      
      // Only jho.j80@gmail.com can register new users through admin flow
      if (userEmail !== 'jho.j80@gmail.com') {
        return new Response(
          JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
    }

    // Create Supabase client using service role
    const supabase = createSupabaseClient()

    // Parse the request body (safe now, auth already verified)
    const { name, email, password, role = 'owner', tenant_id, permissions } = await req.json()
    
    // Validate input
    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and password are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check if user already exists
    const { data: existingUsers, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)

    if (existingError) {
      console.error(`Database error checking existing user ${email}:`, existingError)
      throw existingError
    }

    if (existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ error: 'User already exists' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409
        }
      )
    }

    // Validate permissions for cashier role
    let userPermissions = null
    if (role === 'cashier' && permissions) {
      // Validate permissions structure
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

    // Create Supabase Auth user first
    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email, or set to false if email verification is required
      user_metadata: {
        name,
        role
      }
    })

    if (createAuthError) {
      console.error(`Supabase Auth error creating user ${email}:`, createAuthError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user account: ' + createAuthError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Use the Auth user ID for consistency between auth.users and public.users
    const userId = authData.user.id
    
    // For owner, tenant_id will be set to userId (self-reference)
    // For cashier, tenant_id should be provided in request (reference to owner)
    // FK constraint has been removed to allow owner self-reference
    const userTenantId = role === 'owner' ? userId : tenant_id

    // Create user in public.users (without password field)
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          name,
          email,
          role,
          tenant_id: userTenantId,
          permissions: userPermissions
        }
      ])
      .select('id, name, email, role, tenant_id, permissions, created_at')
      .single()

    if (insertError) {
      console.error(`Database error creating user ${email}:`, insertError)
      // Rollback: delete the auth user if database insert fails
      try {
        await supabase.auth.admin.deleteUser(userId)
      } catch (deleteError) {
        console.error('Failed to rollback auth user:', deleteError)
      }
      throw insertError
    }

    // Prepare user response with tenantId
    const userResponse = {
      ...newUser,
      tenantId: newUser.tenant_id
    }

    return new Response(
      JSON.stringify({
        user: userResponse,
        message: 'User registered successfully. You can now log in with your credentials.',
        emailVerificationSent: false // Set to true if enable_confirmations is true in config
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  } catch (error) {
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