// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { createResponse, createErrorResponse } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 
      'Access-Control-Allow-Origin': 'https://idcashier.my.id',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    } });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Missing authorization header', 401);
    }

    // Extract token
    const token = authHeader.substring(7);
    
    // Create Supabase client with service role key to bypass RLS
    const supabase = createSupabaseClient();

    // Get user ID from token (now properly awaited)
    let userId = await getUserIdFromToken(token);

    // For cashiers, use the owner's subscription (tenantId)
    // First get user role and tenantId
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return createErrorResponse('User not found', 404);
    }

    // If user is a cashier, use the owner's ID for subscription
    if (userData.role === 'cashier') {
      userId = userData.tenant_id;
    }
    
    // Get subscription for the user (or owner if cashier)
    // Use service role to bypass RLS restrictions
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)  // Use owner's ID for cashiers
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Subscription query error:', error);
      // Return proper error instead of default subscription
      return createErrorResponse('Failed to fetch subscription data', 500);
    }
    
    if (subscriptions.length === 0) {
      // If no subscription found, return null to indicate no subscription
      return createResponse({
        user_id: userId,
        has_subscription: false,
        message: 'No active subscription found'
      });
    }
    
    const subscription = subscriptions[0];
    const today = new Date();
    const endDate = new Date(subscription.end_date);
    const isActive = endDate >= today;
    
    return createResponse({
      ...subscription,
      is_active: isActive,
      has_subscription: true
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    // Return proper error instead of default subscription
    return createErrorResponse('Internal server error', 500);
  }
});