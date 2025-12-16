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
      let accessToken = null;
      const session = await ensureSession();
      
      if (session) {
        accessToken = session.access_token;
      } else {
        // Fallback: Check localStorage for token if session is missing (e.g. timeout)
        const storedToken = localStorage.getItem('idcashier_token');
        if (storedToken) {
          console.log('Using stored token as fallback for Edge Function call');
          accessToken = storedToken;
        }
      }
      
      if (!accessToken) {
        // No valid session or token, redirect to login
        clearStaleSession();
        window.location.href = '/login';
        throw new Error('No valid session. Redirecting to login.');
      }

      // Use native fetch instead of supabase.functions.invoke to bypass potential client state issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      };

      const fetchOptions = {
        method: payload ? 'POST' : 'GET',
        headers,
        signal: controller.signal,
        ...options
      };

      if (payload) {
        fetchOptions.body = JSON.stringify(payload);
      }

      console.log(`📡 Calling Edge Function: ${functionUrl}`);
      
      const response = await fetch(functionUrl, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401 || response.status === 403) {
          // Authentication error - token likely expired
          await clearStaleSession();
          window.location.href = '/login';
          const errorMsg = 'Sesi Anda telah kedaluwarsa. Silakan login kembali.';
          toast.error(errorMsg);
          throw new Error(errorMsg);
        } else {
          const errorText = await response.text();
          let errorMessage = 'Terjadi kesalahan. Silakan coba lagi.';
          try {
             const errorJson = JSON.parse(errorText);
             errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch (e) {
             errorMessage = errorText || errorMessage;
          }
          
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
      }

      const resultData = await response.json();
      
      // Set successful data
      setData(resultData);
      return { data: resultData, error: null };

    } catch (err) {
      console.error(`Error calling function ${functionName}:`, err);
      setError(err);
      
      // Show toast for user-facing errors if not already handled (redirects)
      if (!err.message.includes('Redirecting to login') && !err.message.includes('Sesi Anda telah kedaluwarsa')) {
        toast.error(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
      }
      
      // Return error structure similar to supabase-js
      return { data: null, error: err };
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