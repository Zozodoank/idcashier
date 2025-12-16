// Script to recreate the demo user
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Use the Supabase URL and anon key from environment variables for basic operations
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in environment variables');
  console.error('Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file');
  process.exit(1);
}

// Create a Supabase client with anon key for basic operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function recreateDemoUser() {
  try {
    console.log('Attempting to recreate demo user with email: demo@idcashier.my.id');
    
    // First, let's try to sign up the user (this will fail if the user already exists)
    console.log('Trying to sign up demo user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'demo@idcashier.my.id',
      password: 'Demo2025',
      options: {
        data: {
          name: 'Demo User',
          role: 'owner'
        }
      }
    });
    
    if (signUpError) {
      console.log('Sign up failed (user might already exist):', signUpError.message);
    } else {
      console.log('Sign up successful or user already exists');
      console.log('User ID:', signUpData.user?.id);
    }
    
    // Try to insert/update the user in the public.users table
    if (signUpData?.user?.id) {
      console.log('Updating public.users table...');
      const { error: insertError } = await supabase
        .from('users')
        .upsert({
          id: signUpData.user.id,
          email: 'demo@idcashier.my.id',
          name: 'Demo User',
          role: 'owner',
          tenant_id: signUpData.user.id
        }, {
          onConflict: 'id'
        });
      
      if (insertError) {
        console.error('Error updating public.users:', insertError.message);
      } else {
        console.log('Public user record updated successfully');
      }
    }
    
    console.log('\nTo fully fix the demo user issue, you may need to:');
    console.log('1. Reset the password in the Supabase Dashboard for demo@idcashier.my.id to "Demo2025"');
    console.log('2. Or get the correct service role key and use the admin API');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

recreateDemoUser();