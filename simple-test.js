import { createClient } from '@supabase/supabase-js';

async function test() {
  console.log('Testing subscription renewal functionality...');
  
  // Initialize Supabase client
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );
  
  // Test login
  console.log('1. Testing login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'testing@idcashier.my.id',
    password: 'Tesajakalobisa'
  });
  
  if (error) {
    console.log('Login error:', error.message);
    return;
  }
  
  console.log('Login successful');
  const token = data.session.access_token;
  
  // Test subscription check
  console.log('2. Checking subscription status...');
  const { data: subData, error: subError } = await supabase.functions.invoke('subscriptions-get-current-user', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (subError) {
    console.log('Subscription check error:', subError.message);
    return;
  }
  
  console.log('Subscription data:', JSON.stringify(subData, null, 2));
  
    // Test renewal payment creation
  console.log('3. Creating renewal payment...');
  const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/renew-subscription-payment', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan_id: '3_months'
    })
  });

  const paymentData = await response.json();

  if (!response.ok) {
    console.log('Payment creation error:', paymentData.error);
    return;
  }

  
  console.log('Payment data:', JSON.stringify(paymentData, null, 2));
  console.log('Test completed successfully!');
}

test().catch(console.error);