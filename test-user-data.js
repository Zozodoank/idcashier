import { createClient } from '@supabase/supabase-js';

async function testUserData() {
  console.log('=== Testing User Data Fetch ===');
  
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
    
    // 2. Get user data directly from Supabase
    console.log('2. Fetching user data directly from Supabase...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, tenant_id')
      .eq('email', 'testing@idcashier.my.id')
      .single();
    
    if (userError) {
      console.error('❌ User data fetch failed:', userError.message);
      return;
    }
    
    console.log('✅ User data fetched successfully:');
    console.log(JSON.stringify(userData, null, 2));
    
    // 3. Check if user has a subscription
    console.log('3. Checking user subscription...');
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('id, user_id, start_date, end_date')
      .eq('user_id', userData.id)
      .single();
    
    if (subscriptionError) {
      console.log('ℹ️  No active subscription found for user');
    } else {
      console.log('✅ Subscription data:');
      console.log(JSON.stringify(subscriptionData, null, 2));
    }
    
    console.log('\n=== User Data Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testUserData().catch(console.error);