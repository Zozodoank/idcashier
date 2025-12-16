// Script to fix demo account password hash
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Fixing demo account password hash...\n');

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

// Demo account information
const demoAccount = {
  email: 'demo@idcashier.my.id',
  password: 'Demo2025'
};

async function fixDemoPassword() {
  try {
    console.log(`Fixing password for ${demoAccount.email}...`);
    
    // Hash the password using bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(demoAccount.password, 10);
    
    // Update the user's password hash
    const { data, error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', demoAccount.email)
      .select('id, name, email, role');
    
    if (error) {
      console.error('Error updating demo account password:', error.message);
      process.exit(1);
    }
    
    if (data.length === 0) {
      console.log('Demo account not found.');
      return;
    }
    
    console.log('Demo account password updated successfully!');
    console.log('ID:', data[0].id);
    console.log('Name:', data[0].name);
    console.log('Email:', data[0].email);
    console.log('Role:', data[0].role);
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

fixDemoPassword();