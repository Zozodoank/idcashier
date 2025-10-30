import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import supabase from './server/config/supabase.js';

async function createUser() {
  try {
    const email = 'jho.j80@gmail.com';
    const password = 'Demo2025'; // Or whatever password you want to use
    const name = 'John Doe';
    const role = 'owner';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate user ID
    const userId = randomUUID();
    
    // Create the user with tenant_id set to null initially
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          name: name,
          email: email,
          password: hashedPassword,
          role: role,
          tenant_id: role === 'owner' ? null : undefined // Set to null for owner, undefined for others
        }
      ])
      .select('id, name, email, role')
      .single();
    
    if (insertError) {
      console.error('Error creating user:', insertError);
      return;
    }
    
    // For owner, update tenant_id to be the same as user id
    if (role === 'owner') {
      const { error: updateError } = await supabase
        .from('users')
        .update({ tenant_id: newUser.id })
        .eq('id', newUser.id);
      
      if (updateError) {
        console.error('Error updating tenant_id for owner:', updateError);
        return;
      }
      
      console.log('Owner user created successfully with tenant_id set:', { ...newUser, tenant_id: newUser.id });
    } else {
      console.log('User created successfully:', newUser);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createUser();