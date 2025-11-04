import { createClient } from '@supabase/supabase-js'
import { toast } from 'react-hot-toast' // We'll add this later

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
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message);
  }
} else {
  console.warn('Supabase credentials not found. Skipping Supabase client creation.');
}

/**
 * Ensure session is valid and ready
 * Clears stale session if token is expired
 * @returns {Promise<Object|null>} Session object or null if invalid
 */
export async function ensureSession() {
  if (!supabase) return null;
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session check failed:', error.message);
      await clearStaleSession();
      return null;
    }
    
    // If no session, clear any stale data
    if (!session) {
      await clearStaleSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error ensuring session:', error);
    await clearStaleSession();
    return null;
  }
}

/**
 * Clear stale session data
 */
export async function clearStaleSession() {
  try {
    // Clear local storage items
    localStorage.removeItem('idcashier_token');
    // Sign out from Supabase
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error clearing stale session:', error);
  }
}

// Handle auth state changes
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    switch (event) {
      case 'SIGNED_OUT':
        // User explicitly signed out
        console.log('User signed out');
        clearStaleSession();
        // Redirect handled by AuthGuard
        break;
        
      case 'TOKEN_REFRESHED':
        // Token was successfully refreshed
        console.log('Token refreshed');
        // Update local storage if needed
        if (session?.access_token) {
          localStorage.setItem('idcashier_token', session.access_token);
        }
        break;
        
      case 'TOKEN_REFRESH_FAILED':
        // Token refresh failed, session likely expired
        console.log('Token refresh failed');
        clearStaleSession();
        // Redirect to login (handled by AuthGuard)
        window.location.href = '/login';
        break;
        
      default:
        break;
    }
  });
}

export { supabase };