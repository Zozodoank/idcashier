// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2.5.0/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

// CORS headers for Supabase Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://idcashier.my.id',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

// Type definitions
interface UserData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: string;
}

interface PaymentData {
  paymentAmount: number;
  productDetails: string;
  merchantOrderId: string;
  customerVaName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod?: string;
}

interface DuitkuResponse {
  success: boolean;
  paymentUrl?: string;
  reference?: string;
  errorMessage?: string;
}

// Logger utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '');
  }
};

// Validation utilities
const validateUserData = (data: UserData): string[] => {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email is required');
  }
  
  if (!data.phone || !/^\+?[1-9]\d{1,14}$/.test(data.phone.replace(/\s/g, ''))) {
    errors.push('Valid phone number is required');
  }
  
  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  return errors;
};

const validatePaymentData = (data: PaymentData): string[] => {
  const errors: string[] = [];
  
  if (!data.paymentAmount || data.paymentAmount <= 0) {
    errors.push('Valid payment amount is required');
  }
  
  if (!data.productDetails || data.productDetails.trim().length === 0) {
    errors.push('Product details are required');
  }
  
  if (!data.merchantOrderId || data.merchantOrderId.trim().length === 0) {
    errors.push('Merchant order ID is required');
  }
  
  if (!data.customerVaName || data.customerVaName.trim().length === 0) {
    errors.push('Customer VA name is required');
  }
  
  if (!data.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    errors.push('Valid customer email is required');
  }
  
  if (!data.customerPhone || !/^\+?[1-9]\d{1,14}$/.test(data.customerPhone.replace(/\s/g, ''))) {
    errors.push('Valid customer phone is required');
  }
  
  return errors;
};

// Duitku API integration
const createDuitkuPayment = async (paymentData: PaymentData): Promise<DuitkuResponse> => {
  try {
    // Resolve Duitku configuration from environment (sandbox or production)
    const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'sandbox').toLowerCase();
    const SANDBOX_MERCHANT = Deno.env.get('DUITKU_SANDBOX_MERCHANT_CODE') || '';
    const SANDBOX_API_KEY = Deno.env.get('DUITKU_SANDBOX_API_KEY') || '';
    const SANDBOX_BASE_URL = Deno.env.get('DUITKU_SANDBOX_BASE_URL') || 'https://sandbox.duitku.com';
    const PROD_MERCHANT = Deno.env.get('DUITKU_PRODUCTION_MERCHANT_CODE') || '';
    const PROD_API_KEY = Deno.env.get('DUITKU_PRODUCTION_API_KEY') || '';
    const PROD_BASE_URL = Deno.env.get('DUITKU_PRODUCTION_BASE_URL') || 'https://passport.duitku.com';

    const ACTIVE_MERCHANT = ENV === 'production' ? PROD_MERCHANT : SANDBOX_MERCHANT;
    const ACTIVE_API_KEY = ENV === 'production' ? PROD_API_KEY : SANDBOX_API_KEY;
    const ACTIVE_BASE_URL = ENV === 'production' ? PROD_BASE_URL : SANDBOX_BASE_URL;

    const DUITKU_URL = `${ACTIVE_BASE_URL}/webapi/api/merchant/v2/inquiry`;
    
    // Prepare data for Duitku API
    const duitkuRequestData: any = {
      merchantCode: ACTIVE_MERCHANT,
      merchantOrderId: paymentData.merchantOrderId,
      paymentAmount: paymentData.paymentAmount,
      productDetails: paymentData.productDetails,
      customerVaName: paymentData.customerVaName,
      customerEmail: paymentData.customerEmail,
      customerPhone: paymentData.customerPhone,
      paymentMethod: paymentData.paymentMethod || 'ALL', // ALL = All payment methods
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/register-with-payment/callback`,
      returnUrl: 'https://idcashier.my.id/registration-success'
    };
    
    // Generate signature
    const signatureString = ACTIVE_MERCHANT + paymentData.merchantOrderId + paymentData.paymentAmount + ACTIVE_API_KEY;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    duitkuRequestData.signature = signature;
    
    logger.info('Sending payment request to Duitku', { url: DUITKU_URL, data: duitkuRequestData });
    
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
    
    logger.info('Duitku payment created successfully', responseData);
    
    return {
      success: true,
      paymentUrl: responseData.paymentUrl,
      reference: responseData.reference
    };
  } catch (error) {
    logger.error('Error creating Duitku payment', error);
    return {
      success: false,
      errorMessage: `Failed to create payment: ${error.message}`
    };
  }
};

// Database operations
const createSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
};

const createUserAndPaymentRecord = async (
  userData: UserData, 
  paymentData: PaymentData
): Promise<{ success: boolean; userId?: string; paymentId?: string; error?: string }> => {
  const supabase = createSupabaseClient();
  
  try {
    // Start a transaction-like operation by creating user first
    logger.info('Creating user account', { email: userData.email });
    
    // Create Supabase Auth user
    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        phone: userData.phone,
        role: userData.role || 'owner'
      }
    });

    if (createAuthError) {
      logger.error('Error creating auth user', createAuthError);
      return {
        success: false,
        error: `Failed to create user account: ${createAuthError.message}`
      };
    }

    const userId = authData.user.id;
    logger.info('Auth user created successfully', { userId });

    // Create user in public.users table (without phone since it's not in the schema)
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'owner',
          tenant_id: userId // Self-reference for owner
        }
      ])
      .select('id')
      .single();

    if (insertError) {
      logger.error('Error creating public user record', insertError);
      // Rollback: delete the auth user if database insert fails
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        logger.error('Failed to rollback auth user', deleteError);
      }
      return {
        success: false,
        error: `Failed to create user record: ${insertError.message}`
      };
    }

    logger.info('Public user record created successfully', { userId: newUser.id });

    // Create payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: paymentData.paymentAmount,
        merchant_order_id: paymentData.merchantOrderId,
        product_details: paymentData.productDetails,
        customer_va_name: paymentData.customerVaName,
        customer_email: paymentData.customerEmail,
        customer_phone: paymentData.customerPhone,
        payment_method: paymentData.paymentMethod || 'ALL',
        status: 'pending'
      })
      .select('id')
      .single();

    if (paymentError) {
      logger.error('Error creating payment record', paymentError);
      // Rollback: delete the user if payment record creation fails
      try {
        await supabase.auth.admin.deleteUser(userId);
        await supabase.from('users').delete().eq('id', userId);
      } catch (rollbackError) {
        logger.error('Failed to rollback user creation', rollbackError);
      }
      return {
        success: false,
        error: `Failed to create payment record: ${paymentError.message}`
      };
    }

    logger.info('Payment record created successfully', { paymentId: paymentRecord.id });

    return {
      success: true,
      userId: newUser.id,
      paymentId: paymentRecord.id
    };
  } catch (error) {
    logger.error('Unexpected error in createUserAndPaymentRecord', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
};

// Main handler
Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.json();
    const { userData, paymentData } = requestBody;

    // Validate input data
    if (!userData || !paymentData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Both userData and paymentData are required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Validate user data
    const userValidationErrors = validateUserData(userData);
    if (userValidationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'User data validation failed',
          details: userValidationErrors
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Validate payment data
    const paymentValidationErrors = validatePaymentData(paymentData);
    if (paymentValidationErrors.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment data validation failed',
          details: paymentValidationErrors
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Create user and payment records in database
    const dbResult = await createUserAndPaymentRecord(userData, paymentData);
    
    if (!dbResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: dbResult.error
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Create payment with Duitku
    const paymentResult = await createDuitkuPayment(paymentData);
    
    if (!paymentResult.success) {
      // Rollback user creation if payment creation fails
      const supabase = createSupabaseClient();
      try {
        await supabase.auth.admin.deleteUser(dbResult.userId!);
        await supabase.from('users').delete().eq('id', dbResult.userId!);
        await supabase.from('payments').delete().eq('id', dbResult.paymentId!);
      } catch (rollbackError) {
        logger.error('Failed to rollback after payment creation failure', rollbackError);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: paymentResult.errorMessage
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Update payment record with payment URL
    const supabase = createSupabaseClient();
    await supabase
      .from('payments')
      .update({ 
        payment_url: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        updated_at: new Date().toISOString()
      })
      .eq('id', dbResult.paymentId!);

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Registration initiated successfully. Please complete the payment to activate your account.',
        paymentUrl: paymentResult.paymentUrl,
        userId: dbResult.userId,
        paymentId: dbResult.paymentId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    );
  } catch (error) {
    logger.error('Unhandled error in register-with-payment function', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});