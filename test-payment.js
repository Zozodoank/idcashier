// Simple test script to verify payment function
import dotenv from 'dotenv';
dotenv.config();

async function testPayment() {
  console.log('Testing Duitku payment function...');
  
  try {
    // This is a simple test - in reality, you would need a valid Supabase session token
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY,
        // Note: For a real test, you would need to include a valid Authorization header
        // 'Authorization': 'Bearer YOUR_VALID_SESSION_TOKEN'
      },
      body: JSON.stringify({
        amount: 10000,
        paymentMethod: 'VC',
        productDetails: 'Test Payment',
        orderId: `TEST-${Date.now()}`
      })
    });
    
    const result = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Payment function is working correctly');
    } else {
      console.log('❌ Payment function returned an error');
    }
  } catch (error) {
    console.error('Error testing payment function:', error);
  }
}

testPayment();