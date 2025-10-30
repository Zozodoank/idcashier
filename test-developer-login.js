// Test login with developer credentials
import fetch from 'node-fetch';

const url = 'http://localhost:3001/api/auth/login';
const credentials = {
  email: 'jho.j80@gmail.com',
  password: '@Se06070786'
};

console.log('Testing login with developer credentials:', credentials);

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(credentials)
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Login response:', JSON.stringify(data, null, 2));
  if (data.token) {
    console.log('✅ Login successful!');
    console.log('Token:', data.token.substring(0, 20) + '...');
    console.log('User ID:', data.user.id);
    console.log('User Email:', data.user.email);
    console.log('User Role:', data.user.role);
    console.log('Tenant ID:', data.user.tenantId);
  } else {
    console.log('❌ Login failed:', data.error);
  }
})
.catch(error => {
  console.error('Error:', error);
});