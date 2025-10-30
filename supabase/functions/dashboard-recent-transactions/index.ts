// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
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

    // Get all users in the tenant (owner + all cashiers)
    const { data: tenantUsers, error: tenantError } = await supabase
      .from('users')
      .select('id')
      .or(`id.eq.${ownerId},tenant_id.eq.${ownerId}`)
    
    if (tenantError) {
      throw tenantError
    }
    
    // Check if tenantUsers is empty
    if (!tenantUsers || tenantUsers.length === 0) {
      return new Response(
        JSON.stringify([]),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Extract user IDs
    const userIds = tenantUsers.map(user => user.id)
    
    // Check if userIds is empty
    if (!userIds || userIds.length === 0) {
      return new Response(
        JSON.stringify([]),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Build query with tenant-based filtering
    let query = supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        created_at,
        sale_items(quantity, products(name))
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(5)
    
    const { data, error } = await query
    
    if (error) {
      console.error('Recent transactions error:', error)
      throw new Error('Failed to fetch recent transactions')
    }
    
    // Format the data
    const formattedTransactions = data.map(sale => ({
      id: sale.id,
      items: sale.sale_items.length,
      total: sale.total_amount,
      date: sale.created_at
    }))
    
    return new Response(
      JSON.stringify(formattedTransactions),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Recent transactions error:', error)
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
