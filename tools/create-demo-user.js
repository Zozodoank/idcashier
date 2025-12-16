// Script to create a demo user in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Creating demo user in Supabase...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Demo user credentials (using a standard email format)
const demoUser = {
  email: 'demo@idcashier.my.id',
  password: 'Demo2025',
  name: 'Demo User',
  role: 'owner'
};

async function createDemoUser() {
  try {
    console.log('Creating demo user...');
    
    // Sign up the demo user
    const { data, error } = await supabase.auth.signUp({
      email: demoUser.email,
      password: demoUser.password,
      options: {
        data: {
          name: demoUser.name,
          role: demoUser.role
        }
      }
    });
    
    if (error) {
      console.error('Error creating demo user:', error.message);
      process.exit(1);
    }
    
    console.log('Demo user created successfully!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', demoUser.email);
    console.log('Password:', demoUser.password);
    console.log('\nYou can now use these credentials to log in to the application.');
    
    // Also insert the user into the users table
    if (data.user?.id) {
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: data.user.id,
            name: demoUser.name,
            email: demoUser.email,
            password: '', // Password is handled by Supabase Auth
            role: demoUser.role,
            tenant_id: data.user.id // For owner, tenant_id should be the same as user id
          }
        ]);
      
      if (insertError) {
        console.warn('Warning: Could not insert user into users table:', insertError.message);
        console.warn('This might be because the user already exists or the table structure is different.');
      } else {
        console.log('User also inserted into users table with tenant_id set.');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

createDemoUser();