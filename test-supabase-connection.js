// Script to test Supabase connection
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('Testing Supabase connection...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment variables.');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test the connection by trying to get the users table structure
async function testConnection() {
  try {
    // Try to get table information
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .limit(1);
    
    if (error) {
      console.log('Connection test result: Partial success');
      console.log('Error (might be expected if table does not exist yet):', error.message);
      console.log('This is expected if the tables have not been created yet.');
    } else {
      console.log('Connection test result: Success');
      console.log('Sample data:', data);
    }
    
    console.log('Supabase connection test completed.');
  } catch (error) {
    console.error('Connection test failed:', error.message);
  }
}

testConnection().catch(console.error);