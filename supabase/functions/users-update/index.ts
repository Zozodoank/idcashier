// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken, getUserEmailFromToken } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization token required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Extract token
    const token = authHeader.substring(7)
    
    // Create Supabase client
    const supabase = createSupabaseClient()

    // Get user ID and email from token
    const userId = await getUserIdFromToken(token)
    const userEmail = await getUserEmailFromToken(token)

    // Get user ID from URL
    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('id')

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Get user data from request body
    const { name, email, role, password, permissions } = await req.json()

    // If password is provided, update it in Supabase Auth
    if (password) {
      // Create Supabase client with service role for admin operations
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password }
      )
      
      if (authError) {
        console.error(`Supabase Auth error updating password for user ${targetUserId}:`, authError)
        return new Response(
          JSON.stringify({ error: 'Failed to update password: ' + authError.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }
    }

    // Prepare update data for public.users
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (permissions !== undefined) updateData.permissions = permissions

    // Check if user is admin
    const isAdmin = userEmail === 'jho.j80@gmail.com'

    // Update user in public.users
    let data, error
    if (isAdmin) {
      // Admin can update any user without tenant_id filter
      const result = await supabase
        .from('users')
        .update(updateData)
        .eq('id', targetUserId)
        .select()
        .single()
      
      data = result.data
      error = result.error
    } else {
      // Non-admin can only update users in their tenant
      const result = await supabase
        .from('users')
        .update(updateData)
        .eq('id', targetUserId)
        .eq('tenant_id', userId)
        .select()
        .single()
      
      data = result.data
      error = result.error
    }
    
    if (error) {
      console.error(`Database error updating user ${targetUserId} for user ${userId}:`, error)
      throw error
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Users-update error:', error)
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