const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('=== Push Schema to Supabase ===\n');

// Check if schema file exists
const schemaPath = path.resolve(__dirname, 'supabase-schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('❌ Error: supabase-schema.sql file not found!');
  process.exit(1);
}

// Read and validate schema file
try {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  console.log('✅ Schema file found and loaded successfully');
  
  // Basic validation
  const lines = schemaContent.split('\n');
  console.log(`📊 Schema file contains ${lines.length} lines`);
  
  // Count CREATE TABLE statements
  const createTableCount = (schemaContent.match(/CREATE TABLE/g) || []).length;
  console.log(`📊 Found ${createTableCount} CREATE TABLE statements`);
  
  // Check for transactions
  const transactionBlocks = (schemaContent.match(/BEGIN;/g) || []).length;
  console.log(`📊 Found ${transactionBlocks} transaction blocks for data consistency`);
  
  // Count INSERT statements
  const insertCount = (schemaContent.match(/INSERT INTO/g) || []).length;
  console.log(`📊 Found ${insertCount} INSERT statements`);
  
  // Show Supabase connection details
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('\n=== Supabase Connection Details ===');
  console.log(`🌐 URL: ${supabaseUrl}`);
  console.log(`🔑 Anon Key: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'Not found'}`);
  
  // Provide clear step-by-step instructions
  console.log('\n=== How to Push This Schema to Supabase ===');
  console.log('\n📝 STEP 1: Copy the schema content');
  console.log('   1. Open the file: supabase-schema.sql');
  console.log('   2. Copy the entire content of the file');
  
  console.log('\n🌐 STEP 2: Access Supabase Dashboard');
  console.log('   1. Go to: https://app.supabase.com');
  console.log('   2. Log in to your account');
  console.log('   3. Select your project');
  
  console.log('\n🔍 STEP 3: Navigate to SQL Editor');
  console.log('   1. In the left sidebar, click on "SQL Editor"');
  console.log('   2. Click on "+ New query"');
  
  console.log('\n📋 STEP 4: Paste and execute');
  console.log('   1. Paste the copied schema content into the editor');
  console.log('   2. Click the "Run" button');
  console.log('   3. Wait for execution to complete (this may take a moment)');
  
  console.log('\n✅ STEP 5: Verify success');
  console.log('   1. You should see "Success" messages for each statement');
  console.log('   2. Your tables should now appear in the Table Editor');
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('   - If you get errors about existing tables, you may need to drop them first');
  console.log('   - Always backup your database before making schema changes');
  console.log('   - The schema includes sample data which will be inserted');
  
  console.log('\n📚 For alternative methods (CLI, psql), see: PUSH_SCHEMA_INSTRUCTIONS.md\n');
  
  console.log('✅ Schema validation completed successfully');
  console.log('💡 Follow the steps above to push your schema to Supabase!\n');
  
} catch (error) {
  console.error('❌ Error reading or validating schema file:', error.message);
  process.exit(1);
}