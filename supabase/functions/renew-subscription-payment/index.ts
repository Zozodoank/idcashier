// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
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
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Add debug endpoint for development (protect with secret key)
  const url = new URL(req.url);
  const isDebug = url.searchParams.get('debug') === 'true';
  const debugSecret = url.searchParams.get('secret');
  const expectedSecret = Deno.env.get('DEBUG_SECRET');
  
  // Require DEBUG_SECRET to be set in production
  if (isDebug) {
    // In production, require DEBUG_SECRET to be set and match
    const isProduction = (Deno.env.get('DENO_ENV') || '').toLowerCase() === 'production';
    if (isProduction && !expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Debug endpoint not available in production without DEBUG_SECRET' }),
        { headers: corsHeaders, status: 403 }
      );
    }
    
    if (!expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'DEBUG_SECRET not configured' }),
        { headers: corsHeaders, status: 403 }
      );
    }
    
    if (debugSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid debug secret' }),
        { headers: corsHeaders, status: 403 }
      );
    }
    
    try {
      const rawBody = await req.clone().text();
      const parsedBody = rawBody ? JSON.parse(rawBody) : {};
      // Even in debug mode, don't return sensitive fields
      const sanitizedHeaders = sanitizeLogData(Object.fromEntries(req.headers.entries()));
      return new Response(
        JSON.stringify({
          method: req.method,
          url: req.url,
          headers: sanitizedHeaders,
          contentType: req.headers.get('content-type'),
          // Don't log rawBody or parsedBody in debug mode to avoid leaking sensitive data
          planExists: 'plan' in parsedBody,
          emailExists: 'email' in parsedBody
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (debugError) {
      return new Response(
        JSON.stringify({ error: 'Debug parsing failed', details: debugError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }

  // Log initial request details (redacted)
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    headers: sanitizeLogData(Object.fromEntries(req.headers.entries()))
  });

  try {
    // Enhanced body parsing with logging
    logger.info('Starting body parsing', { contentType: req.headers.get('content-type') });
    let requestBody: any = {};
    let rawBodyText = '';
    try {
      rawBodyText = await req.clone().text();
      logger.info('Raw body text retrieved', { length: rawBodyText.length }); // Log only length
      if (!rawBodyText.trim()) {
        logger.warn('Request body is empty');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Request body is empty or undefined'
          }),
          { headers: corsHeaders, status: 400 }
        );
      }
      requestBody = JSON.parse(rawBodyText);
      logger.info('Body parsed successfully', { typeofPlan: typeof requestBody.plan, typeofEmail: typeof requestBody.email });
    } catch (parseError) {
      logger.error('Failed to parse request body', { error: parseError.message, bodyLength: rawBodyText.length });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid JSON in request body: ${parseError.message}`
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // Validate request structure
    if (!requestBody || typeof requestBody !== 'object') {
      logger.warn('Request body is not a valid object');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request body must be a valid JSON object'
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const { plan, email } = requestBody;
    logger.info('Extracted fields', { plan, hasPlan: 'plan' in requestBody, hasEmail: 'email' in requestBody });

    // Validate plan parameter with enhanced logging
    logger.info('Validating plan parameter', { receivedPlan: plan });
    if (!plan || !PLAN_MAPPING[plan]) {
      const receivedPlanStr = plan ? `'${plan}'` : 'undefined/null';
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid plan ${receivedPlanStr}. Must be one of: 3_months, 6_months, 12_months`
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    let userId: string;
    let userData: any;

    // Support both token-based and email-based authentication
    const authHeader = req.headers.get('Authorization');
    logger.info('Authentication check', { hasAuthHeader: !!authHeader, hasEmail: !!email });

    if (authHeader && authHeader.startsWith('Bearer ')) {
      logger.info('Using token-based authentication');
      // Token-based authentication (authenticated users)
      const token = authHeader.replace('Bearer ', '');
      try {
        userId = await getUserIdFromToken(token);
        logger.info('Token validated', { userId: '[REDACTED]' });
      } catch (error) {
        logger.error('Token validation failed', { message: error.message });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid token'
          }),
          { headers: corsHeaders, status: 401 }
        );
      }

      // Fetch user data by ID
      const { data, error: userError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', userId)
        .single();

      if (userError || !data) {
        logger.error('User fetch by ID failed', { userId: '[REDACTED]', error: userError?.message });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'User not found'
          }),
          { headers: corsHeaders, status: 404 }
        );
      }
      userData = data;
      logger.info('User data fetched via token', { email: maskSensitiveString(userData.email) });
    } else if (email) {
      logger.info('Using email-based authentication', { email: maskSensitiveString(email) });
      // Email-based authentication (for expired users accessing renewal page)
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('email', normalizedEmail)
        .single();

      if (userError || !data) {
        logger.error('User fetch by email failed', { email: maskSensitiveString(normalizedEmail), error: userError?.message });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'User not found with provided email'
          }),
          { headers: corsHeaders, status: 404 }
        );
      }
      userId = data.id;
      userData = data;
      logger.info('User data fetched via email', { email: maskSensitiveString(userData.email) });
    } else {
      logger.warn('No valid authentication provided');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization header with Bearer token or email in request body is required'
        }),
        { headers: corsHeaders, status: 401 }
      );
    }

    // Log plan selection and proceed
    logger.info('Plan selected and user authenticated', { plan, userId: '[REDACTED]' });

    // Get plan data
    const planData = PLAN_MAPPING[plan];
    logger.info('Plan data retrieved', { plan, amount: planData.amount });

    // Generate merchant order ID
    const timestamp = Date.now();
    const merchantOrderId = `RENEWAL-${userId}-${timestamp}`;
    logger.info('Merchant order ID generated', { orderIdPrefix: 'RENEWAL-[USER_ID]-[TIMESTAMP]' });

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
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
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to create payment record: ${paymentError.message}`
        }),
        { headers: corsHeaders, status: 500 }
      );
    }
    logger.info('Payment record created', { paymentId: paymentRecord.id });

    // Call Duitku API
    logger.info('Initiating Duitku payment');
    const paymentResult = await createDuitkuPayment(
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
      await supabase.from('payments').delete().eq('id', paymentRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: paymentResult.errorMessage
        }),
        { headers: corsHeaders, status: 500 }
      );
    }
    logger.info('Duitku payment successful', { paymentUrl: paymentResult.paymentUrl ? '[URL_PRESENT]' : null });

    // Update payment record with payment URL and reference
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
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to update payment record: ${updateError.message}`
        }),
        { headers: corsHeaders, status: 500 }
      );
    }
    logger.info('Payment record updated with Duitku details');

    // Return success response
    logger.info('Returning success response');
    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: paymentResult.paymentUrl,
        merchantOrderId,
        paymentId: paymentRecord.id,
        message: 'Payment request created successfully'
      }),
      { headers: corsHeaders, status: 201 }
    );
  } catch (error) {
    logger.error('Unhandled error in renew-subscription-payment function', { message: error.message });
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error'
      }),
      { 
        headers: corsHeaders,
        status: 500
      }
    );
  }
});