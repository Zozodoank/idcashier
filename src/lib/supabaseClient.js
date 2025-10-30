import { createClient } from '@supabase/supabase-js'

// Function to get environment variables from different sources
function getEnvVariable(name) {
  // Try import.meta.env (browser/ES modules)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return import.meta.env[name];
  }
  // Try process.env (Node.js)
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  // Try global environment (fallback)
  if (typeof window !== 'undefined' && window[name]) {
    return window[name];
  }
  return undefined;
}

const supabaseUrl = getEnvVariable('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVariable('VITE_SUPABASE_ANON_KEY');

console.log('Supabase config check:');
console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Not set');
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Not set');

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message);
  }
} else {
  console.warn('Supabase credentials not found. Skipping Supabase client creation.');
}

export { supabase };