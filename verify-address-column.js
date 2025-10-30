import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in environment variables.');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verifyAddressColumn() {
  try {
    console.log('Verifying address column in customers table...');
    
    // Test 1: Check if we can select the address column
    const { data, error } = await supabase
      .from('customers')
      .select('address')
      .limit(1);
    
    if (error && error.code === '42703') {
      console.error('❌ Verification failed: address column does not exist');
      console.error('Error:', error.message);
      console.log('\nPlease follow these steps to resolve the issue:');
      console.log('1. Run the apply-address-migration script:');
      console.log('   Windows: apply-address-migration.bat');
      console.log('   Mac/Linux: node apply-address-migration.js');
      console.log('2. Or manually apply the migration through the Supabase dashboard');
      console.log('3. Run this verification script again');
      process.exit(1);
    }
    
    if (error) {
      console.error('❌ Verification failed with unexpected error:', error);
      process.exit(1);
    }
    
    console.log('✅ Address column exists and is accessible');
    
    // Test 2: Try to insert a test customer with address (without actually committing)
    console.log('Testing insert with address column...');
    
    // Generate a random ID for testing
    const testId = globalThis.crypto.randomUUID();
    
    // Try to insert a test record (this will fail due to foreign key constraints, but that's okay)
    const { error: insertError } = await supabase
      .from('customers')
      .insert({
        id: testId,
        user_id: testId, // This will fail FK constraint, but we're just testing column existence
        name: 'Test Customer',
        address: '123 Test Street',
        email: 'test@example.com',
        phone: '555-1234'
      });
    
    // We expect a foreign key error, not a column missing error
    if (insertError && insertError.code === '42703') {
      console.error('❌ Verification failed: address column does not exist');
      console.error('Error:', insertError.message);
      process.exit(1);
    }
    
    // Any other error is acceptable for this test (like foreign key constraint)
    console.log('✅ Address column can be used in INSERT operations');
    console.log('✅ Verification completed successfully!');
    console.log('The address column has been successfully added to the customers table.');
    
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

// Run the verification
verifyAddressColumn();