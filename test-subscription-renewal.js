// Test subscription renewal functionality
// This script can be run in Node.js or adapted for browser use

// For Node.js, you'll need to install @supabase/supabase-js:
// npm install @supabase/supabase-js

const { createClient } = require('@supabase/supabase-js');

// Configuration - Replace with your actual Supabase project URL and keys
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSubscriptionRenewal() {
  try {
    console.log('=== Subscription Renewal Test ===');
    
    // 1. Login as test user
    console.log('1. Logging in as test user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'testing@idcashier.my.id',
      password: 'Tesajakalobisa'
    });
    
    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }
    
    const accessToken = authData.session.access_token;
    console.log('✅ Login successful');
    
    // 2. Check current subscription status
    console.log('2. Checking current subscription status...');
    const { data: subscriptionData, error: subscriptionError } = await supabase.functions.invoke(
      'subscriptions-get-current-user',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (subscriptionError) {
      console.error('❌ Failed to get subscription status:', subscriptionError.message);
      return;
    }
    
    console.log('✅ Current subscription status:', JSON.stringify(subscriptionData, null, 2));
    
    // 3. Test renewal payment creation
    console.log('3. Creating renewal payment for 3 months plan...');
    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
      'renew-subscription-payment',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: '3_months'
        })
      }
    );
    
    if (paymentError) {
      console.error('❌ Failed to create renewal payment:', paymentError.message);
      return;
    }
    
    console.log('✅ Renewal payment created successfully');
    console.log('Payment data:', JSON.stringify(paymentData, null, 2));
    
    console.log('=== Test Completed Successfully ===');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
testSubscriptionRenewal();