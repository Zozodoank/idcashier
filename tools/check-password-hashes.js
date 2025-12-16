// Script to check password hashes in the database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Checking password hashes in Supabase...\n');

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

async function checkPasswordHashes() {
  try {
    console.log('Checking password hashes...\n');
    
    for (const account of accounts) {
      console.log(`Checking ${account.name} (${account.email})...`);
      
      // Check if user exists
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, password, role')
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
        console.log(`     Password hash: ${user.password.substring(0, 20)}...`);
        
        // Test password hash
        try {
          const isMatch = await bcrypt.compare(account.password, user.password);
          if (isMatch) {
            console.log(`     ✅ Password hash is correct`);
          } else {
            console.log(`     ❌ Password hash is incorrect`);
            console.log(`        Expected hash for "${account.password}" would be:`);
            const expectedHash = await bcrypt.hash(account.password, 10);
            console.log(`        ${expectedHash.substring(0, 20)}...`);
          }
        } catch (hashError) {
          console.log(`     ❌ Error checking password hash:`, hashError.message);
        }
      }
      console.log('');
    }
    
    console.log('Password hash check completed.');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

checkPasswordHashes();