// Script to verify if payments and subscriptions tables exist
import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Create Supabase client with service role key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTables() {
  try {
    console.log('Checking if payments table exists...');
    
    // Check if payments table exists
    const { data: paymentsTable, error: paymentsError } = await supabase
      .from('payments')
      .select('id')
      .limit(1);
    
    if (paymentsError) {
      console.log('Payments table does not exist or is not accessible');
      console.log('Error:', paymentsError.message);
    } else {
      console.log('✓ Payments table exists and is accessible');
    }
    
    console.log('\nChecking if subscriptions table exists...');
    
    // Check if subscriptions table exists
    const { data: subscriptionsTable, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);
    
    if (subscriptionsError) {
      console.log('Subscriptions table does not exist or is not accessible');
      console.log('Error:', subscriptionsError.message);
    } else {
      console.log('✓ Subscriptions table exists and is accessible');
    }
    
    // List all tables in the database
    console.log('\nListing all tables in the database...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.error('Error listing tables:', tablesError.message);
    } else {
      console.log('Tables in database:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

verifyTables();