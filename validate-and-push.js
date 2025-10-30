import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Since we're in an ES module, we need to simulate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('=== Supabase Schema Validation and Push Helper ===\n');

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
  
  // Count lines and basic validation
  const lines = schemaContent.split('\n');
  console.log(`📊 Schema file contains ${lines.length} lines`);
  
  // Count CREATE TABLE statements
  const createTableCount = (schemaContent.match(/CREATE TABLE/g) || []).length;
  console.log(`📊 Found ${createTableCount} CREATE TABLE statements`);
  
  // Count INSERT statements
  const insertCount = (schemaContent.match(/INSERT INTO/g) || []).length;
  console.log(`📊 Found ${insertCount} INSERT statements`);
  
  // Show Supabase connection details
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('\n=== Supabase Connection Details ===');
  console.log(`🌐 URL: ${supabaseUrl}`);
  console.log(`🔑 Anon Key: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'Not found'}`);
  
  // Provide clear instructions
  console.log('\n=== How to Push This Schema ===');
  console.log('Due to security restrictions, you cannot push schema changes directly with the anon key.');
  console.log('Please use one of these methods:');
  console.log('\n1. Supabase Dashboard:');
  console.log('   - Visit: https://app.supabase.com');
  console.log('   - Go to SQL Editor');
  console.log('   - Paste the contents of supabase-schema.sql');
  console.log('   - Click "Run"');
  console.log('\n2. Supabase CLI:');
  console.log('   - Install Supabase CLI');
  console.log('   - Run: supabase link --project-ref YOUR_PROJECT_ID');
  console.log('   - Run: supabase db push');
  console.log('\n3. See PUSH_SCHEMA_INSTRUCTIONS.md for detailed steps');
  
  console.log('\n✅ Schema validation completed successfully');
  
} catch (error) {
  console.error('❌ Error reading or validating schema file:', error.message);
  process.exit(1);
}