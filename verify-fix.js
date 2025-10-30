// Simple verification script for the invisible cashiers fix
console.log('=== Verifying Invisible Cashiers Fix ===');

const verifyFix = async () => {
  try {
    const token = localStorage.getItem('idcashier_token');
    if (!token) {
      console.log('❌ Please log in first');
      return;
    }
    
    console.log('✅ Token found');
    
    // Decode token to check user role
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isAdmin = payload.email === 'jho.j80@gmail.com';
    const isOwner = payload.role === 'owner';
    
    console.log(`👤 User: ${payload.email} (${payload.role})`);
    
    // Fetch users
    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status}`);
      return;
    }
    
    const users = await response.json();
    const cashiers = users.filter(u => u.role === 'cashier');
    
    console.log(`📊 Found ${users.length} total users`);
    console.log(`💰 Found ${cashiers.length} cashiers`);
    
    if (isAdmin) {
      console.log('👑 Admin user detected');
      if (cashiers.length > 0) {
        console.log('✅ SUCCESS: Admin can see cashiers');
        console.log('📋 Sample cashiers:', cashiers.slice(0, 3).map(c => ({
          email: c.email,
          tenant_id: c.tenant_id
        })));
      } else {
        console.log('ℹ️ No cashiers exist yet');
      }
    } else if (isOwner) {
      console.log('💼 Owner user detected');
      const myCashiers = cashiers.filter(c => c.tenant_id === payload.tenantId);
      console.log(`✅ Owner has ${myCashiers.length} cashiers in their tenant`);
    } else {
      console.log('👤 Regular user - limited access');
    }
    
    console.log('🎉 Verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
};

// Run verification
verifyFix();