/**
 * Test Script for Subscription Registration Flow
 * 
 * This script tests the complete registration flow including:
 * 1. Email registration with payment
 * 2. OAuth Google registration with payment
 * 3. Email registration without payment (trial)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Test configuration
const TEST_CONFIG = {
  testEmail: `testuser${Date.now()}@example.com`,
  testPassword: 'TestPassword123!',
  testPlan: '1_month',
  testPrice: 50000,
  testDuration: 1
};

/**
 * Test 1: Email Registration with Payment
 */
async function testEmailRegistrationWithPayment() {
  console.log('\n=== Test 1: Email Registration with Payment ===\n');
  
  try {
    // Step 1: Register user
    console.log('Step 1: Registering user...');
    const registerResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: TEST_CONFIG.testEmail,
          password: TEST_CONFIG.testPassword,
          name: 'Test User',
          role: 'owner',
          isPriceCardRegistration: true,
          skipTrial: true,
          planDuration: TEST_CONFIG.testDuration
        })
      }
    );

    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${await registerResponse.text()}`);
    }

    const registerData = await registerResponse.json();
    console.log('✅ User registered:', registerData.userId);

    // Step 2: Create payment request
    console.log('\nStep 2: Creating payment request...');
    const paymentResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          paymentAmount: TEST_CONFIG.testPrice,
          productDetails: TEST_CONFIG.testPlan,
          customerVaName: 'Test User',
          email: TEST_CONFIG.testEmail,
          userId: registerData.userId,
          isRegistration: true
        })
      }
    );

    if (!paymentResponse.ok) {
      throw new Error(`Payment request failed: ${await paymentResponse.text()}`);
    }

    const paymentData = await paymentResponse.json();
    console.log('✅ Payment request created:', paymentData.merchantOrderId);

    // Step 3: Simulate payment callback (in real scenario, this comes from Duitku)
    console.log('\nStep 3: Simulating payment callback...');
    
    // In production, Duitku would call the duitku-callback endpoint
    // For testing, we'll simulate the callback
    const callbackResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/duitku-callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantCode: process.env.DUITKU_MERCHANT_CODE,
          amount: TEST_CONFIG.testPrice.toString(),
          merchantOrderId: paymentData.merchantOrderId,
          resultCode: '00',
          resultMessage: 'Payment successful',
          additionalParam: JSON.stringify({
            userId: registerData.userId,
            email: TEST_CONFIG.testEmail
          })
        })
      }
    );

    if (!callbackResponse.ok) {
      throw new Error(`Payment callback failed: ${await callbackResponse.text()}`);
    }

    console.log('✅ Payment callback processed');

    // Step 4: Check subscription status
    console.log('\nStep 4: Checking subscription status...');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', registerData.userId)
      .single();

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`);
    }

    console.log('✅ Subscription found:');
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Start Date: ${subscription.start_date}`);
    console.log(`   End Date: ${subscription.end_date}`);

    if (subscription.status !== 'active') {
      throw new Error(`Expected active subscription, got: ${subscription.status}`);
    }

    console.log('\n✅ Test 1 PASSED: Email registration with payment works correctly\n');
    return true;

  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
    return false;
  }
}

/**
 * Test 2: Email Registration without Payment (Trial)
 */
async function testEmailRegistrationWithoutPayment() {
  console.log('\n=== Test 2: Email Registration without Payment (Trial) ===\n');
  
  const testEmail = `trialuser${Date.now()}@example.com`;
  
  try {
    // Step 1: Register user without price card
    console.log('Step 1: Registering trial user...');
    const registerResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: testEmail,
          password: TEST_CONFIG.testPassword,
          name: 'Trial User',
          role: 'owner',
          isPriceCardRegistration: false,
          skipTrial: false
        })
      }
    );

    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${await registerResponse.text()}`);
    }

    const registerData = await registerResponse.json();
    console.log('✅ Trial user registered:', registerData.userId);

    // Step 2: Check subscription status
    console.log('\nStep 2: Checking trial subscription status...');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', registerData.userId)
      .single();

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`);
    }

    console.log('✅ Trial subscription found:');
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Start Date: ${subscription.start_date}`);
    console.log(`   End Date: ${subscription.end_date}`);

    // Verify it's a 7-day trial
    const startDate = new Date(subscription.start_date);
    const endDate = new Date(subscription.end_date);
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (daysDiff !== 7) {
      throw new Error(`Expected 7-day trial, got ${daysDiff} days`);
    }

    if (subscription.status !== 'active') {
      throw new Error(`Expected active subscription, got: ${subscription.status}`);
    }

    console.log('\n✅ Test 2 PASSED: Trial registration works correctly\n');
    return true;

  } catch (error) {
    console.error('\n❌ Test 2 FAILED:', error.message);
    return false;
  }
}

/**
 * Test 3: OAuth Google Registration (Simulated)
 */
async function testOAuthRegistration() {
  console.log('\n=== Test 3: OAuth Google Registration (Simulated) ===\n');
  
  const testEmail = `oauthuser${Date.now()}@example.com`;
  const oauthUserId = `oauth-${Date.now()}`;
  
  try {
    // Step 1: Simulate OAuth user registration
    console.log('Step 1: Simulating OAuth user registration...');
    const registerResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/auth-register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email: testEmail,
          name: 'OAuth User',
          role: 'owner',
          userId: oauthUserId,
          oauthProvider: 'google',
          isPriceCardRegistration: true,
          skipTrial: true,
          planDuration: TEST_CONFIG.testDuration,
          paymentCompleted: false
        })
      }
    );

    if (!registerResponse.ok) {
      throw new Error(`OAuth registration failed: ${await registerResponse.text()}`);
    }

    const registerData = await registerResponse.json();
    console.log('✅ OAuth user registered:', registerData.userId);

    // Step 2: Create payment request for OAuth user
    console.log('\nStep 2: Creating payment request for OAuth user...');
    const paymentResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          paymentAmount: TEST_CONFIG.testPrice,
          productDetails: TEST_CONFIG.testPlan,
          customerVaName: 'OAuth User',
          email: testEmail,
          userId: registerData.userId,
          isRegistration: true
        })
      }
    );

    if (!paymentResponse.ok) {
      throw new Error(`Payment request failed: ${await paymentResponse.text()}`);
    }

    const paymentData = await paymentResponse.json();
    console.log('✅ Payment request created:', paymentData.merchantOrderId);

    // Step 3: Simulate payment callback
    console.log('\nStep 3: Simulating payment callback...');
    const callbackResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/duitku-callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantCode: process.env.DUITKU_MERCHANT_CODE,
          amount: TEST_CONFIG.testPrice.toString(),
          merchantOrderId: paymentData.merchantOrderId,
          resultCode: '00',
          resultMessage: 'Payment successful',
          additionalParam: JSON.stringify({
            userId: registerData.userId,
            email: testEmail
          })
        })
      }
    );

    if (!callbackResponse.ok) {
      throw new Error(`Payment callback failed: ${await callbackResponse.text()}`);
    }

    console.log('✅ Payment callback processed');

    // Step 4: Check subscription status
    console.log('\nStep 4: Checking subscription status...');
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', registerData.userId)
      .single();

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`);
    }

    console.log('✅ Subscription found:');
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Start Date: ${subscription.start_date}`);
    console.log(`   End Date: ${subscription.end_date}`);

    if (subscription.status !== 'active') {
      throw new Error(`Expected active subscription, got: ${subscription.status}`);
    }

    console.log('\n✅ Test 3 PASSED: OAuth registration with payment works correctly\n');
    return true;

  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Starting Subscription Registration Flow Tests\n');
  console.log('='.repeat(60));

  const results = {
    test1: false,
    test2: false,
    test3: false
  };

  // Run Test 1
  results.test1 = await testEmailRegistrationWithPayment();

  // Run Test 2
  results.test2 = await testEmailRegistrationWithoutPayment();

  // Run Test 3
  results.test3 = await testOAuthRegistration();

  // Summary
  console.log('='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');
  console.log(`Test 1 (Email + Payment): ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 (Trial): ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (OAuth + Payment): ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = results.test1 && results.test2 && results.test3;
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! The subscription registration flow is working correctly.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
  }
  console.log('='.repeat(60));

  return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = {
  testEmailRegistrationWithPayment,
  testEmailRegistrationWithoutPayment,
  testOAuthRegistration,
  runTests
};