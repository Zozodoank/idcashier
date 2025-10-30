const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Supabase credentials from .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Supabase Schema Verification ===');
console.log('Supabase URL:', supabaseUrl);
console.log('');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySchema() {
  try {
    console.log('Checking database schema...');
    
    // Check if tables exist
    const tablesToCheck = ['users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions'];
    
    for (const table of tablesToCheck) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${table}' not accessible:`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
      }
    }
    
    console.log('\n--- Checking Column Data Types ---');
    
    // Check specific column types
    const columnChecks = [
      { table: 'users', column: 'id', expectedType: 'uuid' },
      { table: 'sales', column: 'user_id', expectedType: 'uuid' },
      { table: 'products', column: 'user_id', expectedType: 'uuid' },
      { table: 'customers', column: 'user_id', expectedType: 'uuid' },
      { table: 'categories', column: 'user_id', expectedType: 'uuid' },
      { table: 'suppliers', column: 'user_id', expectedType: 'uuid' },
      { table: 'subscriptions', column: 'user_id', expectedType: 'uuid' }
    ];
    
    for (const check of columnChecks) {
      const { data, error } = await supabase
        .rpc('execute_sql', { 
          sql: `SELECT data_type FROM information_schema.columns WHERE table_name = '${check.table}' AND column_name = '${check.column}';` 
        });
      
      if (error) {
        console.log(`⚠️  Could not check ${check.table}.${check.column}:`, error.message);
      } else if (data && data.length > 0) {
        const actualType = data[0].data_type;
        if (actualType === check.expectedType) {
          console.log(`✅ ${check.table}.${check.column} is correct type: ${actualType}`);
        } else {
          console.log(`❌ ${check.table}.${check.column} is ${actualType}, expected ${check.expectedType}`);
        }
      } else {
        console.log(`❌ Column ${check.table}.${check.column} not found`);
      }
    }
    
    console.log('\n--- Detailed Users Table Schema ---');
    
    // Get detailed schema for users table
    const { data: columnsData, error: columnsError } = await supabase
      .rpc('execute_sql', { 
        sql: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;` 
      });
    
    if (columnsError) {
      console.log(`❌ Could not retrieve users table schema:`, columnsError.message);
    } else if (columnsData && columnsData.length > 0) {
      console.log('Columns in users table:');
      columnsData.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`);
      });
      
      // Check for permissions column
      const permissionsCol = columnsData.find(col => col.column_name === 'permissions');
      if (permissionsCol) {
        console.log(`\n✅ Permissions column found: ${permissionsCol.data_type}${permissionsCol.is_nullable === 'YES' ? ' NULL' : ''}${permissionsCol.column_default ? ` DEFAULT ${permissionsCol.column_default}` : ''}`);
      } else {
        console.log('\n❌ Permissions column not found in users table');
      }
    } else {
      console.log('❌ No columns found for users table');
    }
    
    console.log('\n--- Schema Verification Complete ---');
    
  } catch (error) {
    console.error('Error verifying schema:', error.message);
    process.exit(1);
  }
}

// Run the verification
console.log('Starting Supabase schema verification...');
verifySchema().then(() => {
  console.log('Schema verification completed');
}).catch(error => {
  console.error('Schema verification failed:', error.message);
  process.exit(1);
});