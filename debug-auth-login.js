// Debug the auth-login function
async function debugAuthLogin() {
  console.log('=== Debugging Auth-Login Function ===');
  
  // Test the auth-login function directly with proper headers
  try {
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add origin header to test CORS
        'Origin': 'https://idcashier.my.id'
      },
      body: JSON.stringify({
        email: 'demo@idcashier.my.id',
        password: 'Demo2025'
      })
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, [...response.headers.entries()]);
    
    const result = await response.json();
    console.log(`Response body:`, JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log(`💥 Error: ${error.message}`);
  }
  
  console.log('\n=== Debug Completed ===');
}

debugAuthLogin().catch(console.error);