// Test script to verify users API response
const testUsersAPI = async () => {
  try {
    // Get token from localStorage (you need to be logged in)
    const token = localStorage.getItem('idcashier_token');
    
    if (!token) {
      console.log('No token found. Please log in first.');
      return;
    }
    
    console.log('Fetching users with token:', token.substring(0, 20) + '...');
    
    // Test the users API
    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      return;
    }
    
    const users = await response.json();
    console.log('Users fetched successfully:');
    console.log('Total users:', users.length);
    console.log('Users:', users);
    
    // Filter cashiers
    const cashiers = users.filter(user => user.role === 'cashier');
    console.log('Total cashiers:', cashiers.length);
    console.log('Cashiers:', cashiers);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Run the test
testUsersAPI();