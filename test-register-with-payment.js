// test-register-with-payment.js
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test data
const testData = {
  userData: {
    name: "Test User",
    email: "test@example.com",
    phone: "+628123456789", // Valid Indonesian phone number format
    password: "password123",
    role: "owner"
  },
  paymentData: {
    paymentAmount: 50000,
    productDetails: "IDCashier Subscription - 1 Month",
    merchantOrderId: "TEST_ORDER_" + Date.now(),
    customerVaName: "Test User",
    customerEmail: "test@example.com",
    customerPhone: "+628123456789", // Valid Indonesian phone number format
    paymentMethod: "ALL"
  }
};

async function testRegistrationWithPayment() {
  console.log("Testing registration with Duitku payment integration...");
  
  try {
    // Step 1: Test the registration with payment endpoint
    console.log("\nStep 1: Testing registration with payment endpoint...");
    
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/register-with-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY, // Use anon key for public access
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` // Some functions may require this
      },
      body: JSON.stringify(testData)
    });
    
    const responseData = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log("Registration initiated successfully!");
      if (responseData.paymentUrl) {
        console.log(`Payment URL: ${responseData.paymentUrl}`);
      }
      return true;
    } else {
      console.log(`Registration failed: ${responseData.message || responseData.error || 'Unknown error'}`);
      if (responseData.details) {
        console.log(`Validation errors:`, responseData.details);
      }
      return false;
    }
  } catch (error) {
    console.error("Error during registration test:", error);
    return false;
  }
}

// Run the test
testRegistrationWithPayment().then(success => {
  if (success) {
    console.log("\n✅ Registration with payment test completed successfully!");
  } else {
    console.log("\n❌ Registration with payment test failed!");
  }
});