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
    let userId;
    try {
      userId = await getUserIdFromToken(token, supabase);
    } catch (authError) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    // Get tenant owner ID (works for both owner and cashier)
    let ownerId;
    try {
      ownerId = await getTenantOwnerId(supabase, userId);
    } catch (ownerError) {
      return new Response(
        JSON.stringify({ error: 'Failed to resolve tenant' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
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
        JSON.stringify({ 
          totalProducts: 0,
          totalCategories: 0,
          totalSuppliers: 0,
          totalCustomers: 0,
          totalUsers: 0, 
          totalTransactions: 0, 
          totalSales: 0, 
          growth: '0%' 
        }),
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
        JSON.stringify({ 
          totalProducts: 0,
          totalCategories: 0,
          totalSuppliers: 0,
          totalCustomers: 0,
          totalUsers: 0, 
          totalTransactions: 0, 
          totalSales: 0, 
          growth: '0%' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Build queries with tenant-based filtering
    let productQuery = supabase.from('products').select('*', { count: 'exact', head: true }).in('user_id', userIds)
    let categoryQuery = supabase.from('categories').select('*', { count: 'exact', head: true }).in('user_id', userIds)
    let supplierQuery = supabase.from('suppliers').select('*', { count: 'exact', head: true }).in('user_id', userIds)
    let customerQuery = supabase.from('customers').select('*', { count: 'exact', head: true }).in('user_id', userIds)
    let userQuery = supabase.from('users').select('*', { count: 'exact', head: true }).or(`id.eq.${userId},tenant_id.eq.${userId}`)
    let salesQuery = supabase.from('sales').select('total_amount').in('user_id', userIds)
    
    // Execute all queries in parallel
    const [productResult, categoryResult, supplierResult, customerResult, userResult, salesResult] = await Promise.all([
      productQuery,
      categoryQuery,
      supplierQuery,
      customerQuery,
      userQuery,
      salesQuery
    ])
    
    const { count: productCount, error: productError } = productResult
    const { count: categoryCount, error: categoryError } = categoryResult
    const { count: supplierCount, error: supplierError } = supplierResult
    const { count: customerCount, error: customerError } = customerResult
    const { count: userCount, error: userError } = userResult
    const { data: salesData, error: salesError } = salesResult
    
    // Check for errors
    if (productError || categoryError || supplierError || customerError || userError || salesError) {
      const errors = [productError, categoryError, supplierError, customerError, userError, salesError].filter(Boolean)
      console.error('Dashboard stats errors:', errors)
      throw new Error('Failed to fetch dashboard statistics')
    }
    
    // Calculate sales statistics
    const totalTransactions = salesData?.length || 0
    const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0
    
    // Calculate growth (simplified - in a real app, you'd compare to previous period)
    const growth = totalTransactions > 0 ? Math.min(100, Math.round((totalTransactions / 10) * 12)) : 0
    
    return new Response(
      JSON.stringify({
        totalProducts: productCount || 0,
        totalCategories: categoryCount || 0,
        totalSuppliers: supplierCount || 0,
        totalCustomers: customerCount || 0,
        totalUsers: userCount || 0,
        totalTransactions: totalTransactions,
        totalSales: totalSales,
        growth: `${growth}%`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
