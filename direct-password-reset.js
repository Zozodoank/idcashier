import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Direct Password Reset for Testing Account');

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables');
  console.error('VITE_SUPABASE_URL exists:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceRoleKey);
  process.exit(1);
}

// Create Supabase client with service role key (has admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function resetTestingUserPassword() {
  const email = 'testing@tes.com';
  const newPassword = '@Testing111';
  
  try {
    console.log(`\n🔍 Looking for user: ${email}`);
    
    // List all users to find the testing user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    // Find the testing user
    const targetUser = users.users.find(user => user.email === email);
    
    if (!targetUser) {
      console.log('❌ User not found in auth system, creating new user...');
      
      // Create the user with the specified password
      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: newPassword,
        email_confirm: true // Skip email confirmation
      });
      
      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        return;
      }
      
      console.log(`✅ User created successfully: ${createdUser.user.email} (${createdUser.user.id})`);
      const userId = createdUser.user.id;
      
      // Also create the user record in the public.users table
      console.log('\n📝 Creating public user record...');
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: email,
          name: 'Duitku Testing User',
          role: 'owner',
          tenant_id: userId,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (upsertError) {
        console.error('❌ Error creating public user record:', upsertError.message);
      } else {
        console.log('✅ Public user record created!');
      }
    } else {
      console.log(`✅ Found user: ${targetUser.email} (${targetUser.id})`);
      
      // Update the user's password
      console.log('\n🔄 Updating password...');
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { password: newPassword }
      );
      
      if (updateError) {
        console.error('❌ Error updating password:', updateError.message);
        return;
      }
      
      console.log('✅ Password successfully updated!');
    }
    
    console.log('\n📝 Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log('\nYou can now login with these credentials.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

resetTestingUserPassword();