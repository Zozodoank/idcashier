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

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in environment variables.');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Try to get the version
    const { data, error } = await supabase.rpc('version');
    
    if (error) {
      console.error('Connection test failed:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('Version:', data);
    
  } catch (err) {
    console.error('Connection test failed:', err);
    process.exit(1);
  }
}

// Run the test
testConnection();