import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.duitku' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function triggerResetPassword(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/reset-password', // Ganti dengan URL reset password Anda jika berbeda
    });

    if (error) {
      console.error('Error triggering password reset:', error.message);
    } else {
      console.log('Password reset email sent successfully to:', email);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Ganti dengan email yang diinginkan
const email = 'testing@tes.com';
triggerResetPassword(email);