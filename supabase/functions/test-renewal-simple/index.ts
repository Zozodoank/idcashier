// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import Supabase client
import { corsHeaders, handleOptions, createResponse, createErrorResponse } from '../_shared/cors.ts';
import { createSupabaseForFunction, validateAuthHeader } from '../_shared/client.ts';
import { getUserIdFromToken } from '../_shared/auth.ts';

// Plan mapping
const PLAN_MAPPING: Record<string, any> = {
  '1_month': { duration: 1, amount: 50000, productDetails: 'Perpanjangan Langganan 1 Bulan' },
  '3_months': { duration: 3, amount: 150000, productDetails: 'Perpanjangan Langganan 3 Bulan' },
  '6_months': { duration: 6, amount: 270000, productDetails: 'Perpanjangan Langganan 6 Bulan' },
  '12_months': { duration: 12, amount: 500000, productDetails: 'Perpanjangan Langganan 12 Bulan' }
};

// Main handler
Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !validateAuthHeader(authHeader)) {
      return createErrorResponse('Missing or invalid authorization header', 401);
    }

    // Parse JSON body
    let body: any;
    try {
      const text = await req.text();
      if (!text.trim()) {
        return createErrorResponse('Empty request body', 400);
      }
      body = JSON.parse(text);
    } catch (jsonError) {
      return createErrorResponse('Invalid or missing JSON body', 400);
    }
    
    // Support both plan_id and plan for backward compatibility
    const plan_id = body?.plan_id ?? body?.plan;
    if (!plan_id) {
      return createErrorResponse('Plan parameter is required', 400);
    }
    
    if (!PLAN_MAPPING[plan_id]) {
      const receivedPlanStr = plan_id ? `'${plan_id}'` : 'undefined/null';
      return createErrorResponse(`Invalid plan ${receivedPlanStr}. Must be one of: 1_month, 3_months, 6_months, 12_months`, 400);
    }

    // Create Supabase client
    let supabase;
    try {
      supabase = createSupabaseForFunction(authHeader);
    } catch (clientError) {
      return createErrorResponse('Failed to initialize database connection', 500);
    }
    
    let userId: string;
    let userData: any;

    // Extract email from body for email-based authentication
    const email = body?.email;

    if (authHeader && validateAuthHeader(authHeader)) {
      // Token-based authentication (authenticated users)
      const token = authHeader.replace('Bearer ', '');
      try {
        userId = await getUserIdFromToken(token);
      } catch (error) {
        // If token validation fails but email is provided, fall back to email-based auth
        if (email) {
          const normalizedEmail = email.trim().toLowerCase();
          const { data, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', normalizedEmail)
            .single();

          if (userError || !data) {
            return createErrorResponse('User not found', 404);
          }
          userId = data.id;
          userData = data;
        } else {
          return createErrorResponse('Invalid token', 401);
        }
      }

      // If we have a userId but no userData yet, fetch user data
      if (!userData) {
        try {
          // Fetch user data by ID using service role to bypass RLS
          const { data, error: userError } = await supabase
            .from('users')
            .select('id, name, email, role, tenant_id')
            .eq('id', userId)
            .single();

          if (userError || !data) {
            return createErrorResponse('User not found', 404);
          }
          userData = data;
        } catch (fetchError) {
          return createErrorResponse('Failed to fetch user data', 500);
        }
      }
    } else if (email) {
      // Email-based authentication (for expired users accessing renewal page)
      const normalizedEmail = email.trim().toLowerCase();
      
      try {
        // Use service role to bypass RLS when fetching user by email
        const { data, error: userError } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('email', normalizedEmail)
          .single();

        if (userError || !data) {
          return createErrorResponse('User not found', 404);
        }
        userId = data.id;
        userData = data;
      } catch (fetchError) {
        return createErrorResponse('Failed to fetch user data', 500);
      }
    } else {
      return createErrorResponse('Authentication required - please login or provide email', 401);
    }

    // Get plan data
    const planData = PLAN_MAPPING[plan_id];

    // For cashiers, use the owner's ID for subscription/payment
    let effectiveUserId = userId;
    if (userData.role === 'cashier') {
      effectiveUserId = userData.tenant_id;
    }
    
    // Generate merchant order ID
    const timestamp = Date.now();
    const merchantOrderId = `RENEWAL-${effectiveUserId}-${timestamp}`;

    // Return success response with all the data that would be used
    return createResponse({
      success: true,
      message: 'Payment request would be created successfully',
      userData: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        tenant_id: userData.tenant_id
      },
      planData: planData,
      merchantOrderId: merchantOrderId,
      effectiveUserId: effectiveUserId
    }, 200);
  } catch (error) {
    return createErrorResponse('Internal server error', 500);
  }
});