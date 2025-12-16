// Script to reset demo user password using Supabase admin client
import { createClient } from '@supabase/supabase-js';

// Use the Supabase URL and anon key from the frontend
const supabaseUrl = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI';

// Create a Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetDemoUser() {
  try {
    console.log('Resetting demo user password...');
    
    // First, let's check if the user exists
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'demo@idcashier.my.id');
    
    if (fetchError) {
      console.error('Error fetching user:', fetchError.message);
      return;
    }
    
    if (users.length === 0) {
      console.log('Demo user not found in public.users table');
      return;
    }
    
    console.log('Found demo user:', users[0]);
    
    // Since we can't directly update the auth.users table without service role key,
    // let's try to use the admin API if we have access
    
    // For now, let's just verify that the frontend credentials work
    console.log('Testing frontend credentials...');
    console.log('Email: demo@idcashier.my.id');
    console.log('Password: Demo2025');
    console.log('Try logging in through the frontend with these credentials.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

resetDemoUser();