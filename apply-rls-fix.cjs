const fs = require('fs');
const { execSync } = require('child_process');

async function applyRLSFix() {
  console.log('🔧 APPLYING RLS POLICIES FIX FOR CRONJOB');
  console.log('=' .repeat(70));
  
  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync('fix-cronjob-rls-policies.sql', 'utf8');
    
    console.log('📋 Migration SQL file loaded successfully');
    console.log('📊 SQL file size:', migrationSQL.length, 'characters');
    
    // Split SQL into individual statements for better execution
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Save individual statements for manual execution
    console.log('\n📋 SAVING INDIVIDUAL STATEMENTS FOR EXECUTION');
    
    let executedCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length > 0) {
        const filename = `statement_${i.toString().padStart(3, '0')}.sql`;
        fs.writeFileSync(filename, statement + ';');
        executedCount++;
      }
    }
    
    console.log(`✅ Saved ${executedCount} statements to individual SQL files`);
    
    // Alternative approach: Create a Node.js script to apply via Supabase API
    console.log('\n📋 CREATING SUPABASE API SCRIPT FOR MIGRATION');
    
    const apiScript = `
// Migration application script for Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const supabaseServiceKey = 'your-service-role-key-here'; // Replace with actual service key

async function applyMigration() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('Applying RLS policies fix...');
    
    // Execute the migration via SQL RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: \`
        -- Fix RLS Policies for Cronjob Data Access
        -- This migration will add policies that allow cronjob to access user data
        
        -- Create policies for products table
        DROP POLICY IF EXISTS "Allow tenant access on products" ON products;
        CREATE POLICY "Allow tenant access on products" ON products
            FOR ALL
            USING (
                user_id = auth.uid()
                OR
                user_id IN (
                    SELECT id FROM users WHERE tenant_id = auth.uid()
                )
                OR
                user_id = (
                    SELECT id FROM users WHERE email = 'demo@idcashier.com'
                )
            );
        
        -- Create policies for sales table  
        DROP POLICY IF EXISTS "Allow tenant access on sales" ON sales;
        CREATE POLICY "Allow tenant access on sales" ON sales
            FOR ALL
            USING (
                user_id = auth.uid()
                OR
                user_id IN (
                    SELECT id FROM users WHERE tenant_id = auth.uid()
                )
                OR
                user_id = (
                    SELECT id FROM users WHERE email = 'demo@idcashier.com'
                )
            );
      \`
    });
    
    if (error) {
      console.error('Migration failed:', error);
      return false;
    }
    
    console.log('✅ RLS policies migration completed successfully');
    return true;
    
  } catch (error) {
    console.error('Error applying migration:', error);
    return false;
  }
}

applyMigration();
`;
    
    fs.writeFileSync('apply-rls-migration.js', apiScript);
    console.log('✅ Created apply-rls-migration.js for Supabase API execution');
    
    // Create manual instructions
    const instructions = `
# MANUAL MIGRATION INSTRUCTIONS

Since Supabase MCP tools are not available, please execute the RLS fix manually:

## Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of fix-cronjob-rls-policies.sql
4. Execute the script
5. Verify the policies were created

## Option 2: Command Line (if you have Supabase CLI)
\`\`\`bash
supabase db reset --linked
supabase db push --linked
\`\`\`

## Option 3: Individual Statements
Execute each numbered statement from statement_000.sql to statement_xxx.sql

## After applying migration:
1. Run the test: \`node create-and-test-demo-data.js\`
2. Check if cronjob now sees the created products
3. Verify data deletion works
`;
    
    fs.writeFileSync('MANUAL_MIGRATION_INSTRUCTIONS.md', instructions);
    console.log('✅ Created MANUAL_MIGRATION_INSTRUCTIONS.md');
    
    // Create alternative cronjob fix
    const alternativeCronjobFix = `
// Alternative approach: Modify cronjob to use edge function pattern
// Instead of direct Supabase client, use edge functions

// Current problematic code in demo-reset/index.ts:
// const { data: products } = await supabase.from('products').select('id').in('user_id', userIds)

// Alternative fix:
async function getProductsViaEdgeFunction(userToken) {
  const response = await fetch(\`\${SUPABASE_URL}/functions/v1/products-get-all\`, {
    headers: {
      'Authorization': \`Bearer \${userToken}\`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.ok) {
    const result = await response.json();
    return result.data || [];
  }
  return [];
}

// Modified products counting logic:
const products = await getProductsViaEdgeFunction(userToken);
const productIds = products.map(p => p.id);
console.log('Products found via edge function:', productIds.length);
`;
    
    fs.writeFileSync('alternative-cronjob-fix.js', alternativeCronjobFix);
    console.log('✅ Created alternative-cronjob-fix.js');
    
    console.log('\n' + '=' .repeat(70));
    console.log('📊 RLS FIX PREPARATION COMPLETED');
    console.log('=' .repeat(70));
    console.log('✅ Migration SQL created: fix-cronjob-rls-policies.sql');
    console.log('✅ Individual statements saved: statement_xxx.sql files');
    console.log('✅ API script created: apply-rls-migration.js');
    console.log('✅ Instructions created: MANUAL_MIGRATION_INSTRUCTIONS.md');
    console.log('✅ Alternative fix created: alternative-cronjob-fix.js');
    
    console.log('\n🚨 NEXT STEPS:');
    console.log('1. Execute migration via Supabase Dashboard');
    console.log('2. Test with: node create-and-test-demo-data.js');
    console.log('3. Verify cronjob can access created data');
    
  } catch (error) {
    console.error('❌ Error preparing RLS fix:', error.message);
  }
}

applyRLSFix();