// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'

// Helper function to create JSON responses with CORS headers
function json(payload: any, status = 200, origin = '*') {
  const corsHeaders = getCorsHeaders(origin);
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(origin);
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ 
        success: false, 
        error: 'Missing authorization header',
        code: 401
      }, 401, origin);
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
      return json({
        success: false,
        error: 'User not found',
        code: 404
      }, 404, origin);
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
      return json({
        success: false,
        error: 'Failed to fetch subscription data',
        details: error.message,
        code: 500
      }, 500, origin);
    }
    
    if (subscriptions.length === 0) {
      // If no subscription found, return null to indicate no subscription
      return json({
        success: true,
        data: {
          user_id: userId,
          has_subscription: false,
          message: 'No active subscription found'
        }
      }, 200, origin);
    }
    
    const subscription = subscriptions[0];
    const today = new Date();
    const endDate = new Date(subscription.end_date);
    const isActive = endDate >= today;
    
    return json({
      success: true,
      data: {
        ...subscription,
        is_active: isActive,
        has_subscription: true
      }
    }, 200, origin);
  } catch (error) {
    console.error('Get subscription error:', error);
    // Return proper error instead of default subscription
    return json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      code: 500
    }, 500, origin);
  }
});