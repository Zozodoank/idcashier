// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import Supabase client
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, handleOptions, createResponse, createErrorResponse } from '../_shared/cors.ts';
import { createSupabaseForFunction, validateAuthHeader } from '../_shared/client.ts';
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts';

// Type definitions
interface PlanData {
  duration: number;
  amount: number;
  productDetails: string;
}

interface DuitkuResponse {
  success: boolean;
  paymentUrl?: string;
  reference?: string;
  errorMessage?: string;
}

// Logger utility with sensitive data redaction
const logger = {
  info: (message: string, data?: any) => {
    // Redact sensitive fields
    const sanitizedData = data ? sanitizeLogData(data) : '';
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, sanitizedData);
  },
  error: (message: string, error?: any) => {
    // Redact sensitive fields
    const sanitizedError = error ? sanitizeLogData(error) : '';
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, sanitizedError);
  },
  warn: (message: string, data?: any) => {
    // Redact sensitive fields
    const sanitizedData = data ? sanitizeLogData(data) : '';
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, sanitizedData);
  }
};

// Utility function to redact sensitive data from logs
function sanitizeLogData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Clone the object to avoid mutating the original
  const sanitized = Array.isArray(obj) ? [...obj] : {...obj};
  
  // Fields to redact
  const sensitiveFields = ['authorization', 'apikey', 'merchantCode', 'merchantKey', 'signature', 'password'];
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    } else if (typeof sanitized[key] === 'string' && 
               (key.toLowerCase().includes('email') || key.toLowerCase().includes('phone'))) {
      // Mask email and phone numbers
      sanitized[key] = maskSensitiveString(sanitized[key]);
    }
  }
  
  return sanitized;
}

// Mask sensitive strings like emails and phone numbers
function maskSensitiveString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  // For emails: keep first char and domain
  if (str.includes('@')) {
    const [local, domain] = str.split('@');
    if (local.length > 1) {
      return `${local[0]}***@${domain}`;
    }
    return `***@${domain}`;
  }
  
  // For phone numbers: keep last 3 digits
  if (/^\+?[0-9\s\-\(\)]+$/.test(str)) {
    const digits = str.replace(/\D/g, '');
    if (digits.length > 3) {
      return `***${digits.slice(-3)}`;
    }
    return '***';
  }
  
  return str;
}

// Plan mapping
const PLAN_MAPPING: Record<string, PlanData> = {
  '1_month': { duration: 1, amount: 50000, productDetails: 'Perpanjangan Langganan 1 Bulan' },
  '3_months': { duration: 3, amount: 150000, productDetails: 'Perpanjangan Langganan 3 Bulan' },
  '6_months': { duration: 6, amount: 270000, productDetails: 'Perpanjangan Langganan 6 Bulan' },
  '12_months': { duration: 12, amount: 500000, productDetails: 'Perpanjangan Langganan 12 Bulan' }
};

// Duitku API integration
const createDuitkuPayment = async (
  merchantOrderId: string,
  paymentAmount: number,
  productDetails: string,
  customerVaName: string,
  customerEmail: string,
  customerPhone: string
): Promise<DuitkuResponse> => {
  try {
    // Resolve Duitku configuration from environment (sandbox or production)
    // Standardized environment variable names
    const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'sandbox').toLowerCase();
    const DUITKU_MERCHANT_CODE = Deno.env.get('DUITKU_MERCHANT_CODE') || '';
    const DUITKU_MERCHANT_KEY = Deno.env.get('DUITKU_MERCHANT_KEY') || '';
    
    // Derive base URL from environment
    const DUITKU_BASE_URL = ENV === 'production' 
      ? (Deno.env.get('DUITKU_BASE_URL') || 'https://passport.duitku.com')
      : (Deno.env.get('DUITKU_BASE_URL') || 'https://sandbox.duitku.com');
    
    const ACTIVE_MERCHANT = DUITKU_MERCHANT_CODE;
    const ACTIVE_API_KEY = DUITKU_MERCHANT_KEY;
    const ACTIVE_BASE_URL = DUITKU_BASE_URL;

    const DUITKU_URL = `${ACTIVE_BASE_URL}/webapi/api/merchant/v2/inquiry`;
    
    if (!ACTIVE_MERCHANT || !ACTIVE_API_KEY) {
      logger.error('Missing Duitku configuration', { 
        merchantCodePresent: !!ACTIVE_MERCHANT, 
        merchantKeyPresent: !!ACTIVE_API_KEY,
        environment: ENV 
      });
      return {
        success: false,
        errorMessage: 'Duitku configuration missing'
      };
    }
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://idcashier.my.id';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    
    // Prepare data for Duitku API
    const duitkuRequestData: any = {
      merchantCode: ACTIVE_MERCHANT,
      merchantOrderId,
      paymentAmount,
      productDetails,
      customerVaName,
      customerEmail,
      customerPhone,
      paymentMethod: 'ALL', // ALL = All payment methods
      callbackUrl: `${SUPABASE_URL}/functions/v1/duitku-callback`,
      returnUrl: `${FRONTEND_URL}/payment-callback?renewal=1`
    };
    
    // Generate signature using SHA-256
    const signatureString = ACTIVE_MERCHANT + merchantOrderId + paymentAmount + ACTIVE_API_KEY;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    duitkuRequestData.signature = signature;
    duitkuRequestData.expiryPeriod = 60;
    
    logger.info('Sending payment request to Duitku', { url: DUITKU_URL, data: { ...duitkuRequestData, merchantCode: '[REDACTED]', merchantKey: '[REDACTED]', signature: '[REDACTED]' } });
    
    // Make request to Duitku API
    const response = await fetch(DUITKU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(duitkuRequestData),
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      logger.error('Duitku API error response', { status: response.status, data: responseData });
      return {
        success: false,
        errorMessage: `Duitku API error: ${responseData.errorMessage || 'Unknown error'}`
      };
    }
    
    logger.info('Duitku payment created successfully', { reference: responseData.reference });
    
    return {
      success: true,
      paymentUrl: responseData.paymentUrl,
      reference: responseData.reference
    };
  } catch (error) {
    logger.error('Error creating Duitku payment', { message: error.message });
    return {
      success: false,
      errorMessage: `Failed to create payment: ${error.message}`
    };
  }
};

// Main handler
Deno.serve(async (req) => {
  // Log incoming request for debugging
  logger.info('Incoming request to renew-subscription-payment', { 
    method: req.method, 
    url: req.url, 
    headers: Object.fromEntries(req.headers.entries())
  });
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Enhanced logging for debugging empty body issue
  logger.info('Request details', {
    method: req.method,
    url: req.url,
    contentType: req.headers.get('content-type'),
    contentLength: req.headers.get('content-length'),
    hasBody: req.body !== null,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Immediately return error for GET requests since they can't have bodies
  if (req.method === 'GET') {
    logger.error('GET request received for payment function which requires a body', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });
    return createErrorResponse('Invalid request method. This endpoint requires a POST request with a body.', 405);
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    // Log environment variables for debugging (redacted)
    logger.info('Environment variables check', { 
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasDuitkuMerchantCode: !!Deno.env.get('DUITKU_MERCHANT_CODE'),
      hasDuitkuMerchantKey: !!Deno.env.get('DUITKU_MERCHANT_KEY'),
      hasFrontendUrl: !!Deno.env.get('FRONTEND_URL'),
      hasDuitkuEnvironment: !!Deno.env.get('DUITKU_ENVIRONMENT')
    });
    
    // Validate required environment variables
    if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      logger.error('Missing required Supabase environment variables');
      return createErrorResponse('Server configuration error', 500);
    }
    
    // Parse JSON body robustly with enhanced logging
    let body: any;
    try {
      // Read the text first to avoid consuming the body twice
      const text = await req.text();
      logger.info('Raw request text received', { textLength: text.length, textPreview: text.substring(0, 100) });
      
      if (!text.trim()) {
        logger.error('Empty request body received', { 
          headers: Object.fromEntries(req.headers.entries()),
          method: req.method,
          url: req.url
        });
        return createErrorResponse('Empty request body', 400);
      }
      
      // Try to parse as JSON
      body = JSON.parse(text);
      logger.info('Successfully parsed JSON body from request', { bodyKeys: Object.keys(body) });
    } catch (jsonError) {
      logger.error('Failed to parse request body as JSON', { 
        error: jsonError.message,
        requestBody: text ? text.substring(0, 200) + (text.length > 200 ? '...' : '') : 'Empty',
        headers: Object.fromEntries(req.headers.entries())
      });
      return createErrorResponse('Invalid or missing JSON body', 400);
    }
    
    // Support both plan_id and plan for backward compatibility
    const plan_id = body?.plan_id ?? body?.plan;
    if (!plan_id) {
      logger.warn('Plan parameter is missing', { requestBody: body });
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
      logger.info('Supabase client created successfully');
    } catch (clientError) {
      logger.error('Failed to create Supabase client', { message: clientError.message });
      return createErrorResponse('Failed to initialize database connection', 500);
    }
    let userId: string;
    let userData: any;

    // Support both token-based and email-based authentication
    // Extract email from body for email-based authentication
    const email = body?.email;
    logger.info('Authentication check', { hasAuthHeader: !!authHeader, hasEmail: !!email });

    if (authHeader && validateAuthHeader(authHeader)) {
      logger.info('Using token-based authentication');
      // Token-based authentication (authenticated users)
      const token = authHeader.replace('Bearer ', '');
      try {
        userId = await getUserIdFromToken(token);
        logger.info('Token validated', { userId: '[REDACTED]' });
      } catch (error) {
        logger.error('Token validation failed', { message: error.message });
        // If token validation fails but email is provided, fall back to email-based auth
        if (email) {
          logger.info('Falling back to email-based authentication', { email: maskSensitiveString(email) });
          const normalizedEmail = email.trim().toLowerCase();
          const { data, error: userError } = await supabase
            .from('users')
            .select('id, name, email, phone')
            .eq('email', normalizedEmail)
            .single();

          if (userError || !data) {
            logger.error('User fetch by email failed', { email: maskSensitiveString(email), error: userError?.message });
            return createErrorResponse('User not found', 404);
          }
          userId = data.id;
          userData = data;
          logger.info('User data fetched via email fallback', { email: maskSensitiveString(userData.email) });
        } else {
          return createErrorResponse('Invalid token', 401);
        }
      }

      // If we have a userId but no userData yet, fetch user data
      if (!userData) {
        logger.info('Fetching user data by ID', { userId: '[REDACTED]' });
        try {
          // Fetch user data by ID using service role to bypass RLS
          const { data, error: userError } = await supabase
            .from('users')
            .select('id, name, email, phone, role, tenant_id')
            .eq('id', userId)
            .single();

          if (userError || !data) {
            logger.error('User fetch by ID failed', { userId: '[REDACTED]', error: userError?.message });
            return createErrorResponse('User not found', 404);
          }
          userData = data;
          logger.info('User data fetched via token', { email: maskSensitiveString(userData.email) });
        } catch (fetchError) {
          logger.error('Exception during user fetch by ID', { userId: '[REDACTED]', error: fetchError.message });
          return createErrorResponse('Failed to fetch user data', 500);
        }
      }
    } else if (email) {
      logger.info('Using email-based authentication', { email: maskSensitiveString(email) });
      // Email-based authentication (for expired users accessing renewal page)
      const normalizedEmail = email.trim().toLowerCase();
      
      try {
        // Use service role to bypass RLS when fetching user by email
        const { data, error: userError } = await supabase
          .from('users')
          .select('id, name, email, phone')
          .eq('email', normalizedEmail)
          .single();

        if (userError || !data) {
          logger.error('User fetch by email failed', { email: maskSensitiveString(email), error: userError?.message });
          return createErrorResponse('User not found', 404);
        }
        userId = data.id;
        userData = data;
        logger.info('User data fetched via email', { email: maskSensitiveString(userData.email) });
      } catch (fetchError) {
        logger.error('Exception during user fetch by email', { email: maskSensitiveString(email), error: fetchError.message });
        return createErrorResponse('Failed to fetch user data', 500);
      }
    } else {
      logger.warn('No authentication provided');
      return createErrorResponse('Authentication required - please login or provide email', 401);
    }

    // Log plan selection and proceed
    logger.info('Plan selected and user authenticated', { plan_id, userId: '[REDACTED]' });

    // Get plan data
    const planData = PLAN_MAPPING[plan_id];
    logger.info('Plan data retrieved', { plan_id, amount: planData.amount });

    // For cashiers, use the owner's ID for subscription/payment
    let effectiveUserId = userId;
    if (userData.role === 'cashier') {
      effectiveUserId = userData.tenant_id;
      logger.info('User is cashier, using tenant_id for payment', { userId, tenantId: userData.tenant_id });
    }
    
    // Generate merchant order ID
    const timestamp = Date.now();
    const merchantOrderId = `RENEWAL-${effectiveUserId}-${timestamp}`;
    logger.info('Merchant order ID generated', { orderIdPrefix: 'RENEWAL-[USER_ID]-[TIMESTAMP]' });

    // Create payment record
    logger.info('Creating payment record', { 
      userId: '[REDACTED]', 
      effectiveUserId: '[REDACTED]',
      amount: planData.amount, 
      merchantOrderId: merchantOrderId.substring(0, 30) + '...' 
    });
    
    try {
      const { data: paymentRecord, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: effectiveUserId,
          amount: planData.amount,
          merchant_order_id: merchantOrderId,
          product_details: planData.productDetails,
          customer_va_name: userData.name,
          customer_email: userData.email,
          customer_phone: userData.phone || '081234567890',
          payment_method: 'ALL',
          status: 'pending'
        })
        .select('id')
        .single();

      if (paymentError) {
        logger.error('Error creating payment record', { error: paymentError.message });
        return createErrorResponse(`Failed to create payment record: ${paymentError.message}`, 500);
      }
      logger.info('Payment record created', { paymentId: paymentRecord.id });
    } catch (paymentRecordError) {
      logger.error('Exception during payment record creation', { error: paymentRecordError.message });
      return createErrorResponse('Failed to create payment record', 500);
    }

    // Call Duitku API
    logger.info('Initiating Duitku payment');
    
    let paymentResult;
    try {
      paymentResult = await createDuitkuPayment(
        merchantOrderId,
        planData.amount,
        planData.productDetails,
        userData.name,
        userData.email,
        userData.phone || '081234567890'
      );

      if (!paymentResult.success) {
        logger.error('Duitku payment failed', { errorMessage: paymentResult.errorMessage });
        // Delete payment record if Duitku call fails
        try {
          await supabase.from('payments').delete().eq('id', paymentRecord.id);
        } catch (deleteError) {
          logger.error('Failed to delete payment record after Duitku failure', { error: deleteError.message });
        }

        return createErrorResponse(paymentResult.errorMessage, 500);
      }
      logger.info('Duitku payment successful', { paymentUrl: paymentResult.paymentUrl ? '[URL_PRESENT]' : null });
    } catch (duitkuError) {
      logger.error('Exception during Duitku payment creation', { error: duitkuError.message });
      // Delete payment record if Duitku call fails
      try {
        await supabase.from('payments').delete().eq('id', paymentRecord.id);
      } catch (deleteError) {
        logger.error('Failed to delete payment record after Duitku exception', { error: deleteError.message });
      }
      return createErrorResponse('Failed to create payment with payment provider', 500);
    }

    // Update payment record with payment URL and reference
    logger.info('Updating payment record with Duitku details');
    
    try {
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          payment_url: paymentResult.paymentUrl,
          reference: paymentResult.reference,
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentRecord.id);
        
      // Check for errors in payment update
      if (updateError) {
        logger.error('Error updating payment record with Duitku details', { error: updateError.message });
        // Return 500 error if update fails
        return createErrorResponse(`Failed to update payment record: ${updateError.message}`, 500);
      }
      logger.info('Payment record updated with Duitku details');
    } catch (updateError) {
      logger.error('Exception during payment record update', { error: updateError.message });
      return createErrorResponse('Failed to update payment record', 500);
    }

    // Return success response
    logger.info('Returning success response');
    return createResponse({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      merchantOrderId,
      paymentId: paymentRecord.id,
      message: 'Payment request created successfully'
    }, 201);
  } catch (error) {
    // Log detailed error information for debugging
    logger.error('Unhandled error in renew-subscription-payment function', { 
      message: error.message, 
      stack: error.stack,
      name: error.name
    });
    
    // Try to provide more specific error messages based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      logger.error('Network error when calling external API', { error: error.message });
      return createErrorResponse('Network error when connecting to payment provider', 500);
    } else if (error.message && error.message.includes('Supabase')) {
      logger.error('Supabase client error', { error: error.message });
      return createErrorResponse('Database connection error', 500);
    } else if (error.message && error.message.includes('Deno')) {
      logger.error('Deno runtime error', { error: error.message });
      return createErrorResponse('Runtime environment error', 500);
    }
    
    return createErrorResponse('Internal server error', 500);
  }
});