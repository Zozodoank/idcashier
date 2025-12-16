// Test script to verify Supabase client setup
import { supabase } from '../src/lib/supabaseClient.js';

console.log('Supabase client imported successfully');

// Check if Supabase URL and Anon Key are set
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  console.log('Supabase credentials found in environment variables');
  console.log('Supabase URL:', supabaseUrl);
} else {
  console.log('Supabase credentials not found. Please add them to your .env file');
  console.log('Check SUPABASE_SETUP.md for instructions');
}

console.log('Test completed');