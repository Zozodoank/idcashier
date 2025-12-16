// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'

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
    const userId = getUserIdFromToken(token)

    // Get supplier ID from URL
    const url = new URL(req.url)
    const supplierId = url.searchParams.get('id')

    if (!supplierId) {
      return new Response(
        JSON.stringify({ error: 'Supplier ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Get supplier data from request body
    const { name, email, phone, address } = await req.json()

    // Update supplier
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        name,
        email,
        phone,
        address
      })
      .eq('id', supplierId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Database error updating supplier ${supplierId} for user ${userId}:', error)
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