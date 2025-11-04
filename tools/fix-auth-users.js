const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const path = require('path');

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// User data
const users = [
  {
    email: 'demo@idcashier.my.id',
    password: 'Demo2025',
    name: 'Demo User',
    role: 'owner'
  },
  {
    email: 'jho.j80@gmail.com',
    password: '@Se06070786',
    name: 'Developer',
    role: 'admin'
  }
];

async function createOrUpdateAuthUser(userData) {
  try {
    // Check if user already exists in auth.users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError.message);
      return;
    }

    const existingUser = existingUsers.users.find(user => user.email === userData.email);
    
    let authUser;
    if (existingUser) {
      // Update existing user's password
      const { data, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: userData.password }
      );
      
      if (updateError) {
        console.error(`Error updating user ${userData.email}:`, updateError.message);
        return;
      }
      
      authUser = data.user;
      console.log(`✅ Updated password for user: ${userData.email}`);
    } else {
      // Create new user
      const { data, error: createError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name,
          role: userData.role
        }
      });
      
      if (createError) {
        console.error(`Error creating user ${userData.email}:`, createError.message);
        return;
      }
      
      authUser = data.user;
      console.log(`✅ Created new user: ${userData.email}`);
    }
    
    // Sync with public.users table
    await syncWithPublicUsers(authUser, userData);
    
  } catch (error) {
    console.error(`Error processing user ${userData.email}:`, error.message);
  }
}

async function syncWithPublicUsers(authUser, userData) {
  try {
    // Check if user exists in public.users
    const { data: existingPublicUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('email', authUser.email)
      .single();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error(`Error checking public user ${authUser.email}:`, selectError.message);
      return;
    }
    
    if (existingPublicUser) {
      // Update existing public user
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          id: authUser.id,
          tenant_id: authUser.id
        })
        .eq('email', authUser.email);
      
      if (updateError) {
        console.error(`Error updating public user ${authUser.email}:`, updateError.message);
        return;
      }
      
      console.log(`✅ Synced public user: ${authUser.email}`);
    } else {
      // Insert new public user
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          name: userData.name,
          role: userData.role,
          tenant_id: authUser.id
        });
      
      if (insertError) {
        console.error(`Error inserting public user ${authUser.email}:`, insertError.message);
        return;
      }
      
      console.log(`✅ Created public user: ${authUser.email}`);
    }
  } catch (error) {
    console.error(`Error syncing public user ${authUser.email}:`, error.message);
  }
}

async function main() {
  console.log('🔧 Fixing Auth Users...');
  
  for (const user of users) {
    await createOrUpdateAuthUser(user);
  }
  
  console.log('✅ All users fixed successfully!');
}

main();