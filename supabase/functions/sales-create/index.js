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
    console.log('Getting user ID from token...')
    const userId = await getUserIdFromToken(token)
    console.log('User ID obtained:', userId)

    // Get sale data from request body
    console.log('Parsing request body...')
    const saleData = await req.json()
    console.log('Sale data received:', { ...saleData, sale_items: saleData.sale_items?.length + ' items' })

    // Generate UUIDs for sale and sale items
    console.log('Generating sale UUID...')
    const saleId = crypto.randomUUID()
    console.log('Sale UUID generated:', saleId)

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
    console.log('Processing sale items:', saleData.sale_items.length)
    const saleItems = saleData.sale_items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      sale_id: saleId
    }))

    console.log('Sale items to insert:', saleItems)

    // Create sale in a transaction
    console.log('Creating sale record...')
    const { data, error } = await supabase
      .from('sales')
      .insert([saleWithUser])
      .select()
      .single()

    if (error) {
      console.error('Sale creation failed:', error)
      throw new Error(error.message || 'Failed to create sale')
    }

    console.log('Sale created successfully:', data.id)

    // Create sale items
    console.log('Creating sale items...')
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      console.error('Sale items creation failed:', itemsError)
      console.error('Items that failed:', saleItems)
      throw new Error(itemsError.message || 'Failed to create sale items')
    }

    console.log('Sale items created successfully')

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