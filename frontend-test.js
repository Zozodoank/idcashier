// Simple test to check frontend API call
async function testFrontendAPI() {
  try {
    console.log('Testing frontend API call...');
    
    // Simulate getting token from localStorage
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRkZDZiZDNkLTE2YmQtNGE4OS04MjYyLTE0MTU5YjQwNGEwMyIsImVtYWlsIjoiZGVtb0BpZGNhc2hpZXIubXkuaWQiLCJyb2xlIjoib3duZXIiLCJ0ZW5hbnRJZCI6ImRkZDZiZDNkLTE2YmQtNGE4OS04MjYyLTE0MTU5YjQwNGEwMyIsImlhdCI6MTc2MDg0NjE4MSwiZXhwIjoxNzYwOTMyNTgxfQ.5X5XY5XY5XY5XY5XY5XY5XY5XY5XY5XY5XY5XY5XY5X'; // Demo user token
    
    if (!token) {
      console.log('No token found');
      return;
    }
    
    console.log('Making API call with token...');
    
    // Simulate the fetch call that salesAPI.getAll makes
    const response = await fetch('http://localhost:3001/api/sales', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('Data received:', JSON.stringify(data, null, 2));
    console.log('Data length:', data.length);
    
    // Check if items are present
    if (data.length > 0) {
      console.log('First item items:', data[0].items);
      console.log('First item items length:', data[0].items ? data[0].items.length : 'undefined');
    }
    
  } catch (error) {
    console.error('Frontend test error:', error);
  }
}

testFrontendAPI();