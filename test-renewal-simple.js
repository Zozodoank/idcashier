import { createClient } from '@supabase/supabase-js';

async function testSimpleRenewal() {
  console.log('=== Testing Simple Renewal Function ===');
  
  // Initialize Supabase client
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );
  
  try {
    // 1. Login to get a fresh token
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
    
    // 2. Test the simple renewal function
    console.log('2. Testing simple renewal function...');
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/test-renewal-simple', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: '1_month'
      })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    console.log('\n=== Simple Renewal Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testSimpleRenewal().catch(console.error);