// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Duitku payment request handler
Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey');
    
    // Always create a client with anon key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { 
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Try to get user from token if we have an auth header
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const { data: { user: userData }, error: userError } = await supabase.auth.getUser(authHeader.substring(7));
      
      if (!userError && userData) {
        user = userData;
      }
    }

    let requestData;
    try {
      requestData = await req.json();
    } catch (jsonError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Get payment data from request body
    const { 
      paymentAmount, 
      productDetails, 
      merchantOrderId,
      customerVaName,
      customerEmail,
      paymentMethod
    } = requestData || {};

    // Validate required fields
    if (!paymentAmount || !productDetails || !merchantOrderId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: paymentAmount, productDetails, and merchantOrderId are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

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
    const duitkuData: any = {
      merchantCode: ACTIVE_MERCHANT,
      merchantOrderId: merchantOrderId,
      paymentAmount: paymentAmount,
      // Use user ID if available, otherwise generate a temporary ID
      merchantUserId: user ? user.id : `temp_${Date.now()}`,
      productDetails: productDetails,
      customerVaName: customerVaName || (user ? user.email : 'Customer') || 'Customer',
      customerEmail: customerEmail || (user ? user.email : 'customer@example.com') || 'customer@example.com',
      paymentMethod: paymentMethod || 'ALL', // ALL = All payment methods
      callbackUrl: 'https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback',
      returnUrl: 'https://idcashier.my.id/payment-success'
    };
    
    // Generate signature
    const signatureString = ACTIVE_MERCHANT + merchantOrderId + paymentAmount + ACTIVE_API_KEY;
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    duitkuData.signature = signature;
    
    console.log('Duitku request data:', duitkuData);
    
    // Create a payment record in the database
    const paymentRecordData: any = {
      amount: paymentAmount,
      merchant_order_id: merchantOrderId,
      product_details: productDetails,
      customer_va_name: customerVaName || (user ? user.email : 'Customer') || 'Customer',
      customer_email: customerEmail || (user ? user.email : 'customer@example.com') || 'customer@example.com',
      payment_method: paymentMethod || 'ALL',
      status: 'pending'
    };
    
    // Only associate with user if we have one
    if (user) {
      paymentRecordData.user_id = user.id;
    }
    
    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert(paymentRecordData)
      .select()
      .single();

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment record', details: paymentError.message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // In a real implementation, you would call Duitku API here
    // For now, we'll return a mock URL for testing
    const paymentUrl = `https://sandbox.duitku.com/webapi/api/merchant/payment?merchantOrderId=${merchantOrderId}`;
    
    return new Response(
      JSON.stringify({ 
        success: true,
        paymentUrl: paymentUrl,
        paymentRecord: paymentRecord
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Duitku payment request error:', error);
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