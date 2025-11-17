import { createClient } from '@supabase/supabase-js';

async function testDirectLogin() {
  console.log('=== Testing Direct Login ===');
  
  // Initialize Supabase client
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI'
  );
  
  // Test accounts
  const testAccounts = [
    { email: 'demo@idcashier.my.id', password: 'Demo2025', name: 'Demo Account' },
    { email: 'jho.j80@gmail.com', password: 'Jho123456', name: 'Jho Account' },
    { email: 'megakomindo@gmail.com', password: 'Mega123456', name: 'Mega Account' },
    { email: 'projectmandiri10@gmail.com', password: 'Project123456', name: 'Project Account' },
    { email: 'testing@idcashier.my.id', password: 'Tesajakalobisa', name: 'Test Account' }
  ];
  
  for (const account of testAccounts) {
    console.log(`\n--- Testing ${account.name} (${account.email}) ---`);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password
      });
      
      if (error) {
        console.log(`❌ Login failed: ${error.message}`);
        continue;
      }
      
      console.log(`✅ Login successful`);
      console.log(`User ID: ${data.user.id}`);
      
      // Test the auth-login function directly
      const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: account.email,
          password: account.password
        })
      });
      
      const result = await response.json();
      console.log(`Auth-login response status: ${response.status}`);
      console.log(`Auth-login response:`, JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Direct Login Test Completed ===');
}

testDirectLogin().catch(console.error);