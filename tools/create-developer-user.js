// Script to create developer user in Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Creating developer user in Supabase...\n');

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

// Developer user credentials
const developerUser = {
  id: '2613fd95-e6ae-49ad-8235-da2897b7531e',  // Same as in insert-developer.sql
  email: 'jho.j80@gmail.com',
  password: '@Se06070786',  // Same as in insert-developer.sql
  name: 'Developer',
  role: 'admin'
};

async function createDeveloperUser() {
  try {
    console.log('Checking if developer user exists...');
    
    // Check if user already exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', developerUser.email);
    
    if (fetchError) {
      console.error('Error checking for existing developer user:', fetchError.message);
      process.exit(1);
    }
    
    if (existingUsers.length > 0) {
      console.log('Developer user already exists.');
      // Update tenant_id for existing user (admins are owners/admins, so set tenant_id to their own id)
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
    
    console.log('Developer user not found. Creating...\n');
    
    // Hash the password using bcrypt (10 rounds)
    const hashedPassword = await bcrypt.hash(developerUser.password, 10);
    
    // Insert the developer user directly into the users table
    // For admins/owners, tenant_id should be the same as user id
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: developerUser.id,
          name: developerUser.name,
          email: developerUser.email,
          password: hashedPassword,
          role: developerUser.role,
          tenant_id: developerUser.id  // For admins/owners, tenant_id is the same as user id
        }
      ])
      .select('id, name, email, role');
    
    if (error) {
      console.error('Error creating developer user:', error.message);
      process.exit(1);
    }
    
    console.log('Developer user created successfully!');
    console.log('ID:', data[0].id);
    console.log('Name:', data[0].name);
    console.log('Email:', data[0].email);
    console.log('Role:', data[0].role);
    console.log('\nYou can now login with:');
    console.log('Email:', developerUser.email);
    console.log('Password:', developerUser.password);
    
    // Update tenant_id for the newly created user
    if (data && data.length > 0) {
      const newUser = data[0];
      const { error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: newUser.id })
        .eq('id', newUser.id);
      
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

createDeveloperUser();