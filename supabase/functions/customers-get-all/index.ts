// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken, getTenantOwnerId } from '../_shared/auth.ts'

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

    // Get user ID from token
    let userId: string
    try {
      userId = await getUserIdFromToken(token, supabase)
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Get tenant owner ID (works for both owner and cashier)
    let ownerId: string
    try {
      ownerId = await getTenantOwnerId(supabase, userId)
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to resolve tenant' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Fetch customers for this tenant
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', ownerId)
    
    if (error) {
      console.error('Database error fetching customers for user ${userId}:', error)
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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})