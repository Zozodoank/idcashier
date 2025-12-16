// Script to test demo login
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Testing demo login...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDemoLogin() {
  try {
    console.log('Attempting to login with demo@idcashier.my.id...');
    
    // Try to login with the demo credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@idcashier.my.id',
      password: 'Demo2025'
    });
    
    if (error) {
      console.error('Login failed:', error.message);
      console.error('Error details:', error);
      return;
    }
    
    console.log('Login successful!');
    console.log('User ID:', data.user?.id);
    console.log('User email:', data.user?.email);
    
    // Now try to get the user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, tenant_id')
      .eq('email', 'demo@idcashier.my.id')
      .single();
    
    if (userError) {
      console.error('Failed to get user profile:', userError.message);
      return;
    }
    
    console.log('User profile:', userData);
    
    // Test the auth-login edge function directly
    console.log('\nTesting auth-login edge function...');
    const response = await fetch(`${supabaseUrl}/functions/v1/auth-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        email: 'demo@idcashier.my.id',
        password: 'Demo2025'
      })
    });
    
    const result = await response.json();
    console.log('Edge function response status:', response.status);
    console.log('Edge function response:', result);
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testDemoLogin();