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
    // Parse the request body
    const productData = await req.json()
    
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

    // Validate input
    if (!productData.name || !productData.price || !productData.cost) {
      return new Response(
        JSON.stringify({ error: 'Name, price, and cost are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

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

    // Get tenant owner ID (cashier creates products for owner)
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

    // Add user_id to product data (use ownerId so cashier creates for owner)
    const productWithUser = {
      ...productData,
      user_id: ownerId,
      id: crypto.randomUUID() // Generate UUID for the product
    }

    // Create product
    const { data, error } = await supabase
      .from('products')
      .insert([productWithUser])
      .select()
      .single()
    
    if (error) {
      console.error('Database error creating product for user ${userId}:', error)
      throw error
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
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