import { createClient } from '@supabase/supabase-js';

async function debugRenewalDetailed() {
  console.log('=== Detailed Debug Subscription Renewal ===');
  
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
    console.log('Token preview:', token.substring(0, 20) + '...');
    
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
    
    // 3. Test renewal with detailed debugging
    console.log('3. Testing renewal payment with detailed debugging...');
    
    // Test the exact payload that should work
    const payload = { plan_id: '3_months' };
    console.log('Sending payload:', JSON.stringify(payload));
    
    // Try to invoke the function with detailed error handling
    try {
      const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/renew-subscription-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (response.ok) {
        try {
          const responseData = JSON.parse(responseText);
          console.log('✅ Renewal response:', JSON.stringify(responseData, null, 2));
        } catch (parseError) {
          console.log('✅ Renewal response (non-JSON):', responseText);
        }
      } else {
        console.error('❌ Renewal failed with status:', response.status);
        try {
          const errorData = JSON.parse(responseText);
          console.error('Error details:', JSON.stringify(errorData, null, 2));
        } catch (parseError) {
          console.error('Error details (non-JSON):', responseText);
        }
      }
    } catch (networkError) {
      console.error('💥 Network error during renewal:', networkError.message);
    }
    
    console.log('\n=== Detailed Debug Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

debugRenewalDetailed().catch(console.error);