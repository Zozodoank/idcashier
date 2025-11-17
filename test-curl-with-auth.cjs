// Test with curl-like approach and authorization header
const https = require('https');

function testWithCurl() {
  console.log('=== Testing with Curl-like Approach and Auth Header ===');
  
  const postData = JSON.stringify({
    email: 'demo@idcashier.my.id',
    password: 'Demo2025'
  });

  const options = {
    hostname: 'eypfeiqtvfxxiimhtycc.supabase.co',
    port: 443,
    path: '/functions/v1/test-simple',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Origin': 'https://idcashier.my.id',
      'Authorization': 'Bearer dummy-token' // Add a dummy authorization header
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
      console.log('\n=== Curl-like Test with Auth Completed ===');
    });
  });

  req.on('error', (error) => {
    console.error(`Error: ${error.message}`);
  });

  req.write(postData);
  req.end();
}

testWithCurl();