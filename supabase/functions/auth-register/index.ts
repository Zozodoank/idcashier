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
    const { name, email, password, role = 'owner', tenant_id, permissions, trialDays } = await req.json()
    
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

    // Soft-check existing user (both Auth and public)
    const { data: existingPublic, error: existingPublicErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
    if (existingPublicErr) {
      console.error(`Database error checking existing public user ${email}:`, existingPublicErr)
      throw existingPublicErr
    }

    // Try find existing auth user by email
    const { data: existingAuth, error: existingAuthErr } = await supabase
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single()
    // Note: if not found, existingAuthErr may be set; we'll ignore 'no rows' error safely below
    const existingAuthId = existingAuth?.id as string | undefined;

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

    // Ensure Supabase Auth user
    let userId: string
    if (existingAuthId) {
      // Update password to ensure login works
      const { error: updPwdErr } = await supabase.auth.admin.updateUserById(existingAuthId, {
        password,
      })
      if (updPwdErr) {
        console.error(`Supabase Auth error updating password ${email}:`, updPwdErr)
        return new Response(
          JSON.stringify({ error: 'Failed to update user password: ' + updPwdErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      userId = existingAuthId
    } else {
      const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role }
      })
      if (createAuthError || !authData?.user?.id) {
        console.error(`Supabase Auth error creating user ${email}:`, createAuthError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user account: ' + (createAuthError?.message || 'Unknown error') }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      userId = authData.user.id
    }
    
    // For owner, tenant_id will be set to userId (self-reference)
    // For cashier, tenant_id should be provided in request (reference to owner)
    // FK constraint has been removed to allow owner self-reference
    const userTenantId = role === 'owner' ? userId : tenant_id

    // Upsert user in public.users (id is the conflict target)
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
      // Jangan hapus auth user; cukup kembalikan error jelas
      return new Response(
        JSON.stringify({ error: 'Failed to create user account: Database error creating/updating user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create trial subscription if trialDays is provided (supports negative for expired trials)
    if (typeof trialDays === 'number' && trialDays !== 0) {
      try {
        const today = new Date()
        if (trialDays > 0) {
          const endDate = new Date(today)
          endDate.setDate(endDate.getDate() + trialDays)
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
        } else {
          // expired: start |trialDays| days ago, end yesterday
          const start = new Date(today)
          start.setDate(start.getDate() + trialDays) // trialDays negative
          const end = new Date(today)
          end.setDate(end.getDate() - 1)
          // cleanup existing
          await supabase.from('subscriptions').delete().eq('user_id', userId)
          const { error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert([
              {
                id: crypto.randomUUID(),
                user_id: userId,
                start_date: start.toISOString().split('T')[0],
                end_date: end.toISOString().split('T')[0]
              }
            ])
          if (subscriptionError) console.error('Error creating expired trial:', subscriptionError)
        }
      } catch (subscriptionError) {
        console.error('Error creating trial subscription:', subscriptionError)
      }
    }

    // Prepare user response with tenantId
    const userResponse = {
      ...newUser,
      tenantId: newUser.tenant_id
    }

    const message = trialDays 
      ? `User registered successfully with ${trialDays} days trial. You can now log in with your credentials.`
      : 'User registered successfully. You can now log in with your credentials.'

    return new Response(
      JSON.stringify({
        user: userResponse,
        message,
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