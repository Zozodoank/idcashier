// Script to test if all required tables exist in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('Testing Supabase schema...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment variables.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test if all required tables exist
async function testSchema() {
  const requiredTables = [
    'users',
    'customers',
    'categories',
    'suppliers',
    'products',
    'sales',
    'sale_items',
    'subscriptions'
  ];

  console.log('Checking if all required tables exist...');
  
  for (const tableName of requiredTables) {
    try {
      // Try to get a small amount of data to test if table exists
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${tableName}' error:`, error.message);
      } else {
        console.log(`✅ Table '${tableName}' exists`);
      }
    } catch (error) {
      console.log(`❌ Table '${tableName}' error:`, error.message);
    }
  }
  
  console.log('\nTesting specific queries...');
  
  // Test a more complex query to check relationships
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name),
        suppliers(name)
      `)
      .limit(1);
    
    if (error) {
      console.log('❌ Products query error:', error.message);
    } else {
      console.log('✅ Products query successful');
    }
  } catch (error) {
    console.log('❌ Products query error:', error.message);
  }
  
  // Test sales query
  try {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customers(name)
      `)
      .limit(1);
    
    if (error) {
      console.log('❌ Sales query error:', error.message);
    } else {
      console.log('✅ Sales query successful');
    }
  } catch (error) {
    console.log('❌ Sales query error:', error.message);
  }
  
  console.log('\nSchema test completed.');
}

testSchema().catch(console.error);