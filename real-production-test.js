const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3OTk2NTgsImV4cCI6MjA0MjM3NTY1OH0.qG7uHqK-5J9d5T6vN0bH9mF3wW8YkQ2pS1tC3zL2vQ';
const CRONJOB_SECRET = 'e3452f961b057322e7012c4bc207765b10422359ae41ed341af8695496f257e0';

async function fetchWithDetailedError(url, options = {}) {
  try {
    console.log(`🚀 Making request to: ${url.substring(0, 100)}...`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        ...options.headers
      }
    });
    
    const responseTime = Date.now() - startTime;
    const text = await response.text();
    
    console.log(`📊 Status: ${response.status} ${response.statusText} | Time: ${responseTime}ms`);
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()));
    
    let result;
    try {
      result = JSON.parse(text);
      console.log(`📦 JSON Response:`, JSON.stringify(result, null, 2));
    } catch {
      console.log(`📝 Raw Response:`, text);
      result = { rawResponse: text };
    }
    
    return { 
      success: response.ok, 
      status: response.status, 
      data: result, 
      time: responseTime,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.log(`❌ Fetch Error:`, error.message);
    console.log(`❌ Error Stack:`, error.stack);
    return { success: false, error: error.message, stack: error.stack };
  }
}

async function testProductionModeStepByStep() {
  console.log('🔍 REAL PRODUCTION MODE TRoubleshooting');
  console.log('=' .repeat(70));
  
  const productionUrl = `https://eypfeiqtvfxxiimhtycc.functions.supabase.co/demo-reset?secret=${CRONJOB_SECRET}`;
  
  console.log('\n📋 STEP 1: Testing Production Mode (Real Deletion)');
  console.log('⚠️  WARNING: This will ACTUALLY DELETE demo data!');
  console.log('URL:', productionUrl);
  
  // Test production mode
  const productionResult = await fetchWithDetailedError(productionUrl, { method: 'POST' });
  
  console.log('\n📋 STEP 2: Analysis');
  if (productionResult.success) {
    console.log('✅ Request successful (200)');
    if (productionResult.data.dryRun) {
      console.log('❌ STILL IN DRY RUN MODE despite no dry_run parameter!');
      console.log('📊 Response:', productionResult.data);
    } else if (productionResult.data.success) {
      console.log('✅ Production mode executed');
      console.log('📊 Message:', productionResult.data.message);
      console.log('📊 Summary:', productionResult.data.summary);
    }
  } else {
    console.log('❌ Request failed:', productionResult.error);
  }
  
  console.log('\n📋 STEP 3: Direct Database Check');
  console.log('Checking if demo data actually exists and would be affected...');
  
  // Try to get demo user data to see what would be deleted
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Find demo user
    const { data: demoUser, error } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', 'demo@idcashier.my.id')
      .single();
    
    if (error) {
      console.log('❌ Error finding demo user:', error.message);
    } else {
      console.log('✅ Demo user found:', demoUser);
      
      // Get demo tenant data counts
      const tables = ['sales', 'products', 'employees', 'customers', 'suppliers'];
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', demoUser.id);
          
        if (error) {
          console.log(`❌ Error checking ${table}:`, error.message);
        } else {
          console.log(`📊 ${table}: ${data?.length || 0} records (user_id filter)`);
        }
      }
    }
  } catch (err) {
    console.log('❌ Direct DB check failed:', err.message);
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('📋 FINAL DIAGNOSIS');
  console.log('=' .repeat(70));
  
  if (productionResult.success && !productionResult.data.dryRun) {
    console.log('✅ Cronjob executed in production mode');
    if (productionResult.data.summary) {
      console.log('📊 Records that would be processed:', productionResult.data.summary);
    }
  } else {
    console.log('❌ Potential issues:');
    if (productionResult.data?.dryRun) {
      console.log('- Even without dry_run=1, still returning dryRun=true');
    }
    if (!productionResult.success) {
      console.log('- Request failed:', productionResult.error);
    }
  }
}

testProductionModeStepByStep().catch(console.error);