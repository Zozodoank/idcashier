import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('Checking database tables...\n');

  // Check users table structure
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error accessing users table:', error.message);
    } else {
      console.log('✅ Users table exists');
      
      // Check table structure
      const { data: columns, error: columnError } = await supabase
        .from('users')
        .select('*')
        .limit(0);

      if (columnError) {
        console.log('❌ Error checking users table structure:', columnError.message);
      } else {
        // Get actual column names
        if (columns && columns.length === 0) {
          // Try to get column info differently
          console.log('   Users table accessible');
        }
      }
    }
  } catch (err) {
    console.log('❌ Error with users table:', err.message);
  }

  // Check other tables
  const tables = ['customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions', 'password_resets'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Error accessing ${table} table:`, error.message);
      } else {
        console.log(`✅ ${table} table exists`);
      }
    } catch (err) {
      console.log(`❌ Error with ${table} table:`, err.message);
    }
  }

  console.log('\nTable check completed.');
}

checkTables();