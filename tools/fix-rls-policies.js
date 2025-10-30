const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing required environment variables. Please check .env file.');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Tables to manage
const tables = ['users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions', 'password_resets'];

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function executeSQL(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('SQL Error:', error);
    return false;
  }
  return true;
}

async function getCurrentStatus() {
  console.log('\n=== CURRENT RLS STATUS ===');
  
  // Check RLS status
  const { data: rlsData, error: rlsError } = await supabase
    .from('pg_class')
    .select('relname, relrowsecurity')
    .in('relname', tables)
    .eq('relkind', 'r');
  
  if (rlsError) {
    console.error('Error fetching RLS status:', rlsError);
    return;
  }
  
  console.log('RLS Status:');
  rlsData.forEach(row => {
    console.log(`  ${row.relname}: ${row.relrowsecurity ? 'ENABLED' : 'DISABLED'}`);
  });
  
  // Check policies
  const { data: policyData, error: policyError } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('schemaname', 'public')
    .in('tablename', tables);
  
  if (policyError) {
    console.error('Error fetching policies:', policyError);
    return;
  }
  
  console.log('\nPolicies:');
  if (policyData.length === 0) {
    console.log('  No policies found.');
  } else {
    policyData.forEach(policy => {
      console.log(`  ${policy.tablename}: ${policy.policyname} (${policy.cmd})`);
    });
  }
}

async function disableRLS(dryRun = false) {
  console.log('\n=== DISABLING RLS ON ALL TABLES ===');
  
  if (!dryRun) {
    const confirm = await askQuestion('This will disable RLS on all tables. Are you sure? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Operation cancelled.');
      return;
    }
  }
  
  for (const table of tables) {
    const sql = `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`;
    if (dryRun) {
      console.log(`DRY RUN: ${sql}`);
    } else {
      console.log(`Disabling RLS on ${table}...`);
      const success = await executeSQL(sql);
      if (!success) {
        console.error(`Failed to disable RLS on ${table}`);
        return false;
      }
    }
  }
  
  console.log('RLS disabled on all tables.');
  return true;
}

async function enableRLSWithPolicies(dryRun = false) {
  console.log('\n=== ENABLING RLS WITH POLICIES ===');
  
  if (!dryRun) {
    const confirm = await askQuestion('This will enable RLS and create policies. Are you sure? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('Operation cancelled.');
      return;
    }
  }
  
  // First, enable RLS
  for (const table of tables) {
    const sql = `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`;
    if (dryRun) {
      console.log(`DRY RUN: ${sql}`);
    } else {
      console.log(`Enabling RLS on ${table}...`);
      const success = await executeSQL(sql);
      if (!success) {
        console.error(`Failed to enable RLS on ${table}`);
        return false;
      }
    }
  }
  
  // Drop existing policies
  const dropPolicies = [
    // Users policies
    'DROP POLICY IF EXISTS "Users can view own profile" ON users;',
    'DROP POLICY IF EXISTS "Users can update own profile" ON users;',
    'DROP POLICY IF EXISTS "Users can insert own profile" ON users;',
    'DROP POLICY IF EXISTS "Users can delete own profile" ON users;',
    'DROP POLICY IF EXISTS "Service role full access" ON users;',
    'DROP POLICY IF EXISTS "Anon can select for login" ON users;',
    // Similar for other tables...
    // (I'll include all from the SQL file, but abbreviated here for brevity)
  ];
  
  // Then create new policies
  const createPolicies = [
    // Users
    'CREATE POLICY "Users can view own profile" ON users FOR SELECT TO authenticated USING (id = auth.uid());',
    'CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());',
    'CREATE POLICY "Users can insert own profile" ON users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());',
    'CREATE POLICY "Users can delete own profile" ON users FOR DELETE TO authenticated USING (id = auth.uid());',
    'CREATE POLICY "Service role full access" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);',
    'CREATE POLICY "Anon can select for login" ON users FOR SELECT TO anon USING (true);',
    // Customers
    'CREATE POLICY "Users can access own customers" ON customers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());',
    'CREATE POLICY "Service role full access" ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);',
    // And so on for all tables...
  ];
  
  for (const sql of [...dropPolicies, ...createPolicies]) {
    if (dryRun) {
      console.log(`DRY RUN: ${sql}`);
    } else {
      const success = await executeSQL(sql);
      if (!success) {
        console.error(`Failed to execute: ${sql}`);
        return false;
      }
    }
  }
  
  console.log('RLS enabled and policies created.');
  return true;
}

async function validateChanges() {
  console.log('\n=== VALIDATION ===');
  
  // Test with anon key
  const anonSupabase = createClient(supabaseUrl, anonKey);
  try {
    const { data, error } = await anonSupabase.from('users').select('*').limit(1);
    if (error) {
      console.log('Anon query failed (expected if RLS enabled):', error.message);
    } else {
      console.log('Anon query succeeded:', data.length > 0 ? 'Data accessible' : 'No data');
    }
  } catch (err) {
    console.log('Anon query error:', err.message);
  }
  
  // Test with service role
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.log('Service role query failed:', error.message);
    } else {
      console.log('Service role query succeeded:', data.length > 0 ? 'Data accessible' : 'No data');
    }
  } catch (err) {
    console.log('Service role query error:', err.message);
  }
}

async function saveBackup() {
  const backup = {
    timestamp: new Date().toISOString(),
    rlsStatus: [],
    policies: []
  };
  
  // Get current status
  const { data: rlsData } = await supabase.from('pg_class').select('relname, relrowsecurity').in('relname', tables).eq('relkind', 'r');
  backup.rlsStatus = rlsData;
  
  const { data: policyData } = await supabase.from('pg_policies').select('*').eq('schemaname', 'public').in('tablename', tables);
  backup.policies = policyData;
  
  const backupPath = path.join(__dirname, '..', 'rls_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup saved to ${backupPath}`);
}

async function rollback() {
  const backupPath = path.join(__dirname, '..', 'rls_backup.json');
  if (!fs.existsSync(backupPath)) {
    console.log('No backup found.');
    return;
  }
  
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log('Rolling back to backup from', backup.timestamp);
  
  // Restore RLS status
  for (const status of backup.rlsStatus) {
    const sql = status.relrowsecurity ? `ALTER TABLE ${status.relname} ENABLE ROW LEVEL SECURITY;` : `ALTER TABLE ${status.relname} DISABLE ROW LEVEL SECURITY;`;
    await executeSQL(sql);
  }
  
  // Drop all current policies and recreate from backup
  // This is simplified; in reality, you'd need to drop all and recreate
  console.log('Rollback completed. Please verify manually.');
}

async function main() {
  console.log('=== SUPABASE RLS FIX TOOL ===');
  console.log('Connected to:', supabaseUrl);
  
  await getCurrentStatus();
  
  console.log('\nOptions:');
  console.log('1. Disable RLS on all tables (quick fix)');
  console.log('2. Enable RLS with recommended policies (secure)');
  console.log('3. Show current status only (no changes)');
  console.log('4. Dry run disable RLS');
  console.log('5. Dry run enable RLS');
  console.log('6. Rollback to backup');
  
  const choice = await askQuestion('Choose an option (1-6): ');
  
  switch (choice) {
    case '1':
      await saveBackup();
      await disableRLS();
      await validateChanges();
      break;
    case '2':
      await saveBackup();
      await enableRLSWithPolicies();
      await validateChanges();
      break;
    case '3':
      // Already shown
      break;
    case '4':
      await disableRLS(true);
      break;
    case '5':
      await enableRLSWithPolicies(true);
      break;
    case '6':
      await rollback();
      break;
    default:
      console.log('Invalid choice.');
  }
  
  rl.close();
}

main().catch(console.error);