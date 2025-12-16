
// ESM script relying on global fetch (Node 18+)

const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI';

async function testLogin() {
  const loginUrl = `${SUPABASE_URL}/functions/v1/auth-login-final`;
  
  console.log('Testing login against:', loginUrl);
  console.log('User: testing@idcashier.my.id');
  
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        email: 'testing@idcashier.my.id',
        password: 'Tesajakalobisa'
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    console.log('Response Body:');
    console.log(text);
    
    try {
      const json = JSON.parse(text);
      if (json.details || json.stack) {
        console.log('\n--- ERROR DETAILS ---');
        console.log('Details:', json.details);
        console.log('Stack:', json.stack);
      }
    } catch (e) {
      // Not JSON
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testLogin();
