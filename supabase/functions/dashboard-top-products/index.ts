// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleOptions, createResponse, createErrorResponse } from '../_shared/cors.ts'
import { createSupabaseForFunction, validateAuthHeader } from '../_shared/client.ts'
import { createSupabaseClient, getUserIdFromToken, getTenantOwnerId } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return handleOptions(req)
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!validateAuthHeader(authHeader)) {
      // Handle OPTIONS request for CORS
      if (req.method === 'OPTIONS') {
        return handleOptions(req);
      }
      return createErrorResponse('Authorization token required', 401)
    }

    // Extract token
    const token = authHeader.substring(7)
    
    // Create Supabase client
    const supabase = createSupabaseForFunction(authHeader)

    // Get user ID from token
    let userId: string
    try {
      userId = await getUserIdFromToken(token);
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401)
    }

    // Get tenant owner ID (works for both owner and cashier)
    let ownerId: string
    try {
      ownerId = await getTenantOwnerId(supabase, userId)
    } catch (error) {
      return createErrorResponse('Failed to resolve tenant', 401)
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
      return createResponse([])
    }

    // Extract user IDs
    const userIds = tenantUsers.map(user => user.id)
    
    // Check if userIds is empty
    if (!userIds || userIds.length === 0) {
      return createResponse([])
    }

    // Get sales data with tenant-based filtering
    let salesQuery = supabase
      .from('sales')
      .select(`
        sale_items(quantity, products(name))
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
    
    const { data: salesData, error: salesError } = await salesQuery
    
    if (salesError) {
      console.error('Top products error:', salesError)
      throw new Error('Failed to fetch top products')
    }
    
    // Calculate top products based on quantity sold
    const productSales = {}
    salesData.forEach(sale => {
      sale.sale_items.forEach(item => {
        const productName = item.products?.name || 'Unknown Product'
        if (!productSales[productName]) {
          productSales[productName] = 0
        }
        productSales[productName] += item.quantity
      })
    })
    
    // Convert to array and sort
    const topProductsList = Object.entries(productSales)
      .map(([name, sold]) => ({ name, sold }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
    
    return createResponse(topProductsList)
  } catch (error) {
    console.error('Top products error:', error)
    return createErrorResponse('Internal server error', 500)
  }
})