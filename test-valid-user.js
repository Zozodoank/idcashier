import { createClient } from '@supabase/supabase-js';

async function testValidUser() {
  console.log('=== Testing Valid User Subscription Status ===');
  
  // Initialize Supabase client
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );
  
  try {
    // 1. Login as a valid user (not the test user)
    console.log('1. Logging in as valid user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'demo@idcashier.my.id',
      password: 'Demo2025'
    });
    
    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }
    
    const token = authData.session.access_token;
    console.log('✅ Login successful');
    console.log('Token preview:', token.substring(0, 20) + '...');
    
    // 2. Test the subscription status function
    console.log('2. Testing subscription status function...');
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/subscriptions-get-current-user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    console.log('\n=== Valid User Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testValidUser().catch(console.error);