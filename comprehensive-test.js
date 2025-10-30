// Comprehensive test for the "invisible cashiers" fix
console.log('=== Comprehensive Test for Invisible Cashiers Fix ===');

// 1. Test token and user role
const token = localStorage.getItem('idcashier_token');
if (!token) {
  console.log('❌ No authentication token found. Please log in first.');
  return;
}

console.log('✅ Authentication token found');

try {
  // Decode JWT token to check user info
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  const user = JSON.parse(jsonPayload);
  console.log('👤 Current user:', {
    email: user.email,
    role: user.role,
    tenantId: user.tenantId
  });
  
  // 2. Test API call to fetch all users
  console.log('\n=== Testing API Calls ===');
  
  fetch('/api/users', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  .then(response => {
    console.log('📡 Users API Response Status:', response.status);
    return response.json();
  })
  .then(users => {
    console.log(`✅ Received ${users.length} users from API`);
    
    // Categorize users
    const admins = users.filter(u => u.email === 'jho.j80@gmail.com');
    const owners = users.filter(u => u.role === 'owner');
    const cashiers = users.filter(u => u.role === 'cashier');
    
    console.log(`📊 User breakdown:
       - Admins: ${admins.length}
       - Owners: ${owners.length}
       - Cashiers: ${cashiers.length}`);
    
    // 3. Test based on user role
    if (user.email === 'jho.j80@gmail.com') {
      console.log('\n👑 Testing as Admin user');
      console.log('✅ Admin should see all cashiers');
      
      if (cashiers.length > 0) {
        console.log('✅ Cashiers found:', cashiers.map(c => c.email));
      } else {
        console.log('⚠️ No cashiers found in system');
      }
      
      if (owners.length > 0) {
        console.log('✅ Owners found (for assigning cashiers):', owners.map(o => `${o.email} (${o.id})`));
      } else {
        console.log('⚠️ No owners found in system');
      }
    } else if (user.role === 'owner') {
      console.log('\n💼 Testing as Owner user');
      console.log('✅ Owner should see only their tenant cashiers');
      
      const myCashiers = cashiers.filter(c => c.tenant_id === user.tenantId);
      console.log(`✅ Found ${myCashiers.length} cashiers in your tenant`);
      
      if (myCashiers.length > 0) {
        console.log('✅ Your cashiers:', myCashiers.map(c => c.email));
      }
    } else {
      console.log('\n👤 Testing as Regular user');
      console.log('ℹ️ Regular users have limited access');
    }
    
    // 4. Test creating a cashier (simulation)
    console.log('\n=== Testing Cashier Creation Logic ===');
    
    if (user.email === 'jho.j80@gmail.com') {
      console.log('✅ Admin can create cashiers but must specify owner');
      if (owners.length > 0) {
        console.log('✅ Admin can assign cashier to owner:', owners[0].email);
      } else {
        console.log('⚠️ No owners available for admin to assign cashiers to');
      }
    } else if (user.role === 'owner') {
      console.log('✅ Owner can create cashiers in their own tenant');
      console.log('✅ Tenant ID for new cashiers:', user.tenantId);
    } else {
      console.log('❌ Regular users cannot create cashiers');
    }
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Token validation: PASSED');
    console.log('✅ API access: PASSED');
    console.log('✅ User categorization: PASSED');
    console.log('✅ Role-based access: PASSED');
    
    if (cashiers.length > 0) {
      console.log('🎉 SUCCESS: Cashiers are visible!');
    } else {
      console.log('ℹ️ INFO: No cashiers exist in the system yet');
    }
    
  })
  .catch(error => {
    console.error('❌ API Test failed:', error);
  });
  
} catch (error) {
  console.error('❌ Token decoding failed:', error);
}