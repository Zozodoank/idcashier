// Script to verify multi-tenancy migration
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
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigration() {
  try {
    console.log('Verifying multi-tenancy migration...\n');
    
    // 1. Check if tenant_id column exists
    console.log('1. Checking if tenant_id column exists...');
    const { data: columns, error: columnsError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('Error accessing users table:', columnsError.message);
      process.exit(1);
    }
    
    // Check if tenant_id column exists in the returned data
    const firstUser = columns[0];
    if (firstUser && 'tenant_id' in firstUser) {
      console.log('   ✓ tenant_id column exists');
    } else {
      console.log('   ✗ tenant_id column does not exist');
      process.exit(1);
    }
    
    // 2. Check if all users have tenant_id equal to their id
    console.log('\n2. Checking if all users have tenant_id equal to their id...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, tenant_id');
    
    if (usersError) {
      console.error('Error fetching users:', usersError.message);
      process.exit(1);
    }
    
    let allMatch = true;
    for (const user of users) {
      if (user.id !== user.tenant_id) {
        console.log(`   ✗ User ${user.id} has tenant_id ${user.tenant_id} (should be ${user.id})`);
        allMatch = false;
      }
    }
    
    if (allMatch) {
      console.log(`   ✓ All ${users.length} users have tenant_id equal to their id`);
    }
    
    // 3. Check if index exists
    console.log('\n3. Checking if idx_users_tenant_id index exists...');
    // Note: This is a simplified check. In a real PostgreSQL environment, you would query pg_indexes.
    console.log('   ⓘ Index verification requires direct PostgreSQL access');
    console.log('   ⓘ Run this SQL query to verify: SELECT indexname FROM pg_indexes WHERE tablename = \'users\' AND indexname = \'idx_users_tenant_id\';');
    
    // 4. Summary
    console.log('\n=== Migration Verification Summary ===');
    if (firstUser && 'tenant_id' in firstUser && allMatch) {
      console.log('✓ Migration appears to be successful');
      console.log('✓ tenant_id column exists');
      console.log('✓ All users have correct tenant_id values');
      console.log('ⓘ Please verify index exists with direct PostgreSQL access');
    } else {
      console.log('✗ Migration verification failed');
      console.log('✗ Please check the errors above');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

verifyMigration();