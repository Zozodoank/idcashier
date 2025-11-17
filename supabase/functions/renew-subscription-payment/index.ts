import { Md5 } from 'md5';

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
      callbackUrl: `${SUPABASE_URL}/functions/v1/duitku-callback`,
      returnUrl: `${FRONTEND_URL}/payment-callback?renewal=1`
    };
    
        // Generate signature using MD5

    
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
    
            const { plan_id, email: rawEmail } = body || {};
    const unauthenticatedEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : undefined;

    if (!plan_id) {
      return createErrorResponse('Missing plan_id', 400);
    }

    if (!PLAN_MAPPING[plan_id]) {
      const receivedPlanStr = plan_id ? `'${plan_id}'` : 'undefined/null';
      return createErrorResponse(`Invalid plan ${receivedPlanStr}. Must be one of: 1_month, 3_months, 6_months, 12_months`, 400);
    }

    const supabase = createSupabaseClient();
    let userId;
    let userData;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      logger.info('Using token-based authentication');
      const token = authHeader.replace('Bearer ', '');
      try {
        userId = await getUserIdFromToken(token);
        logger.info('Token validated', { userId: '[REDACTED]' });
      } catch (error) {
        logger.error('Token validation failed', { message: error.message });
        return createErrorResponse('Invalid token', 401);
      }
      
      const { data, error: userError } = await supabase.from('users').select('id, name, email, phone, role, tenant_id').eq('id', userId).single();

      if (userError || !data) {
        logger.error('User fetch by ID failed', { userId: '[REDACTED]', error: userError?.message });
        return createErrorResponse('User not found', 404);
      }
      userData = data;
      logger.info('User data fetched via token', { email: maskSensitiveString(userData.email) });

    } else if (unauthenticatedEmail) {
      logger.info('Using email-based authentication for unauthenticated user');
      const { data, error: userError } = await supabase.from('users').select('id, name, email, phone, role, tenant_id').eq('email', unauthenticatedEmail).single();

      if (userError || !data) {
        logger.error('User fetch by email failed', { email: maskSensitiveString(unauthenticatedEmail), error: userError?.message });
        return createErrorResponse('User not found for the provided email', 404);
      }
      userId = data.id;
      userData = data;
      logger.info('User data fetched via email', { email: maskSensitiveString(userData.email) });
    } else {
      logger.warn('Missing authorization header or email');
      return createErrorResponse('Missing authorization header or email', 401);
    }


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