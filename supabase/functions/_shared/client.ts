// Client utilities for Supabase Edge Functions
import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for use in Edge Functions with forwarded Authorization header
 * @param authHeader - The Authorization header from the request
 * @returns Supabase client instance
 */
export function createSupabaseForFunction(authHeader: string | null) {
  // Validate required environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required Supabase environment variables');
  }
  
  // Create client with service role key for full access
  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
  )
  
  // Forward the Authorization header if provided
  if (authHeader) {
    // @ts-ignore - Supabase client augmentation
    supabase.auth.session = () => ({
      access_token: authHeader.replace('Bearer ', '')
    })
  }
  
  return supabase
}

/**
 * Validate that an Authorization header is present and properly formatted
 * @param authHeader - The Authorization header from the request
 * @returns Boolean indicating if the header is valid
 */
export function validateAuthHeader(authHeader: string | null): authHeader is string {
  return !!authHeader && authHeader.startsWith('Bearer ')
}