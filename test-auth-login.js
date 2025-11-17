// Test the auth-login function directly
async function testAuthLogin() {
  console.log('=== Testing Auth-Login Function ===');
  
  // Test accounts
  const testAccounts = [
    { email: 'demo@idcashier.my.id', password: 'Demo2025', name: 'Demo Account' },
    { email: 'testing@idcashier.my.id', password: 'Tesajakalobisa', name: 'Test Account' }
  ];
  
  for (const account of testAccounts) {
    console.log(`\n--- Testing ${account.name} (${account.email}) ---`);
    
    try {
      // Test the auth-login function directly
      const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: account.email,
          password: account.password
        })
      });
      
      const result = await response.json();
      console.log(`Auth-login response status: ${response.status}`);
      console.log(`Auth-login response:`, JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Auth-Login Test Completed ===');
}

testAuthLogin().catch(console.error);