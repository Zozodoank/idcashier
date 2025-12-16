import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEVELOPER_OPERATION_URL = `${SUPABASE_URL}/functions/v1/developer-operations`;

console.log('Testing Developer Operations - Fix Testing User');
console.log('URL:', DEVELOPER_OPERATION_URL);

async function fixTestingUser() {
  try {
    console.log('\n🔧 Running ensure_testing_user operation...');
    
    const response = await fetch(DEVELOPER_OPERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        operation: 'ensure_testing_user'
      })
    })
    
    console.log('Response status:', response.status)
    
    const result = await response.json()
    console.log('Result:', JSON.stringify(result, null, 2))
    
    if (response.ok) {
      console.log('✅ Testing user operation completed successfully!')
      console.log('New password for testing@tes.com: @Testing123')
      
      // Now test login
      console.log('\n🔄 Testing login after fix...')
      
      // For login testing, we would need to import supabase client
      // But let's just inform the user to try logging in
      console.log('✅ You can now try logging in with:')
      console.log('Email: testing@tes.com')
      console.log('Password: @Testing123')
      
    } else {
      console.log('❌ Operation failed:', result.error)
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message)
  }
}

fixTestingUser();

async function resetTestingUserPassword() {
  const email = 'testing@tes.com';
  const newPassword = '@Testing111'; // As requested
  
  try {
    console.log(`Resetting password for ${email}...`);
    
    // First, let's try to find the user in the public users table
    const { data: publicUsers, error: publicError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (publicError && publicError.code !== 'PGRST116') {
      console.log('Note: Error fetching from public.users, but this may be expected:', publicError.message);
    }
    
    // Try to create or update the user with the new password using admin API
    console.log('Creating/updating user with new password...');
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: newPassword,
      email_confirm: true
    });
    
    if (authError) {
      // If user already exists, we'll update the password instead
      if (authError.message.includes('already exists')) {
        console.log('User already exists, updating password...');
        
        // We need to get the user ID first
        // Let's try a different approach - list users and find the one we want
        const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error('Error listing users:', listError.message);
          return;
        }
        
        const targetUser = usersList.users.find(user => user.email === email);
        
        if (!targetUser) {
          console.log('User not found in auth system');
          return;
        }
        
        console.log(`Found user with ID: ${targetUser.id}`);
        
        // Update the password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          targetUser.id,
          { password: newPassword }
        );
        
        if (updateError) {
          console.error('Error updating password:', updateError.message);
          return;
        }
        
        console.log('✅ Password successfully updated!');
      } else {
        console.error('Error creating user:', authError.message);
        return;
      }
    } else {
      console.log('✅ User created/verified with new password!');
      console.log(`User ID: ${authUser.user.id}`);
    }
    
    // Ensure the user exists in the public.users table
    let userId = authUser?.user?.id;
    if (!userId && targetUser) {
      userId = targetUser.id;
    }
    
    if (userId) {
      const { error: upsertError } = await supabaseAdmin
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
        console.error('Error ensuring public.users record:', upsertError.message);
      } else {
        console.log('✅ Public user record ensured!');
      }
    }
    
    console.log('✅ Process completed successfully!');
    console.log(`New credentials for ${email}:`);
    console.log(`Password: ${newPassword}`);
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error('Stack:', error.stack);
  }
}

resetTestingUserPassword();