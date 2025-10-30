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

    // Get sale data from request body
    const saleData = await req.json()

    // Generate UUIDs for sale and sale items
    const saleId = crypto.randomUUID()

    // Extract custom_costs before creating sale
    const customCosts = saleData.custom_costs || []
    
    // Remove custom_costs from saleData as it's not a column in sales table
    const { custom_costs, ...saleDataWithoutCustomCosts } = saleData

    // Add user_id to sale data
    const saleWithUser = {
      ...saleDataWithoutCustomCosts,
      id: saleId,
      user_id: userId
    }

    // Process sale items
    const saleItems = saleData.sale_items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      sale_id: saleId
    }))

    // Create sale in a transaction
    const { data, error } = await supabase
      .from('sales')
      .insert([saleWithUser])
      .select()
      .single()

    if (error) {
      throw new Error(error.message || 'Failed to create sale')
    }

    // Create sale items
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      throw new Error(itemsError.message || 'Failed to create sale items')
    }

    // Create custom costs if any
    if (customCosts.length > 0) {
      const customCostRecords = customCosts.map(cost => ({
        id: crypto.randomUUID(),
        sale_id: saleId,
        label: cost.label,
        amount: cost.amount
      }))

      const { error: costsError } = await supabase
        .from('sale_custom_costs')
        .insert(customCostRecords)

      if (costsError) {
        console.error('Failed to create custom costs:', costsError)
        // Don't fail the whole transaction, just log the error
      }
    }

    // Return the complete sale with items
    const { data: completeSale, error: fetchError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items(*)
      `)
      .eq('id', saleId)
      .single()

    if (fetchError) {
      throw new Error(fetchError.message || 'Failed to fetch created sale')
    }

    return new Response(
      JSON.stringify(completeSale),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  } catch (error) {
    console.error('Sale creation error:', error)
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