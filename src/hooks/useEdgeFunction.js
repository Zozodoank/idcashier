import { useState, useCallback } from 'react';
import { supabase, ensureSession, clearStaleSession } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

/**
 * Custom hook for calling Supabase Edge Functions with proper error handling
 * @param {string} functionName - Name of the Edge Function to call
 * @returns {Object} Object containing data, error, loading state and invoke function
 */
export const useEdgeFunction = (functionName) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Invoke Edge Function with automatic session handling
   * @param {Object} payload - Payload to send to the function
   * @param {Object} options - Additional options for the function call
   * @returns {Promise<Object>} Result of the function call
   */
  const invoke = useCallback(async (payload, options = {}) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // Ensure we have a valid session before calling any function
      const session = await ensureSession();
      
      if (!session) {
        // No valid session, redirect to login
        clearStaleSession();
        window.location.href = '/login';
        throw new Error('No valid session. Redirecting to login.');
      }

      // Prepare function call options
      const invokeOptions = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      // Add Authorization header if not already provided
      if (!invokeOptions.headers.Authorization) {
        invokeOptions.headers.Authorization = `Bearer ${session.access_token}`;
      }

      // Add body for POST requests
      if (payload) {
        invokeOptions.body = payload;
      }

      // Call the Supabase Edge Function
      const result = await supabase.functions.invoke(functionName, invokeOptions);
      
      // Handle errors from the function
      if (result.error) {
        // Handle specific error cases
        if (result.error.status === 401 || result.error.status === 403) {
          // Authentication error - token likely expired
          await clearStaleSession();
          window.location.href = '/login';
          toast.error('Sesi Anda telah kedaluwarsa. Silakan login kembali.');
          throw new Error('Authentication failed. Redirecting to login.');
        } else if (result.error.status >= 500) {
          // Server error
          toast.error('Terjadi kesalahan server. Silakan coba lagi.');
          throw new Error('Server error occurred');
        } else {
          // Other errors
          toast.error(result.error.message || 'Terjadi kesalahan. Silakan coba lagi.');
          throw new Error(result.error.message || 'Function call failed');
        }
      }

      // Set successful data
      setData(result.data);
      return result;
    } catch (err) {
      console.error(`Error calling function ${functionName}:`, err);
      setError(err);
      
      // Show toast for user-facing errors
      if (!err.message.includes('Redirecting to login')) {
        toast.error(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [functionName]);

  return {
    data,
    error,
    loading,
    invoke
  };
};