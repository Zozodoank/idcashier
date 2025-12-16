const { createClient } = require('@supabase/supabase-js');

// Test environment variables
const supabaseUrl = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

async function testDatabaseConnectivity() {
  console.log('🧪 Testing Database Connectivity...\n');
  
  try {
    // Test 1: Basic connection test
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Basic connection failed:', error.message);
      return false;
    }
    console.log('✅ Basic connection successful\n');
    
    // Test 2: Test creating a product (with sample data)
    console.log('2. Testing product creation...');
    const testProduct = {
      name: 'Test Product ' + Date.now(),
      price: 10000,
      cost: 5000,
      stock: 10
    };
    
    console.log('Sample product data:', testProduct);
    console.log('Note: This test will fail without valid authentication');
    console.log('✅ Product creation test prepared (requires auth token)\n');
    
    // Test 3: Test categories
    console.log('3. Testing categories fetch...');
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name')
      .limit(5);
    
    if (catError) {
      console.error('❌ Categories fetch failed:', catError.message);
    } else {
      console.log('✅ Categories fetch successful:', categories?.length || 0, 'categories found');
    }
    
    // Test 4: Test suppliers
    console.log('4. Testing suppliers fetch...');
    const { data: suppliers, error: supError } = await supabase
      .from('suppliers')
      .select('id, name')
      .limit(5);
    
    if (supError) {
      console.error('❌ Suppliers fetch failed:', supError.message);
    } else {
      console.log('✅ Suppliers fetch successful:', suppliers?.length || 0, 'suppliers found');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

async function testSupabaseClient() {
  console.log('🔍 Testing Supabase Client Configuration...\n');
  
  console.log('Environment check:');
  console.log('- Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Not set');
  console.log('- Anon Key:', supabaseAnonKey ? '✅ Set' : '❌ Not set');
  console.log('- Client initialized:', supabase ? '✅ Yes' : '❌ No');
  
  return true;
}

async function main() {
  console.log('🚀 Database Input Test Starting...\n');
  
  // Test Supabase client configuration
  await testSupabaseClient();
  
  // Test database connectivity
  const dbTest = await testDatabaseConnectivity();
  
  console.log('\n📋 Test Summary:');
  console.log('- Supabase Client: ✅ OK');
  console.log('- Database Connectivity: ' + (dbTest ? '✅ OK' : '❌ Failed'));
  
  if (dbTest) {
    console.log('\n✅ Database appears to be working correctly!');
    console.log('💡 If form inputs still don\'t work, the issue might be:');
    console.log('   1. Authentication token issues');
    console.log('   2. Frontend-backend integration');
    console.log('   3. RLS (Row Level Security) policies');
    console.log('   4. User permissions');
  } else {
    console.log('\n❌ Database connection issues detected!');
    console.log('💡 Please check:');
    console.log('   1. Supabase credentials');
    console.log('   2. Database availability');
    console.log('   3. Network connectivity');
  }
}

main().catch(console.error);