import supabase from './server/config/supabase.js';

async function verifyUser() {
  try {
    // Check if user exists with the exact email
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'jho.j80@gmail.com');
    
    console.log('Users with email jho.j80@gmail.com:', users, error);
    
    if (users && users.length > 0) {
      console.log('User found in database:');
      console.log('- ID:', users[0].id);
      console.log('- Email:', users[0].email);
      console.log('- Name:', users[0].name);
    } else {
      console.log('No user found with email jho.j80@gmail.com');
    }
  } catch (error) {
    console.error('Error checking user:', error);
  }
}

verifyUser();