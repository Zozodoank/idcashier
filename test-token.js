// Test script to decode and verify JWT token
const testToken = () => {
  try {
    // Get token from localStorage
    const token = localStorage.getItem('idcashier_token');
    
    if (!token) {
      console.log('No token found. Please log in first.');
      return;
    }
    
    console.log('Token found:', token.substring(0, 50) + '...');
    
    // Decode the JWT token (without verification)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const decoded = JSON.parse(jsonPayload);
    console.log('Decoded token:', decoded);
    
    // Check if user is admin
    if (decoded.email === 'jho.j80@gmail.com') {
      console.log('User is admin - should see all cashiers');
    } else if (decoded.role === 'owner') {
      console.log('User is owner - should see only their tenant cashiers');
    } else {
      console.log('User is regular user - should see only themselves');
    }
    
  } catch (error) {
    console.error('Token test failed:', error);
  }
};

// Run the test
testToken();