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

    // Extract token (in a real implementation, you would verify the JWT)
    const token = authHeader.substring(7)
    
    // For demo purposes, we'll assume the token contains the user ID
    // In a real implementation, you would decode and verify the JWT
    const userId = token // Simplified for demo

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user profile from users table
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, tenant_id, permissions, created_at')
      .eq('id', userId)
    
    if (error) {
      console.error('Database error for user ${userId}:', error)
      throw error
    }

    if (users.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    const user = users[0]
    
    // Include tenant_id as tenantId in response
    const userResponse = {
      ...user,
      tenantId: user.tenant_id
    }

    return new Response(
      JSON.stringify({ user: userResponse }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})