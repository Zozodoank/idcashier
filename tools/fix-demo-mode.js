// Script to fix demo mode issues
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Fixing demo mode issues in Supabase...');

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
const demoUsers = [
  {
    email: 'demo@idcashier.my.id',  // Used by frontend
    password: 'Demo2025',
    name: 'Demo User',
    role: 'owner'
  }
];

async function fixDemoUsers() {
  try {
    console.log('Checking demo users...');
    
    for (const demoUser of demoUsers) {
      console.log(`\nProcessing ${demoUser.email}...`);
      
      // Check if user exists in auth.users
      const { data: authUsers, error: authError } = await supabase
        .from('auth.users')
        .select('id, email')
        .eq('email', demoUser.email);
      
      if (authError) {
        console.error(`Error checking auth user ${demoUser.email}:`, authError.message);
        continue;
      }
      
      if (authUsers.length === 0) {
        console.log(`Auth user ${demoUser.email} not found, creating...`);
        // Create the auth user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: demoUser.email,
          password: demoUser.password,
          options: {
            data: {
              name: demoUser.name,
              role: demoUser.role
            }
          }
        });
        
        if (signUpError) {
          console.error(`Error creating auth user ${demoUser.email}:`, signUpError.message);
          continue;
        }
        
        console.log(`Auth user ${demoUser.email} created with ID: ${signUpData.user?.id}`);
      } else {
        console.log(`Auth user ${demoUser.email} exists with ID: ${authUsers[0].id}`);
      }
      
      // Check if user exists in public.users
      const { data: publicUsers, error: publicError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', demoUser.email);
      
      if (publicError) {
        console.error(`Error checking public user ${demoUser.email}:`, publicError.message);
        continue;
      }
      
      if (publicUsers.length === 0) {
        console.log(`Public user ${demoUser.email} not found, creating...`);
        // Get the auth user ID
        const { data: authUser, error: getAuthError } = await supabase
          .from('auth.users')
          .select('id')
          .eq('email', demoUser.email)
          .single();
        
        if (getAuthError) {
          console.error(`Error getting auth user ID for ${demoUser.email}:`, getAuthError.message);
          continue;
        }
        
        // Create the public user
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: authUser.id,
              name: demoUser.name,
              email: demoUser.email,
              role: demoUser.role,
              tenant_id: authUser.id
            }
          ]);
        
        if (insertError) {
          console.error(`Error creating public user ${demoUser.email}:`, insertError.message);
          continue;
        }
        
        console.log(`Public user ${demoUser.email} created with ID: ${authUser.id}`);
      } else {
        console.log(`Public user ${demoUser.email} exists with ID: ${publicUsers[0].id}`);
        // Update tenant_id if needed
        const { error: updateError } = await supabase
          .from('users')
          .update({ tenant_id: publicUsers[0].id })
          .eq('id', publicUsers[0].id);
        
        if (updateError) {
          console.warn(`Warning: Could not update tenant_id for ${demoUser.email}:`, updateError.message);
        } else {
          console.log(`User ${demoUser.email} tenant_id updated successfully.`);
        }
      }
    }
    
    console.log('\nDemo mode fix completed!');
    console.log('Frontend demo mode should now work with email: demo@idcashier.my.id and password: Demo2025');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

fixDemoUsers();