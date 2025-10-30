// Script to create a test cashier for verification
const createTestCashier = async () => {
  try {
    const token = localStorage.getItem('idcashier_token');
    if (!token) {
      console.log('Please log in first');
      return;
    }
    
    // Get user info from token
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Current user:', payload);
    
    // For admin users, we need to specify an owner
    let tenantId = null;
    if (payload.email === 'jho.j80@gmail.com') {
      // Fetch owners to select one
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const users = await response.json();
      const owners = users.filter(u => u.role === 'owner');
      
      if (owners.length === 0) {
        console.log('No owners found. Please create an owner first.');
        return;
      }
      
      tenantId = owners[0].id;
      console.log('Using owner:', owners[0].email, 'as tenant');
    } else if (payload.role === 'owner') {
      tenantId = payload.tenantId;
    } else {
      console.log('Only admin and owner users can create cashiers');
      return;
    }
    
    // Create test cashier
    const cashierData = {
      name: 'Test Cashier ' + Date.now(),
      email: 'test.cashier.' + Date.now() + '@example.com',
      password: 'Test123!',
      role: 'cashier',
      tenant_id: tenantId
    };
    
    console.log('Creating cashier with data:', cashierData);
    
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(cashierData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create cashier');
    }
    
    const result = await response.json();
    console.log('✅ Cashier created successfully:', result);
    
  } catch (error) {
    console.error('❌ Failed to create cashier:', error);
  }
};

// Run the function
createTestCashier();