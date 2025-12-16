
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
      sql_query: `
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
                    SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
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
                    SELECT id FROM users WHERE email = 'demo@idcashier.my.id'
                )
            );
      `
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
