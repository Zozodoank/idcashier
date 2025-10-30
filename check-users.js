import supabase from './server/config/supabase.js';

async function checkUsers() {
  try {
    // List all users to see what's in the database
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id, permissions');
    
    if (allError) {
      console.error('Error fetching users:', allError);
      return;
    }
    
    console.log('All users in database:');
    if (allUsers && allUsers.length > 0) {
      allUsers.forEach(user => {
        console.log(`- ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Tenant ID: ${user.tenant_id}`);
        console.log(`  Permissions: ${JSON.stringify(user.permissions)}`);
        console.log('---');
      });
    } else {
      console.log('No users found in database');
    }
  } catch (error) {
    console.error('Error checking users:', error);
  }
}

checkUsers();