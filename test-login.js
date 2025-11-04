import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://eypfeiqtvfxxiimhtycc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  try {
    console.log('Testing login for demo@idcashier.my.id...');
    
    // Attempt to log in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@idcashier.my.id',
      password: 'Demo2025'
    });
    
    if (error) {
      console.error('Login failed:', error.message);
      return;
    }
    
    console.log('Login successful!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    
    // Test the auth-login function
    const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        email: 'demo@idcashier.my.id',
        password: 'Demo2025'
      })
    });
    
    const result = await response.json();
    console.log('Auth-login function response:', result);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLogin();