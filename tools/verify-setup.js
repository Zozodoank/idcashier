// Verification script for idCashier Supabase setup
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Verifying idCashier Supabase setup...');

// Display environment variables for debugging
console.log('Environment variables check:');
console.log('- VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Not set');
console.log('- VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Not set');
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Not set');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Not set');

// Check if required environment variables are set
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.JWT_SECRET) {
  console.log('\n❌ Missing required environment variables');
  console.log('Please ensure VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and JWT_SECRET are set in your .env file');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check required users
async function checkRequiredUsers() {
  try {
    console.log('\nChecking for required users...');
    
    // Check for developer user
    const { data: devUser, error: devError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'jho.j80@gmail.com')
      .single();
    
    if (devError || !devUser) {
      console.log('⚠️  Developer user (jho.j80@gmail.com) not found');
      console.log('   Run "node tools/create-developer-user.js" to create it');
    } else {
      console.log('✅ Developer user found:', devUser.name, '(', devUser.email, ')');
    }
    
    // Check for demo user
    const { data: demoUser, error: demoError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'demo@idcashier.my.id')
      .single();
    
    if (demoError || !demoUser) {
      console.log('⚠️  Demo user (demo@idcashier.my.id) not found');
      console.log('   Run "node tools/create-demo-user.js" to create it');
    } else {
      console.log('✅ Demo user found:', demoUser.name, '(', demoUser.email, ')');
    }
    
    // Check if any users exist
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (allError) {
      console.log('❌ Error checking users table:', allError.message);
      return false;
    }
    
    if (allUsers && allUsers.length === 0) {
      console.log('\n⚠️  No users found in the database');
      console.log('   Run "npm run db:seed" to create initial users');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
    return false;
  }
}

// Test importing the API module
import('../src/lib/api.js')
  .then(async apiModule => {
    console.log('✅ API module loaded successfully');
    
    // Check if we can access the API functions
    if (apiModule.authAPI && apiModule.productsAPI && apiModule.salesAPI && apiModule.usersAPI) {
      console.log('✅ All API modules are accessible');
    } else {
      console.log('❌ Some API modules are missing');
    }
    
    // Check required users
    const usersExist = await checkRequiredUsers();
    
    // Test importing the Supabase client
    import('../src/lib/supabaseClient.js')
      .then(supabaseModule => {
        console.log('✅ Supabase client module loaded successfully');
        
        console.log('\n=== Setup Verification Summary ===');
        if (usersExist) {
          console.log('✅ Setup is complete and ready for login attempts');
          console.log('\nNext steps:');
          console.log('1. Run the application with: npm run dev:full');
          console.log('2. Access the application at: http://localhost:3000');
          console.log('3. Login with default credentials:');
          console.log('   - Developer: jho.j80@gmail.com / @Se06070786');
          console.log('   - Demo: demo@idcashier.my.id / Demo2025');
        } else {
          console.log('⚠️  Setup is incomplete - missing users');
          console.log('   Run "npm run db:seed" to create initial users');
        }
      })
      .catch(err => {
        console.error('❌ Failed to load Supabase client:', err.message);
      });
  })
  .catch(err => {
    console.error('❌ Failed to load API module:', err.message);
  });