// Test script for dashboard API endpoints
console.log('=== Testing Dashboard API Endpoints ===');

const testDashboardAPI = async () => {
  try {
    const token = localStorage.getItem('idcashier_token');
    if (!token) {
      console.log('❌ Please log in first');
      return;
    }
    
    console.log('✅ Authentication token found');
    
    // Test stats endpoint
    console.log('\n--- Testing /api/dashboard/stats ---');
    const statsResponse = await fetch('/api/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Status:', statsResponse.status);
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Stats:', stats);
    } else {
      console.log('❌ Stats Error:', await statsResponse.text());
    }
    
    // Test recent transactions endpoint
    console.log('\n--- Testing /api/dashboard/recent-transactions ---');
    const transactionsResponse = await fetch('/api/dashboard/recent-transactions', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Status:', transactionsResponse.status);
    if (transactionsResponse.ok) {
      const transactions = await transactionsResponse.json();
      console.log('✅ Recent Transactions:', transactions);
    } else {
      console.log('❌ Transactions Error:', await transactionsResponse.text());
    }
    
    // Test top products endpoint
    console.log('\n--- Testing /api/dashboard/top-products ---');
    const productsResponse = await fetch('/api/dashboard/top-products', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Status:', productsResponse.status);
    if (productsResponse.ok) {
      const products = await productsResponse.json();
      console.log('✅ Top Products:', products);
    } else {
      console.log('❌ Products Error:', await productsResponse.text());
    }
    
    console.log('\n=== Dashboard API Test Complete ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testDashboardAPI();