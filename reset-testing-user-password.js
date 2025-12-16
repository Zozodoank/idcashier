import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  VITE_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetTestingUserPassword() {
  const email = 'testing@tes.com';
  const newPassword = '@Testing123'; // Default password
  
  try {
    console.log(`\n🔧 Resetting password for: ${email}`);
    
    // First, find the user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      return;
    }
    
    const targetUser = users.find(u => u.email === email);
    
    if (!targetUser) {
      console.error(`❌ User ${email} not found in auth system`);
      return;
    }
    
    console.log(`✅ Found user: ${targetUser.id}`);
    
    // Update password using admin API
    console.log('🔄 Updating password...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );
    
    if (updateError) {
      console.error('❌ Error updating password:', updateError.message);
      return;
    }
    
    console.log('✅ Password successfully updated!');
    
    // Verify user exists in public.users
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUser.id)
      .single();
    
    if (publicError && publicError.code === 'PGRST116') {
      console.log('⚠️  User not found in public.users, creating...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: targetUser.id,
          email: email,
          name: 'Testing User',
          role: 'owner',
          tenant_id: targetUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('❌ Error creating public user:', insertError.message);
      } else {
        console.log('✅ Public user record created!');
      }
    } else if (publicUser) {
      console.log('✅ User exists in public.users');
    }
    
    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n✅ Ready to login!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

resetTestingUserPassword();

