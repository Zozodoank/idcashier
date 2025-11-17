// Test the simple function
async function testSimpleFunction() {
  console.log('=== Testing Simple Function ===');
  
  try {
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/test-simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
  
  console.log('\n=== Simple Function Test Completed ===');
}

testSimpleFunction().catch(console.error);