// @supabase/verify-jwt false
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
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
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse JSON body robustly
    let body: any = {};
    if (req.method === 'POST') {
      try {
        const contentType = req.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          body = await req.json();
        } else {
          // Try to parse body as text and then JSON
          const text = await req.text();
          if (text) {
            body = JSON.parse(text);
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON body:', parseError);
        // Continue with empty body
        body = {};
      }
    }
    
    const { plan_id: raw_plan_id, email: unauthenticatedEmailRaw, currency } = body || {};
    // Normalize email early to avoid case-sensitivity issues
    const unauthenticatedEmail = typeof unauthenticatedEmailRaw === 'string'
      ? unauthenticatedEmailRaw.trim().toLowerCase()
      : unauthenticatedEmailRaw;
    const plan_id = raw_plan_id ?? body?.plan; // Support legacy 'plan'

    if (!plan_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing plan_id', code: 400 }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!PLAN_MAPPING[plan_id]) {
      const receivedPlanStr = plan_id ? `'${plan_id}'` : 'undefined/null';
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid plan ${receivedPlanStr}. Must be one of: 1_month, 3_months, 6_months, 12_months`,
          code: 400
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    let userId: string;
    let userData: any;

    // Tiered Authentication Logic
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // 1. Authenticated user with token
      logger.info('Using token-based authentication');
      const token = authHeader.replace('Bearer ', '');
      try {
        userId = await getUserIdFromToken(token);
        logger.info('Token validated', { userId: '[REDACTED]' });
      } catch (error) {
        logger.error('Token validation failed', { message: error.message });
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid token', code: 401 }),
          { headers: corsHeaders, status: 401 }
        );
      }
      
      const { data, error: userError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', userId)
        .single();

      if (userError || !data) {
        logger.error('User fetch by ID failed', { userId: '[REDACTED]', error: userError?.message });
        return new Response(
          JSON.stringify({ success: false, error: 'User not found', code: 404 }),
          { headers: corsHeaders, status: 404 }
        );
      }
      userData = data;
      logger.info('User data fetched via token', { email: maskSensitiveString(userData.email) });

    } else if (unauthenticatedEmail) {
      // 2. Unauthenticated user with email
      logger.info('Using email-based authentication for unauthenticated user');
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('email', unauthenticatedEmail)
        .single();

      if (userError || !data) {
        logger.error('User fetch by email failed', { email: maskSensitiveString(unauthenticatedEmail), error: userError?.message });
        return new Response(
          JSON.stringify({ success: false, error: 'User not found for the provided email', code: 404 }),
          { headers: corsHeaders, status: 404 }
        );
      }
      userId = data.id;
      userData = data;
      logger.info('User data fetched via email', { email: maskSensitiveString(userData.email) });

    } else {
      // 3. No authentication provided
      logger.warn('Missing authorization header or email');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header or email' }),
        { headers: corsHeaders, status: 401 }
      );
    }

    // Log plan selection and proceed
    logger.info('Plan selected and user authenticated', { plan_id, userId: '[REDACTED]' });

    // Get plan data
    const planData = PLAN_MAPPING[plan_id];
    logger.info('Plan data retrieved', { plan_id, amount: planData.amount });

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
    logger.error('Unhandled error in create-renewal-payment function', { message: error.message });
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
