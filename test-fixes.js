// Test script to verify the fixes
console.log('Testing fixes for "The Case of the Invisible Cashiers (Supabase Edition)"');

// 1. Test token decoding
const token = localStorage.getItem('idcashier_token');
if (token) {
  console.log('Token found, decoding...');
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const decoded = JSON.parse(jsonPayload);
    console.log('User info:', {
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId
    });
    
    if (decoded.email === 'jho.j80@gmail.com') {
      console.log('✅ Admin user detected - should see all cashiers');
    } else if (decoded.role === 'owner') {
      console.log('✅ Owner user detected - should see tenant cashiers');
    } else {
      console.log('ℹ️ Regular user - limited access');
    }
  } catch (e) {
    console.error('Error decoding token:', e);
  }
} else {
  console.log('⚠️ No token found - please log in');
}

// 2. Test API call
const testAPI = async () => {
  if (!token) return;
  
  try {
    console.log('Testing API call to /api/users...');
    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('API Response Status:', response.status);
    
    if (response.ok) {
      const users = await response.json();
      console.log(`✅ API returned ${users.length} users`);
      
      const cashiers = users.filter(u => u.role === 'cashier');
      console.log(`✅ Found ${cashiers.length} cashiers`);
      
      if (cashiers.length > 0) {
        console.log('Sample cashiers:', cashiers.slice(0, 3));
      }
    } else {
      console.log('❌ API Error:', await response.text());
    }
  } catch (e) {
    console.error('API Test Error:', e);
  }
};

testAPI();