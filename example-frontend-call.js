// Example of how to properly call the duitku-payment-request function from frontend

import { supabase } from './src/lib/supabaseClient';

/**
 * Create a payment request using Supabase Edge Function
 * This example shows both authenticated and unauthenticated usage
 */
export async function createPayment({ amount, productDetails, merchantOrderId }) {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Prepare payment data
    const paymentData = {
      paymentAmount: amount,
      productDetails: productDetails,
      merchantOrderId: merchantOrderId,
      customerVaName: 'Customer Name', // Get from user profile if available
      customerEmail: 'customer@example.com', // Get from user profile if available
      paymentMethod: 'ALL'
    };
    
    // Call the Edge Function with proper headers
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include Authorization header if user is logged in
        ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        // Always include apikey
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(paymentData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create payment request');
    }
    
    return result;
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
}

/**
 * Example usage for registration flow (unauthenticated)
 */
export async function createPaymentForRegistration({ amount, productDetails, merchantOrderId, customerName, customerEmail }) {
  try {
    // Prepare payment data for registration (no user authentication)
    const paymentData = {
      paymentAmount: amount,
      productDetails: productDetails,
      merchantOrderId: merchantOrderId,
      customerVaName: customerName,
      customerEmail: customerEmail,
      paymentMethod: 'ALL'
    };
    
    // Call the Edge Function without Authorization header (registration flow)
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(paymentData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create payment request');
    }
    
    return result;
  } catch (error) {
    console.error('Error creating payment for registration:', error);
    throw error;
  }
}

// Example usage:
// For authenticated user:
// const paymentResult = await createPayment({
//   amount: 50000,
//   productDetails: 'Monthly Subscription',
//   merchantOrderId: `ORDER-${Date.now()}`
// });

// For registration (unauthenticated):
// const registrationPaymentResult = await createPaymentForRegistration({
//   amount: 50000,
//   productDetails: 'Registration Fee',
//   merchantOrderId: `REG-${Date.now()}`,
//   customerName: 'John Doe',
//   customerEmail: 'john@example.com'
// });