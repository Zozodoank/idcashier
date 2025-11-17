import { supabase } from './supabaseClient';

/**
 * Wrapper for Supabase Edge Functions using the native fetch API for maximum control.
 * @param {string} name - The Edge Function name.
 * @param {object} [body] - The request body for POST.
 * @param {object} [options] - Additional options like method and headers.
 * @returns {Promise<any>} - The data from the Edge Function.
 * @throws {Error} - If the call fails.
 */
export async function invokeFn(name, body, options = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token && !options.headers?.Authorization) {
      throw new Error('Authentication token is missing.');
    }
    
        // Build the function URL manually for stability
    const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const url = `${functionsUrl}/${name}`;

    // Explicitly build fetch options
    const fetchOptions = {
      method: options.method || (body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, // Manually add the anon key
        ...options.headers,
      },
    };

    if (token && !fetchOptions.headers.Authorization) {
      fetchOptions.headers.Authorization = `Bearer ${token}`;
    }

    if (body && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    console.log(`Invoking function '${name}' via fetch with URL: ${url} and options:`, fetchOptions);

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error(`Error from function '${name}' (status ${response.status}):`, errorBody);
        throw new Error(errorBody.error || `Edge Function returned a non-2xx status code: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error in invokeFn (fetch) calling '${name}':`, error.message);
    throw new Error(`Failed to call function '${name}': ${error.message}`);
  }
}