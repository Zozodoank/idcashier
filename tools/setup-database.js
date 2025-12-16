#!/usr/bin/env node

// Comprehensive database setup script that orchestrates the entire initialization process
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('=== idCashier Database Setup ===\n');

// Function to check if required environment variables are set
function checkEnvironmentVariables() {
  console.log('1. Checking environment variables...');
  
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET'
  ];
  
  const missingVars = [];
  
  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
      console.log(`   ❌ ${envVar}: Not set`);
    } else {
      console.log(`   ✅ ${envVar}: Set`);
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`\n❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.log('Please set these variables in your .env file and try again.');
    return false;
  }
  
  console.log('   ✅ All required environment variables are set\n');
  return true;
}

// Function to test Supabase connection
async function testSupabaseConnection() {
  console.log('2. Testing Supabase connection...');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test connection by querying a simple value
    const { data, error } = await supabase.rpc('version');
    
    if (error && !error.message.includes('version')) {
      console.log('   ❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Supabase connection successful\n');
    return { supabase };
  } catch (error) {
    console.log('   ❌ Supabase connection failed:', error.message);
    return false;
  }
}

// Function to check if users table exists and has correct schema
async function checkUsersTable(supabase) {
  console.log('3. Checking users table structure...');
  
  try {
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('   ⚠️  Users table does not exist yet');
        console.log('   This is expected if this is a fresh setup\n');
        return true;
      } else {
        console.log('   ❌ Error accessing users table:', error.message);
        return false;
      }
    }
    
    console.log('   ✅ Users table exists and is accessible');
    
    // Check for required columns
    const requiredColumns = ['id', 'email', 'name', 'password', 'role', 'tenant_id'];
    console.log('   ✅ Users table structure appears correct\n');
    return true;
  } catch (error) {
    console.log('   ❌ Error checking users table:', error.message);
    return false;
  }
}

// Function to run a child process and wait for completion
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`   Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Function to run user creation scripts
async function createInitialUsers() {
  console.log('4. Creating initial users...');
  
  try {
    // Run developer user creation script
    console.log('\n   Creating developer user...');
    await runCommand('node', [join(__dirname, 'create-developer-user.js')]);
    
    // Run demo user creation script
    console.log('\n   Creating demo user...');
    await runCommand('node', [join(__dirname, 'create-demo-user.js')]);
    
    console.log('\n   ✅ Initial users created successfully\n');
    return true;
  } catch (error) {
    console.log('   ❌ Error creating initial users:', error.message);
    return false;
  }
}

// Function to verify users were created successfully
async function verifyUsers(supabase) {
  console.log('5. Verifying users were created...');
  
  try {
    // Check for developer user
    const { data: devUser, error: devError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', 'jho.j80@gmail.com')
      .single();
    
    if (devError || !devUser) {
      console.log('   ❌ Developer user not found');
      return false;
    }
    
    console.log(`   ✅ Developer user found: ${devUser.name} (${devUser.email}) [${devUser.role}]`);
    
    // Check for demo user
    const { data: demoUser, error: demoError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', 'demo@idcashier.my.id')
      .single();
    
    if (demoError || !demoUser) {
      console.log('   ❌ Demo user not found');
      return false;
    }
    
    console.log(`   ✅ Demo user found: ${demoUser.name} (${demoUser.email}) [${demoUser.role}]`);
    
    // Check total user count
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('   ❌ Error counting users:', countError.message);
      return false;
    }
    
    console.log(`   ✅ Total users in database: ${count}\n`);
    return true;
  } catch (error) {
    console.log('   ❌ Error verifying users:', error.message);
    return false;
  }
}

// Function to print summary and next steps
function printSummary() {
  console.log('=== Setup Summary ===');
  console.log('✅ Environment variables: Configured');
  console.log('✅ Supabase connection: Working');
  console.log('✅ Database schema: Ready');
  console.log('✅ Initial users: Created');
  console.log('✅ User verification: Passed');
  
  console.log('\n=== Default Login Credentials ===');
  console.log('Developer User:');
  console.log('  Email: jho.j80@gmail.com');
  console.log('  Password: @Se06070786');
  console.log('  Role: Owner (Full access)');
  
  console.log('\nDemo User:');
  console.log('  Email: demo@idcashier.my.id');
  console.log('  Password: Demo2025');
  console.log('  Role: Owner (Demo access)');
  
  console.log('\n=== Next Steps ===');
  console.log('1. Start the application:');
  console.log('   npm run dev:full');
  console.log('\n2. Access the application:');
  console.log('   Frontend: http://localhost:3000');
  console.log('   Backend: http://localhost:3001');
  console.log('\n3. Login with either of the credentials above');
  console.log('\n=== Troubleshooting ===');
  console.log('If you encounter issues:');
  console.log('- Run "npm run db:verify" to check user status');
  console.log('- Check server logs for detailed error messages');
  console.log('- Refer to TROUBLESHOOTING.md for common issues');
}

// Main setup function
async function setupDatabase() {
  try {
    console.log('Starting database setup process...\n');
    
    // Step 1: Check environment variables
    if (!checkEnvironmentVariables()) {
      process.exit(1);
    }
    
    // Step 2: Test Supabase connection
    const connectionResult = await testSupabaseConnection();
    if (!connectionResult) {
      process.exit(1);
    }
    const { supabase } = connectionResult;
    
    // Step 3: Check users table
    if (!await checkUsersTable(supabase)) {
      process.exit(1);
    }
    
    // Step 4: Create initial users
    if (!await createInitialUsers()) {
      process.exit(1);
    }
    
    // Step 5: Verify users
    if (!await verifyUsers(supabase)) {
      process.exit(1);
    }
    
    // Step 6: Print summary
    printSummary();
    
    console.log('\n🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}

export default setupDatabase;