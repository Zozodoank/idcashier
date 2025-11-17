import { createClient } from '@supabase/supabase-js';

async function debugRenewal() {
  console.log('=== Debug Subscription Renewal ===');
  
  // Initialize Supabase client
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );
  
  try {
    // 1. Login
    console.log('1. Logging in as test user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'testing@idcashier.my.id',
      password: 'Tesajakalobisa'
    });
    
    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }
    
    const token = authData.session.access_token;
    console.log('✅ Login successful');
    
    // 2. Check subscription status
    console.log('2. Checking subscription status...');
    const { data: subData, error: subError } = await supabase.functions.invoke('subscriptions-get-current-user', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (subError) {
      console.error('❌ Subscription check failed:', subError.message);
      return;
    }
    
    console.log('✅ Subscription data:', JSON.stringify(subData, null, 2));
    
    // 3. Test renewal with detailed error handling
    console.log('3. Testing renewal payment with detailed error handling...');
    
    // Test with different approaches
    const testCases = [
      { plan_id: '3_months' },
      { plan_id: '3_months', email: undefined },
      { plan: '3_months' }, // Legacy parameter
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      console.log(`\n--- Test case ${i + 1}:`, JSON.stringify(testCases[i]));
      
      try {
        const { data, error } = await supabase.functions.invoke('renew-subscription-payment', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testCases[i])
        });
        
        if (error) {
          console.error(`❌ Test case ${i + 1} failed:`, error.message);
          if (error.status) {
            console.error(`   Status: ${error.status}`);
          }
        } else {
          console.log(`✅ Test case ${i + 1} succeeded:`, JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error(`💥 Test case ${i + 1} threw exception:`, err.message);
      }
    }
    
    console.log('\n=== Debug Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

debugRenewal().catch(console.error);