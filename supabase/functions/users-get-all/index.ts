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

    // Check if user is admin
    const isAdmin = userEmail === 'jho.j80@gmail.com'

    let data, error
    
    if (isAdmin) {
      // Admin can see all users with role 'owner' or 'admin'
      const result = await supabase
        .from('users')
        .select('*')
        .in('role', ['owner', 'admin'])
        .order('created_at', { ascending: false })
      
      data = result.data
      error = result.error
    } else {
      // Non-admin users see only their tenant users
      const result = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', userId)
      
      data = result.data
      error = result.error
    }
    
    if (error) {
      console.error(`Database error fetching users for user ${userId}:`, error)
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
    console.error('Users-get-all error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})