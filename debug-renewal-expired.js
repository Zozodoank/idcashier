import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI';

async function debugRenewal() {
  console.log('=== Debugging Renewal for Testing User ===');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // 1. Login
    console.log('1. Logging in as testing@idcashier.my.id...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'testing@idcashier.my.id',
      password: 'Tesajakalobisa'
    });
    
    if (authError) {
      console.error('❌ Login failed:', authError.message);
      // Try to continue with email flow if login fails
    }
    
    let token = authData?.session?.access_token;
    let userId = authData?.user?.id;
    
    if (token) {
      console.log('✅ Login successful. User ID:', userId);
      
      // 2. Check Subscription Status
      console.log('2. Checking subscription status...');
      const { data: subData, error: subError } = await supabase.functions.invoke('subscriptions-get-current-user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (subError) {
        console.error('❌ Failed to get subscription:', subError);
      } else {
        console.log('Subscription Data:', JSON.stringify(subData, null, 2));
        if (subData.has_subscription === false) {
            console.log('ℹ️ User has NO active subscription.');
        } else {
            const endDate = new Date(subData.end_date);
            const now = new Date();
            if (endDate < now) {
                console.log('ℹ️ User subscription is EXPIRED.');
            } else {
                console.log('ℹ️ User subscription is ACTIVE.');
            }
        }
      }

      // 3. Test Renewal WITH Token
      console.log('\n3. Testing renewal WITH token...');
      const responseToken = await fetch(`${SUPABASE_URL}/functions/v1/renew-subscription-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: '1_month',
          paymentMethod: 'VC'
        })
      });
      
      console.log('Response status (Token flow):', responseToken.status);
      const dataToken = await responseToken.json(); // Parsing JSON regardless of status to see error message
      console.log('Response data (Token flow):', JSON.stringify(dataToken, null, 2));
    }

    // 4. Test Renewal WITHOUT Token (Email flow)
    console.log('\n4. Testing renewal WITHOUT token (Email flow)...');
    const responseEmail = await fetch(`${SUPABASE_URL}/functions/v1/renew-subscription-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: '1_month',
        email: 'testing@idcashier.my.id',
        paymentMethod: 'VC'
      })
    });
    
    console.log('Response status (Email flow):', responseEmail.status);
    const dataEmail = await responseEmail.json();
    console.log('Response data (Email flow):', JSON.stringify(dataEmail, null, 2));

  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

debugRenewal().catch(console.error);
