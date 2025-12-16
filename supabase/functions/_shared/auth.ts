// Authentication utilities for Supabase Edge Functions
import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for use in Edge Functions
 */
export function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/**
 * Get user ID from authorization token
 * Verifies the JWT token using Supabase's built-in authentication
 */
export async function getUserIdFromToken(token: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error) {
    throw new Error(`Token verification failed: ${error.message}`)
  }
  
  if (!user) {
    throw new Error('Invalid or expired token')
  }
  
  return user.id
}

/**
 * Get user email from authorization token
 * Verifies the JWT token using Supabase's built-in authentication
 */
export async function getUserEmailFromToken(token: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error) {
    throw new Error(`Token verification failed: ${error.message}`)
  }
  
  if (!user || !user.email) {
    throw new Error('Invalid or expired token')
  }
  
  return user.email
}

/**
 * Get tenant owner ID from userId (works for both owner and cashier)
 * If user is owner: returns their own ID
 * If user is cashier: returns their tenant_id (which is the owner's ID)
 */
export async function getTenantOwnerId(supabase: any, userId: string): Promise<string> {
  const { data: userData, error } = await supabase
    .from('users')
    .select('id, role, tenant_id')
    .eq('id', userId)
    .single()
  
  if (error || !userData) {
    throw new Error('User not found')
  }
  
  // If user is cashier, return their tenant_id (owner's ID)
  // If user is owner, return their own ID
  return userData.role === 'cashier' ? userData.tenant_id : userData.id
}

/**
 * Validate that a user has permission to access a resource
 */
export async function validateUserPermission(supabase: any, userId: string, resourceId: string, resourceType: string) {
  // Check if the resource belongs to the user
  const { data, error } = await supabase
    .from(resourceType)
    .select('user_id')
    .eq('id', resourceId)
    .eq('user_id', userId)
    .single()
  
  if (error || !data) {
    return false
  }
  
  return true
}