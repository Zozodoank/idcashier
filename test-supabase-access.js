import { createClient } from '@supabase/supabase-js';

async function testSupabaseAccess() {
  console.log('=== Testing Supabase Access ===');
  
  // Initialize Supabase client with anon key
  const supabase = createClient(
    'https://eypfeiqtvfxxiimhtycc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5cGZlaXF0dmZ4eGlpbWh0eWNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzEyODEsImV4cCI6MjA3NjQwNzI4MX0.mB5EVpFQbayjPvAuEmg98tsyrhFW_FQxf2SCQhdZHSI' // Anon key
  );
  
  try {
    // Test 1: Fetch user by ID (this might fail due to RLS)
    console.log('1. Testing fetch user by ID...');
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, tenant_id')
      .eq('id', 'ecf0741d-e4ae-4de3-bee0-f43d27411366')
      .single();
    
    if (error) {
      console.error('❌ Fetch by ID failed:', error.message);
    } else {
      console.log('✅ Fetch by ID succeeded:', JSON.stringify(data, null, 2));
    }
    
    // Test 2: Fetch user by email (this might fail due to RLS)
    console.log('2. Testing fetch user by email...');
    const { data: emailData, error: emailError } = await supabase
      .from('users')
      .select('id, email, role, tenant_id')
      .eq('email', 'testing@idcashier.my.id')
      .single();
    
    if (emailError) {
      console.error('❌ Fetch by email failed:', emailError.message);
    } else {
      console.log('✅ Fetch by email succeeded:', JSON.stringify(emailData, null, 2));
    }
    
    console.log('\n=== Supabase Access Test Completed ===');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

testSupabaseAccess().catch(console.error);