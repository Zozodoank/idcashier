const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3OTk2NTgsImV4cCI6MjA0MjM3NTY1OH0.qG7uHqK-5J9d5T6vN0bH9mF3wW8YkQ2pS1tC3zL2vQ';
const CRONJOB_SECRET = 'e3452f961b057322e7012c4bc207765b10422359ae41ed341af8695496f257e0';

async function createDemoData() {
  console.log('🔧 CREATING DEMO DATA FOR CRONJOB TESTING');
  console.log('=' .repeat(70));
  
  try {
    // First, get demo user via edge function
    console.log('\n📋 STEP 1: Getting demo user via edge function');
    
    const loginResponse = await fetch(`${SUPABASE_URL}/functions/v1/auth-login-final`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: 'demo@idcashier.my.id',
        password: 'Demo2025'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const loginData = await loginResponse.json();
    const userToken = loginData.token;
    const demoUserId = loginData.user?.id;
    
    console.log('✅ Login successful');
    console.log('📊 Demo user ID:', demoUserId);
    
    if (!demoUserId) {
      throw new Error('Demo user ID not found in login response');
    }
    
    // Step 2: Create sample products
    console.log('\n📋 STEP 2: Creating sample products');
    
    const products = [
      {
        name: 'Test Product 1',
        price: 10000,
        cost: 8000,
        stock: 50,
        barcode: '1234567890123'
      },
      {
        name: 'Test Product 2', 
        price: 15000,
        cost: 12000,
        stock: 30,
        barcode: '1234567890124'
      },
      {
        name: 'Test Product 3',
        price: 20000,
        cost: 16000,
        stock: 20,
        barcode: '1234567890125'
      }
    ];
    
    for (const product of products) {
      const createResponse = await fetch(`${SUPABASE_URL}/functions/v1/products-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: product.name,
          price: product.price,
          cost: product.cost,
          stock: product.stock,
          barcode: product.barcode
        })
      });
      
      if (createResponse.ok) {
        const productData = await createResponse.json();
        console.log(`✅ Created product: ${product.name} (ID: ${productData.data?.id || 'Unknown'})`);
      } else {
        const error = await createResponse.json();
        console.log(`❌ Failed to create ${product.name}:`, error.error || error);
      }
    }
    
    // Step 3: Create sample supplier
    console.log('\n📋 STEP 3: Creating sample supplier');
    
    const supplierResponse = await fetch(`${SUPABASE_URL}/functions/v1/suppliers-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Test Supplier',
        address: 'Jakarta',
        phone: '021-123456789'
      })
    });
    
    if (supplierResponse.ok) {
      const supplierData = await supplierResponse.json();
      console.log(`✅ Created supplier: ${supplierData.data?.name || 'Test Supplier'} (ID: ${supplierData.data?.id || 'Unknown'})`);
    } else {
      const error = await supplierResponse.json();
      console.log('❌ Failed to create supplier:', error.error || error);
    }
    
    // Step 4: Create sample category
    console.log('\n📋 STEP 4: Creating sample category');
    
    const categoryResponse = await fetch(`${SUPABASE_URL}/functions/v1/categories-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Test Category'
      })
    });
    
    if (categoryResponse.ok) {
      const categoryData = await categoryResponse.json();
      console.log(`✅ Created category: ${categoryData.data?.name || 'Test Category'} (ID: ${categoryData.data?.id || 'Unknown'})`);
    } else {
      const error = await categoryResponse.json();
      console.log('❌ Failed to create category:', error.error || error);
    }
    
    // Step 5: Create sample customer
    console.log('\n📋 STEP 5: Creating sample customer');
    
    const customerResponse = await fetch(`${SUPABASE_URL}/functions/v1/customers-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'test@customer.com',
        phone: '081234567890'
      })
    });
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      console.log(`✅ Created customer: ${customerData.data?.name || 'Test Customer'} (ID: ${customerData.data?.id || 'Unknown'})`);
    } else {
      const error = await customerResponse.json();
      console.log('❌ Failed to create customer:', error.error || error);
    }
    
    console.log('\n📋 STEP 6: Testing cronjob with new data');
    console.log('⚠️  This should now delete the newly created data!');
    
    const cronjobUrl = `https://eypfeiqtvfxxiimhtycc.functions.supabase.co/demo-reset?secret=${CRONJOB_SECRET}`;
    
    const cronjobResponse = await fetch(cronjobUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const cronjobResult = await cronjobResponse.json();
    console.log('\n📊 CRONJOB RESULT:');
    console.log(`Status: ${cronjobResponse.status}`);
    console.log('Response:', JSON.stringify(cronjobResult, null, 2));
    
    if (cronjobResult.summary) {
      console.log('\n📋 DATA SUMMARY AFTER CRONJOB:');
      console.log(`Products: ${cronjobResult.summary.products}`);
      console.log(`Employees: ${cronjobResult.summary.employees}`);
      console.log(`Employee Users: ${cronjobResult.summary.employeeUsers}`);
      console.log(`Cashier Users: ${cronjobResult.summary.cashierUsers}`);
      
      if (cronjobResult.summary.products > 0) {
        console.log('✅ SUCCESS: Cronjob detected and would delete products!');
      } else {
        console.log('❌ ISSUE: Cronjob still sees no products to delete');
      }
    }
    
  } catch (error) {
    console.error('❌ Error in demo data creation:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('📋 CONCLUSION');
  console.log('=' .repeat(70));
  console.log('This script creates sample demo data and tests the cronjob.');
  console.log('If cronjob still shows 0 for all data, then there may be:');
  console.log('1. RLS policies blocking cronjob access');
  console.log('2. Wrong column mappings in cronjob');
  console.log('3. Demo user ID not matching data assignments');
}

createDemoData();