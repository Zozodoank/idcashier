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

    // Get user email to check for test account
    const { data: userWithEmail, error: emailError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (emailError || !userWithEmail) {
      return createErrorResponse('User not found', 404);
    }

        // Special handling for test account - should always be treated as expired
    if (userWithEmail.email === 'testing@idcashier.my.id') {
      // Return expired subscription for test account
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 7); // 7 days ago
      return createResponse({
        user_id: userId,
        has_subscription: true,
        is_active: false,
        plan_name: '1_month',
        duration: 1,
        amount: 50000,
        start_date: expiredDate.toISOString().split('T')[0],
        end_date: expiredDate.toISOString().split('T')[0],
        status: 'expired',
        created_at: expiredDate.toISOString(),
        updated_at: expiredDate.toISOString()
      });
    } else if (userWithEmail.email === 'demo@idcashier.my.id' || userWithEmail.email === 'jho.j80@gmail.com') {
      // Always return active subscription for demo and dev accounts
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      return createResponse({
        user_id: userId,
        has_subscription: true,
        is_active: true,
        plan_name: 'developer',
        duration: 12,
        amount: 0,
        start_date: new Date().toISOString().split('T')[0],
        end_date: futureDate.toISOString().split('T')[0],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

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