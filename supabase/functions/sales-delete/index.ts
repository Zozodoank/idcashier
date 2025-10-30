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
    const userId = await getUserIdFromToken(token, supabase)

    // Get sale ID from URL
    const url = new URL(req.url)
    const saleId = url.searchParams.get('id')

    if (!saleId) {
      return new Response(
        JSON.stringify({ error: 'Sale ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Delete sale items first (due to foreign key constraint)
    const { error: itemsError } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId)

    if (itemsError) {
      throw new Error(itemsError.message || 'Failed to delete sale items')
    }

    // Delete sale
    const { data, error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      // Create more descriptive error messages based on error content
      let errorMessage = 'Failed to delete sale'
      
      // Handle specific error cases
      if (error.message && error.message.includes('Invalid input')) {
        errorMessage = 'Data input tidak valid.'
      } else {
        errorMessage = error.message || 'Gagal menghapus penjualan.'
      }
      
      throw new Error(errorMessage)
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Sale deletion error:', error)
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