// Script to verify demo and developer accounts in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Verifying demo and developer accounts in Supabase...\n');

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

// Account information
const accounts = [
  {
    name: 'Demo Account',
    email: 'demo@idcashier.my.id',
    password: 'Demo2025'
  },
  {
    name: 'Developer Account',
    email: 'jho.j80@gmail.com',
    password: '@Se06070786'
  }
];

async function verifyAccounts() {
  try {
    console.log('Checking accounts...\n');
    
    for (const account of accounts) {
      console.log(`Checking ${account.name} (${account.email})...`);
      
      // Check if user exists
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', account.email);
      
      if (error) {
        console.error(`  Error checking ${account.name}:`, error.message);
        continue;
      }
      
      if (users.length === 0) {
        console.log(`  ❌ ${account.name} not found in database`);
      } else {
        const user = users[0];
        console.log(`  ✅ ${account.name} found:`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Name: ${user.name}`);
        console.log(`     Role: ${user.role}`);
      }
      console.log('');
    }
    
    console.log('Account verification completed.');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

verifyAccounts();