// Test the final auth-login function
const https = require('https');

function testFinalAuth() {
  console.log('=== Testing Final Auth-Login Function ===');
  
  const postData = JSON.stringify({
    email: 'demo@idcashier.my.id',
    password: 'Demo2025'
  });

  const options = {
    hostname: 'eypfeiqtvfxxiimhtycc.supabase.co',
    port: 443,
    path: '/functions/v1/auth-login-final',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': 'https://idcashier.my.id'
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Response status: ${res.statusCode}`);
    console.log(`Response headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`Response body: ${data}`);
      console.log('\n=== Final Auth Test Completed ===');
    });
  });

  req.on('error', (error) => {
    console.error(`Error: ${error.message}`);
  });

  req.write(postData);
  req.end();
}

testFinalAuth();