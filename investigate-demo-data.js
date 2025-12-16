const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3OTk2NTgsImV4cCI6MjA0MjM3NTY1OH0.qG7uHqK-5J9d5T6vN0bH9mF3wW8YkQ2pS1tC3zL2vQ';

async function queryDatabase(table, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${filter}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.log(`❌ Error querying ${table}:`, error.message);
    return [];
  }
}

async function countRecords(table, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id&${filter}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return { count: 0, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const data = await response.json();
    return { count: data.length, error: null };
  } catch (error) {
    return { count: 0, error: error.message };
  }
}

async function investigateDemoData() {
  console.log('🔍 INVESTIGATING DEMO USER DATA');
  console.log('=' .repeat(70));
  
  // Step 1: Find demo user
  console.log('\n📋 STEP 1: Finding demo user');
  const demoUsers = await queryDatabase('users', '&email=eq.demo@idcashier.my.id');
  
  if (demoUsers.length === 0) {
    console.log('❌ Demo user NOT FOUND in users table');
    
    // Check if demo user exists dengan different email patterns
    console.log('\n🔍 Checking for similar email patterns...');
    const allUsers = await queryDatabase('users');
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Show first few users to see email patterns
    if (allUsers.length > 0) {
      console.log('📋 Sample users:');
      allUsers.slice(0, 5).forEach(user => {
        console.log(`  - ID: ${user.id}, Email: ${user.email}, Role: ${user.role || 'N/A'}`);
      });
    }
    
    return;
  }
  
  const demoUser = demoUsers[0];
  console.log('✅ Demo user found:');
  console.log(`  - ID: ${demoUser.id}`);
  console.log(`  - Email: ${demoUser.email}`);
  console.log(`  - Role: ${demoUser.role || 'N/A'}`);
  console.log(`  - Tenant ID: ${demoUser.tenant_id || 'N/A'}`);
  
  // Step 2: Check data assignments
  console.log('\n📋 STEP 2: Checking data assignments by user_id');
  
  const tables = [
    'products', 'sales', 'customers', 'suppliers', 'categories',
    'employees', 'expenses', 'app_settings', 'returns'
  ];
  
  for (const table of tables) {
    const result = await countRecords(table, `&user_id=eq.${demoUser.id}`);
    console.log(`${table}: ${result.count} records ${result.error ? `(Error: ${result.error})` : ''}`);
  }
  
  // Step 3: Check data assignments by tenant_id
  console.log('\n📋 STEP 3: Checking data assignments by tenant_id');
  
  for (const table of tables) {
    const result = await countRecords(table, `&tenant_id=eq.${demoUser.id}`);
    console.log(`${table} (tenant_id): ${result.count} records ${result.error ? `(Error: ${result.error})` : ''}`);
  }
  
  // Step 4: Check if data exists with different IDs
  console.log('\n📋 STEP 4: Checking what data exists in demo tenant');
  
  // Check if data exists dengan id parameter (for tables that might use ID directly)
  const demoTenantTables = ['employees', 'devices'];
  
  for (const table of demoTenantTables) {
    const result = await countRecords(table, `&id=eq.${demoUser.id}`);
    console.log(`${table} (id): ${result.count} records ${result.error ? `(Error: ${result.error})` : ''}`);
  }
  
  // Step 5: Show actual sample data if exists
  console.log('\n📋 STEP 5: Sample existing data');
  
  const productCount = await countRecords('products', `&user_id=eq.${demoUser.id}`);
  if (productCount.count > 0) {
    console.log('📦 Products sample:');
    const products = await queryDatabase('products', `&user_id=eq.${demoUser.id}&limit=3`);
    products.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Price: ${p.price || 'N/A'})`);
    });
  }
  
  const salesCount = await countRecords('sales', `&user_id=eq.${demoUser.id}`);
  if (salesCount.count > 0) {
    console.log('💰 Sales sample:');
    const sales = await queryDatabase('sales', `&user_id=eq.${demoUser.id}&limit=3`);
    sales.forEach(s => {
      console.log(`  - Sale ${s.id} (Amount: ${s.total_amount || 'N/A'})`);
    });
  }
  
  // Step 6: Summary and recommendations
  console.log('\n' + '=' .repeat(70));
  console.log('📊 INVESTIGATION SUMMARY');
  console.log('=' .repeat(70));
  
  const userDataCount = await countRecords('products', `&user_id=eq.${demoUser.id}`);
  const tenantDataCount = await countRecords('employees', `&tenant_id=eq.${demoUser.id}`);
  
  if (userDataCount.count === 0 && tenantDataCount.count === 0) {
    console.log('❌ NO DATA FOUND for demo user');
    console.log('💡 Possible reasons:');
    console.log('  1. Demo user has not been used (no transaction data created)');
    console.log('  2. Data assigned to different user ID');
    console.log('  3. Data columns don\'t match expected schema');
    console.log('  4. RLS policies blocking access');
    console.log('  5. Data exists in different tables');
  } else {
    console.log('✅ Some data exists for demo user:');
    console.log(`  - User data: ${userDataCount.count} records`);
    console.log(`  - Tenant data: ${tenantDataCount.count} records`);
    console.log('💡 Issue might be in cronjob column mapping');
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Create some demo data to test cronjob');
  console.log('2. Fix column mappings in cronjob if needed');
  console.log('3. Check RLS policies for demo user');
}

investigateDemoData().catch(console.error);