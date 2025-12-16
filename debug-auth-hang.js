
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock a token - we need a valid token to test this properly.
// Since we don't have one easily, we'll try to sign in first to get one.
// Or we can try to query as anon if that's what's happening.

async function debugAuthFlow() {
  console.log('Starting debug flow...');
  
  // 1. Login to get a valid token (simulating existing localStorage token)
  // We need a test user. I'll check if I can find one or create one, 
  // but for now let's try to query without a token (anon) to see if it hangs,
  // and then try to query with a token if I can get one.
  
  // Actually, let's try to just query the users table first.
  console.log('Test 1: Query users table (anon/service role)');
  console.time('QueryUsers');
  try {
    // We use a random email that probably doesn't exist, just to check responsiveness
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .maybeSingle();
      
    console.timeEnd('QueryUsers');
    if (error) console.log('Query error:', error.message);
    else console.log('Query success (or empty):', data);
  } catch (e) {
    console.timeEnd('QueryUsers');
    console.log('Query exception:', e);
  }

  // 2. Simulate the exact flow if we had a token
  console.log('\nTest 2: Login and query users table (authenticated)');
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'demo@idcashier.my.id',
      password: 'Demo2025'
    });

    if (authError) {
      console.log('Login failed:', authError.message);
    } else {
      console.log('Login successful. User ID:', authData.user.id);
      const token = authData.session.access_token;
      
      // Now query users table as authenticated user
      console.time('QueryUsersAuth');
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', 'demo@idcashier.my.id')
        .single();
        
      console.timeEnd('QueryUsersAuth');
      
      if (error) console.log('Authenticated query error:', error.message);
      else console.log('Authenticated query success:', data);
    }
  } catch (e) {
    console.timeEnd('QueryUsersAuth');
    console.log('Authenticated query exception:', e);
  }
}

debugAuthFlow();
