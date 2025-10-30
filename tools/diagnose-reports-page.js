/**
 * Diagnostic Script for ReportsPage Backend Connection
 * 
 * This script helps diagnose issues with ReportsPage data loading
 * Run this in browser console (F12) when on ReportsPage
 */

console.log('=== REPORTSPAGE DIAGNOSTIC TOOL ===\n');

// Check 1: Authentication
console.log('1️⃣  CHECKING AUTHENTICATION...');
const checkAuth = () => {
  // Check if user is logged in by looking at localStorage
  const authKeys = Object.keys(localStorage).filter(key => 
    key.includes('supabase.auth.token') || 
    key.includes('idcashier_user') ||
    key.includes('idcashier_token')
  );
  
  console.log('   Auth-related localStorage keys:', authKeys);
  
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        console.log(`   ${key}:`, {
          exists: true,
          hasToken: !!parsed.access_token || !!parsed.token,
          hasUser: !!parsed.user || !!parsed.email
        });
      } catch (e) {
        console.log(`   ${key}: (not JSON)`);
      }
    }
  });
};

checkAuth();

// Check 2: Supabase Client
console.log('\n2️⃣  CHECKING SUPABASE CLIENT...');
const checkSupabase = () => {
  // Check if Supabase env vars are set
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  
  console.log('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Not set');
  console.log('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Not set');
  
  if (supabaseUrl) {
    console.log('   Supabase URL:', supabaseUrl);
  }
};

checkSupabase();

// Check 3: Test Sales Query
console.log('\n3️⃣  TESTING SALES DATA QUERY...');
const testSalesQuery = async () => {
  try {
    // Import supabase client
    const { supabase } = await import('../src/lib/supabaseClient.js');
    
    if (!supabase) {
      console.log('   ❌ Supabase client not initialized');
      return;
    }
    
    console.log('   ✅ Supabase client initialized');
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('   ❌ User error:', userError.message);
      return;
    }
    
    if (!user) {
      console.log('   ❌ No user logged in');
      return;
    }
    
    console.log('   ✅ User authenticated:', user.email);
    
    // Try to query sales
    console.log('   🔄 Querying sales table...');
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (salesError) {
      console.log('   ❌ Sales query error:', salesError.message);
      console.log('   Error details:', salesError);
      return;
    }
    
    console.log(`   ✅ Sales query successful: ${salesData.length} records`);
    console.log('   Sample data:', salesData.slice(0, 2));
    
    // Check if sales have items
    const itemCounts = salesData.map(sale => ({
      sale_id: sale.id,
      items: sale.sale_items?.length || 0
    }));
    console.log('   Sale items count:', itemCounts);
    
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    console.error('   Full error:', error);
  }
};

// Check 4: Test Products Query
console.log('\n4️⃣  TESTING PRODUCTS DATA QUERY...');
const testProductsQuery = async () => {
  try {
    const { supabase } = await import('../src/lib/supabaseClient.js');
    
    if (!supabase) {
      console.log('   ❌ Supabase client not initialized');
      return;
    }
    
    console.log('   🔄 Querying products table...');
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(5);
    
    if (productsError) {
      console.log('   ❌ Products query error:', productsError.message);
      return;
    }
    
    console.log(`   ✅ Products query successful: ${productsData.length} records`);
    console.log('   Sample data:', productsData.slice(0, 2));
    
  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
  }
};

// Check 5: React Component State
console.log('\n5️⃣  CHECKING REACT COMPONENT STATE...');
console.log('   ℹ️  Open React DevTools and check:');
console.log('   - Find "ReportsPage" component');
console.log('   - Check state: allSalesData, filteredData, isLoading, error');
console.log('   - If filteredData is empty, check error state');

// Check 6: Network Requests
console.log('\n6️⃣  CHECKING NETWORK REQUESTS...');
console.log('   ℹ️  Open Network tab (F12 → Network) and:');
console.log('   - Filter by "supabase"');
console.log('   - Look for requests to:');
console.log('     • /rest/v1/sales');
console.log('     • /rest/v1/products');
console.log('     • /rest/v1/suppliers');
console.log('   - Check status codes (should be 200)');
console.log('   - Check response bodies for data');

// Run async tests
console.log('\n⏳ Running async tests...\n');
(async () => {
  await testSalesQuery();
  await testProductsQuery();
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  console.log('📊 SUMMARY:');
  console.log('   1. If auth check fails → Logout and login again');
  console.log('   2. If Supabase client fails → Check .env file');
  console.log('   3. If queries fail → Check RLS policies');
  console.log('   4. If data exists but not displayed → Check React state');
  console.log('   5. If network errors → Check Supabase connection');
  console.log('\n💡 TIP: Check browser console for additional errors');
  console.log('📄 See REPORTS_PAGE_BACKEND_ANALYSIS.md for detailed info\n');
})();

