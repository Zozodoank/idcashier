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

// Security: Don't log Supabase URL to avoid exposing project ref
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
      },
      global: {
        headers: {
          'X-Client-Info': 'idcashier/1.0.0',
        },
      },
      db: {
        schema: 'public',
      },
      realtime: {
        params: {
          eventsPerSecond: 2
        }
      }
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message);
  }
} else {
  console.warn('Supabase credentials not found. Skipping Supabase client creation.');
}

function parseStoredAppToken(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );
    const payload = JSON.parse(atob(paddedPayload));

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      access_token: token,
      user: {
        id: payload.sub || payload.user_id || payload.email || null,
        email: payload.email || null,
        user_metadata: payload.user_metadata || {}
      }
    };
  } catch (error) {
    console.warn('Could not parse stored app token:', error.message);
    return null;
  }
}

function getStoredAppSession() {
  try {
    return parseStoredAppToken(localStorage.getItem('idcashier_token'));
  } catch (error) {
    console.warn('Could not read stored app token:', error.message);
    return null;
  }
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
      const appSession = getStoredAppSession();
      if (appSession) {
        return appSession;
      }
      await clearStaleSession();
      return null;
    }
    
    // If no Supabase session exists, keep a valid app token created by the login Edge Function.
    if (!session) {
      const appSession = getStoredAppSession();
      if (appSession) {
        return appSession;
      }
      await clearStaleSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error ensuring session:', error);
    const appSession = getStoredAppSession();
    if (appSession) {
      return appSession;
    }
    await clearStaleSession();
    return null;
  }
}

/**
 * Clear stale session data
 */
export async function clearStaleSession(shouldSignOut = true) {
  try {
    // Clear local storage items
    localStorage.removeItem('idcashier_token');
    localStorage.removeItem('idcashier_refresh_token');
    // Security: Use dynamic project ref from environment instead of hardcoded
    const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      localStorage.removeItem(`sb-${projectRef}-auth-token`); // Clear Supabase internal token
    }
    
    // Sign out from Supabase only if requested
    // This prevents infinite loops when called from onAuthStateChange('SIGNED_OUT')
    if (shouldSignOut && supabase) {
      await supabase.auth.signOut();
    }
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
        // Don't call signOut() again, just clear local storage
        clearStaleSession(false);
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
        // Redirect to login only if not already there to avoid loops
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        break;
        
      default:
        break;
    }
  });
}

/**
 * Test Supabase connection with retry logic (optimized for faster initialization)
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds between retries
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function testSupabaseConnection(maxRetries = 2, baseDelay = 500) {
  if (!supabase) {
    console.error('Supabase client not initialized');
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Testing Supabase connection (attempt ${attempt}/${maxRetries})`);

      // Use a simple query to test connectivity with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 5000) // Increased to 5 seconds
      );

      // Use HEAD request which is faster and lighter
      const queryPromise = supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      const { error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        // Don't throw on RLS errors (4xx), just log them as a warning but consider connection successful
        // PGRST116 is "The result contains 0 rows" which happens with .single() on empty result
        // For HEAD request, we might get other errors if RLS blocks completely
        console.warn('Connection test response:', error);
        
        // If it's a network error or timeout, we should fail
        if (error.message && (error.message.includes('network') || error.message.includes('timeout'))) {
            throw error;
        }
        
        console.warn('Connection test passed despite API error (likely RLS). This confirms connectivity.');
        return true;
      }

      console.log('✅ Supabase connection test successful');
      return true;

    } catch (error) {
      console.warn(`Connection test attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        console.error('❌ All connection test attempts failed');
        return false;
      }

      // Exponential backoff: wait baseDelay * 2^(attempt-1) milliseconds
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
}

/**
 * Retry wrapper for Supabase operations
 * @param {Function} operation - The async operation to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds between retries
 * @returns {Promise} - Result of the operation
 */
export async function withRetry(operation, maxRetries = 2, baseDelay = 500) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error.message);

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Check if error is retryable
      const isRetryable = error.message.includes('fetch') ||
                         error.message.includes('network') ||
                         error.message.includes('timeout') ||
                         error.code === 'PGRST301'; // Connection timeout

      if (!isRetryable) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying operation in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export { supabase };
