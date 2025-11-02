import { supabase } from './supabaseClient';

/**
 * Wrapper function for calling Supabase Edge Functions with proper authentication and error handling
 * @param {string} name - The name of the Edge Function to call
 * @param {object} [body] - The body to send with the request (for POST requests)
 * @returns {Promise<any>} The data returned by the Edge Function
 * @throws {Error} If there's an error calling the function or if no auth token is available
 */
export async function invokeFn(name, body) {
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    // Throw error if no token is available
    if (!token) {
      throw new Error('No auth token/session. Ensure login completed before calling functions.');
    }
    
    // Prepare the options for the function call
    const options = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };
    
    // Add body for POST requests
    if (body) {
      options.body = body; // Pass object directly (NO JSON.stringify)
    }
    
    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke(name, options);
    
    // Throw error if the function call failed
    if (error) {
      // Try to parse structured error response
      if (error.message && error.message.includes('{') && error.message.includes('}')) {
        try {
          const errorObj = JSON.parse(error.message);
          if (errorObj.code === 401) {
            throw new Error('Sesi login telah berakhir. Silakan login ulang.');
          } else if (errorObj.code === 404) {
            throw new Error('Data tidak ditemukan.');
          } else if (errorObj.code === 400) {
            throw new Error(errorObj.error || errorObj.message || 'Permintaan tidak valid.');
          } else {
            throw new Error(errorObj.error || errorObj.message || 'Gagal memanggil fungsi.');
          }
        } catch (parseError) {
          throw new Error(error.message || 'Gagal memanggil fungsi.');
        }
      } else {
        throw new Error(error.message || 'Gagal memanggil fungsi.');
      }
    }
    
    return data;
  } catch (error) {
    console.error(`Error calling function ${name}:`, error);
    throw error;
  }
}