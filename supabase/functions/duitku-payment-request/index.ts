// Setup type definitions for built-in Supabase Runtime APIs
/// <reference path="../deno-stubs.d.ts" />
import { corsHeaders } from '../_shared/cors.ts'
import { createHash } from "node:crypto";
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Ambil kredensial dari environment variables (Secrets)
  const merchantCode = Deno.env.get("DUITKU_MERCHANT_CODE") || "";
  const apiKey = Deno.env.get("DUITKU_API_KEY")?.trim() || Deno.env.get("DUITKU_MERCHANT_KEY")?.trim() || "";
  const callbackUrl = Deno.env.get("CALLBACK_URL") || "https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback";
  const defaultReturnUrl = Deno.env.get("RETURN_URL") || "https://idcashier.com/payment-callback";

  try {
    const {
      paymentAmount,
      paymentMethod,
      productDetails,
      customerVaName,
      email,
      phoneNumber,
      itemDetails,
      userId,
      isRegistration,
      returnUrl: clientReturnUrl
    } = await req.json()

    console.log('Payment Request Config:', {
      callbackUrl,
      defaultReturnUrl,
      isRegistration,
      clientReturnUrl
    });

    // Use client provided return URL if valid, otherwise default
    const returnUrl = clientReturnUrl || defaultReturnUrl;

    if (!userId) {
      throw new Error('userId is required for payment');
    }

    const userIdNoDash = userId.replace(/-/g, '');
    // Ensure unique merchantOrderId
    const merchantOrderId = `ORD-${userIdNoDash}-${Date.now()}`;
    const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
    const signature = createHash("md5").update(signatureString).digest("hex");

    // Split name for first/last
    const fullName = (customerVaName || 'Customer').trim();
    const nameParts = fullName.split(' ');
    let firstName = nameParts[0];
    let lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

    // Ensure phone number format
    const validPhone = phoneNumber || '081234567890';

    const customerDetail = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phoneNumber: validPhone,
      billingAddress: {
        firstName, lastName, address: "Indonesia", city: "Jakarta", postalCode: "12345", phone: validPhone, countryCode: "ID"
      },
      shippingAddress: {
        firstName, lastName, address: "Indonesia", city: "Jakarta", postalCode: "12345", phone: validPhone, countryCode: "ID"
      }
    };

    // Ensure paymentAmount is integer
    const amountInt = parseInt(String(paymentAmount));

    // If paymentMethod is ALL, default to VC (Credit Card) if we can't show selection page
    // But ideally frontend should send specific code.
    const methodToSend = (!paymentMethod || paymentMethod === 'ALL') ? "VC" : paymentMethod;

    // Append register=1 to returnUrl if isRegistration is true
    let finalReturnUrl = returnUrl;
    console.log('Before register param:', finalReturnUrl, 'isRegistration:', isRegistration);
    if (isRegistration) {
      const separator = finalReturnUrl.includes('?') ? '&' : '?';
      finalReturnUrl = `${finalReturnUrl}${separator}register=1`;
      console.log('After register param:', finalReturnUrl);
    }

    const duitkuPayload: any = {
      merchantCode,
      paymentAmount: amountInt,
      paymentMethod: methodToSend,
      merchantOrderId,
      productDetails,
      additionalParam: "", // Optional
      merchantUserInfo: "", // Optional
      customerVaName: fullName,
      email,
      phoneNumber: validPhone,
      itemDetails: itemDetails || [{
        name: productDetails,
        price: amountInt,
        quantity: 1
      }],
      customerDetail,
      callbackUrl,
      returnUrl: finalReturnUrl,
      signature,
      expiryPeriod: 10 // 10 minutes expiry for testing
    };


    console.log('Sending to Duitku:', JSON.stringify(duitkuPayload));

    // Duitku Endpoint Configuration
    const ENV = (Deno.env.get('DUITKU_ENVIRONMENT') || 'production').toLowerCase();
    const DUITKU_BASE_URL = ENV === 'sandbox'
      ? 'https://sandbox.duitku.com'
      : 'https://passport.duitku.com';

    const duitkuApiUrl = `${DUITKU_BASE_URL}/webapi/api/merchant/v2/inquiry`;

    console.log(`Using Duitku Environment: ${ENV}, URL: ${duitkuApiUrl}`);

    const response = await fetch(duitkuApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(duitkuPayload),
    });

    let data;
    try {
      const text = await response.text();
      console.log('Raw Duitku Response Body:', text);
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse Duitku response as JSON:', text);
        throw new Error('Invalid JSON response from Duitku');
      }
    } catch (err) {
      console.error('Error reading Duitku response:', err);
      throw err;
    }

    console.log('Duitku Response:', data);

    if (!data.paymentUrl) {
      console.error('Duitku Error:', data);
      // Don't throw immediately, check if we can still insert pending payment for debugging
    }

    // Insert into payments table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount: paymentAmount,
        merchant_order_id: merchantOrderId,
        product_details: productDetails,
        customer_va_name: customerVaName,
        customer_email: email,
        customer_phone: validPhone,
        status: 'pending',
        payment_url: data.paymentUrl,
        reference: data.reference
      });

    if (paymentError) {
      console.error('Failed to insert payment:', paymentError);
    }

    if (!data.paymentUrl) {
      console.error('Duitku Error Response:', JSON.stringify(data));
      const errorMsg = data.statusMessage || data.Message || 'Failed to get payment URL from Duitku';
      throw new Error(`${errorMsg} (Code: ${data.statusCode || 'Unknown'}) - ${JSON.stringify(data)}`);
    }

    // Return merchantOrderId along with Duitku data
    return new Response(JSON.stringify({ ...data, merchantOrderId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing payment request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
