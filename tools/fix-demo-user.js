// Script to fix demo user in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Fixing demo user in Supabase...');

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

// Demo user credentials (matching frontend implementation)
const demoUser = {
  email: 'demo@idcashier.my.id',  // Correct email to match frontend
  password: 'Demo2025',
  name: 'Demo User',
  role: 'owner'
};

async function fixDemoUser() {
  try {
    console.log('Checking if demo user exists...');
    
    // Check if user already exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', demoUser.email);
    
    if (fetchError) {
      console.error('Error checking for existing demo user:', fetchError.message);
      process.exit(1);
    }
    
    if (existingUsers.length > 0) {
      console.log('Demo user already exists with correct email.');
      // Update tenant_id for existing user
      const user = existingUsers[0];
      const { error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: user.id })
        .eq('id', user.id);
      
      if (updateError) {
        console.warn('Warning: Could not update tenant_id for existing user:', updateError.message);
      } else {
        console.log('User tenant_id updated successfully.');
      }
      return;
    }
    
    console.log('Demo user not found with correct email. Creating...');
    
    // Create the demo user with correct email
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
    console.log('Email:', demoUser.email);
    console.log('Password:', demoUser.password);
    
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
            role: demoUser.role
          }
        ]);
      
      if (insertError) {
        console.warn('Warning: Could not insert user into users table:', insertError.message);
      } else {
        console.log('User also inserted into users table.');
      }
      
      // Update tenant_id for the newly created user
      const { error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: data.user.id })
        .eq('id', data.user.id);
      
      if (updateError) {
        console.warn('Warning: Could not update tenant_id for new user:', updateError.message);
      } else {
        console.log('User tenant_id set successfully.');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

fixDemoUser();