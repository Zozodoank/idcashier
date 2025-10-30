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

    // Extract token (in a real implementation, you would verify the JWT)
    const token = authHeader.substring(7)
    
    // For demo purposes, we'll assume the token contains the user ID
    // In a real implementation, you would decode and verify the JWT
    const userId = token // Simplified for demo

    // Get the product ID from the URL
    const url = new URL(req.url)
    const productId = url.pathname.split('/').pop()
    
    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Update product
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', productId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Database error updating product ${productId} for user ${userId}:', error)
      throw error
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
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