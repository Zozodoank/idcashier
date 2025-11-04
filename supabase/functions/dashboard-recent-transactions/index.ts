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
    
    return createResponse(formattedTransactions)
  } catch (error) {
    console.error('Recent transactions error:', error)
    return createErrorResponse('Internal server error', 500)
  }
})