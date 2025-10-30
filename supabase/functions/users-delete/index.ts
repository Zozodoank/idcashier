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

    // Get user ID from URL query params
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

    // Check if target user is demo user
    const { data: targetUserData, error: targetUserError } = await supabase
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .single()

    if (targetUserError) {
      console.error(`Error fetching target user ${targetUserId}:`, targetUserError)
      throw new Error('User not found')
    }

    // Prevent deleting demo user
    if (targetUserData.email === 'demo@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Cannot delete demo user' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Check if user is admin
    const isAdmin = userEmail === 'jho.j80@gmail.com'

    // Delete user from public.users
    let data, error
    if (isAdmin) {
      // Admin can delete any user without tenant_id filter
      const result = await supabase
        .from('users')
        .delete()
        .eq('id', targetUserId)
        .select()
        .single()
      
      data = result.data
      error = result.error
    } else {
      // Non-admin can only delete users in their tenant
      const result = await supabase
        .from('users')
        .delete()
        .eq('id', targetUserId)
        .eq('tenant_id', userId)
        .select()
        .single()
      
      data = result.data
      error = result.error
    }
    
    if (error) {
      console.error(`Database error deleting user ${targetUserId} for user ${userId}:`, error)
      throw error
    }

    // Delete user from Supabase Auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
    
    if (authError) {
      console.error(`Supabase Auth error deleting user ${targetUserId}:`, authError)
      // Don't throw error here, as the user is already deleted from public.users
      // Just log the error
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Users-delete error:', error)
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