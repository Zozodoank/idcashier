// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import Supabase client and local MD5 utility
import { createClient } from '@supabase/supabase-js';
import { md5 } from '../_shared/md5.ts';
import { corsHeaders, handleOptions, createResponse, createErrorResponse } from '../_shared/cors.ts';
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
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data ? sanitizeLogData(data) : ''),
  error: (message: string, error?: any) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error ? sanitizeLogData(error) : ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data ? sanitizeLogData(data) : '')
};
function sanitizeLogData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  const sensitiveFields = ['authorization', 'apikey', 'merchantCode', 'merchantKey', 'signature', 'password'];
  for (const key in sanitized) {
    if (sensitiveFields.includes(key.toLowerCase())) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}
function maskSensitiveString(str: string): string {
    // Simplified for brevity, you can re-implement masking if needed
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
    const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'sandbox').toLowerCase();
    const DUITKU_MERCHANT_CODE = Deno.env.get('DUITKU_MERCHANT_CODE') || '';
    const DUITKU_MERCHANT_KEY = Deno.env.get('DUITKU_MERCHANT_KEY') || '';
    if (!DUITKU_MERCHANT_CODE || !DUITKU_MERCHANT_KEY) {
      logger.error('Missing Duitku configuration');
      return { success: false, errorMessage: 'Server error: Duitku configuration is missing.' };
    }
    
    const DUITKU_BASE_URL = ENV === 'production' ? 'https://passport.duitku.com' : 'https://sandbox.duitku.com';
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://idcashier.my.id';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';

    // CORRECT: Define signature before using it
    const signatureString = `${DUITKU_MERCHANT_CODE}${merchantOrderId}${paymentAmount}${DUITKU_MERCHANT_KEY}`;
    const signature = md5(signatureString);

    const duitkuRequestData = {
      merchantCode: DUITKU_MERCHANT_CODE,
      merchantOrderId,
      paymentAmount,
      productDetails,
      customerVaName,
      customerEmail,
      customerPhone,
      callbackUrl: `${SUPABASE_URL}/functions/v1/duitku-callback`,
      returnUrl: `${FRONTEND_URL}/payment-callback?renewal=1`,
      signature, // Now defined
      expiryPeriod: 60
    };
    
    const DUITKU_URL = `${DUITKU_BASE_URL}/webapi/api/merchant/v2/inquiry`;
    logger.info('Sending payment request to Duitku', { url: DUITKU_URL });

    const response = await fetch(DUITKU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duitkuRequestData),
    });

        // CORRECT: Improved error logging to capture raw response
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Duitku API error response', { status: response.status, rawText: errorText });
      
      // Try to parse as JSON for structured error, but fall back to raw text
      let errorMessage = `Duitku API Error: ${errorText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = `Duitku API Error: [${errorJson.resultCode || 'N/A'}] ${errorJson.resultMsg || errorJson.Message || 'No detailed message.'}`;
      } catch (e) {
        // Not a JSON response, use the raw text, which is already set
      }
      return { success: false, errorMessage: errorMessage };
    }

    const responseData = await response.json();

    logger.info('Duitku payment created successfully', { reference: responseData.reference });
    return { success: true, paymentUrl: responseData.paymentUrl, reference: responseData.reference };
  } catch (error) {
    logger.error('Error creating Duitku payment', { message: error.message, stack: error.stack });
    return { success: false, errorMessage: `Failed to create payment: ${error.message}` };
  }
};

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    const text = await req.text();
    if (!text.trim()) {
      return createErrorResponse('Empty request body', 400);
    }
    const body = JSON.parse(text);
    
    const { plan_id, email: rawEmail } = body || {};
    if (!plan_id || !PLAN_MAPPING[plan_id]) {
      return createErrorResponse('Invalid or missing plan_id', 400);
    }

    const supabase = createSupabaseClient();
    let userData;
    const authHeader = req.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const userId = await getUserIdFromToken(token);
      const { data, error } = await supabase.from('users').select('id, name, email, phone, role, tenant_id').eq('id', userId).single();
      if (error || !data) return createErrorResponse('User not found', 404);
      userData = data;
    } else if (rawEmail) {
      const { data, error } = await supabase.from('users').select('id, name, email, phone, role, tenant_id').eq('email', rawEmail.trim().toLowerCase()).single();
      if (error || !data) return createErrorResponse('User not found for the provided email', 404);
      userData = data;
    } else {
      return createErrorResponse('Missing authorization header or email', 401);
    }

    const planData = PLAN_MAPPING[plan_id];
    const effectiveUserId = userData.role === 'cashier' ? userData.tenant_id : userData.id;
    const merchantOrderId = `RENEWAL-${effectiveUserId}-${Date.now()}`;

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
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (paymentError) {
      return createErrorResponse(`Failed to create payment record: ${paymentError.message}`, 500);
    }

    const paymentResult = await createDuitkuPayment(
      merchantOrderId,
      planData.amount,
      planData.productDetails,
      userData.name,
      userData.email,
      userData.phone || '081234567890'
    );

    if (!paymentResult.success) {
      await supabase.from('payments').delete().eq('id', paymentRecord.id);
      return createErrorResponse(paymentResult.errorMessage, 500);
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        payment_url: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentRecord.id);

    if (updateError) {
      return createErrorResponse(`Failed to update payment record: ${updateError.message}`, 500);
    }

    return createResponse({
      success: true,
      paymentUrl: paymentResult.paymentUrl,
      merchantOrderId,
      paymentId: paymentRecord.id,
      message: 'Payment request created successfully'
    }, 201);
  } catch (error) {
    logger.error('Unhandled error in renew-subscription-payment function', { message: error.message, stack: error.stack });
    return createErrorResponse('Internal server error', 500);
  }
});