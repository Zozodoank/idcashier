// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken, getUserEmailFromToken } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization token required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      )
    }

    // Extract token
    const token = authHeader.substring(7)
    
    // Create Supabase client
    const supabase = createSupabaseClient()

    // Get user ID and email from token
    const userId = await getUserIdFromToken(token)
    const userEmail = await getUserEmailFromToken(token)

    // Get user data from request body
    const { name, email, role, tenant_id } = await req.json()

    // Validate required fields
    if (!name || !email || !role) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and role are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check if user is admin
    const isAdmin = userEmail === 'jho.j80@gmail.com'

    // Determine tenant_id
    let finalTenantId
    if (isAdmin && tenant_id) {
      // Admin can specify tenant_id
      finalTenantId = tenant_id
    } else if (isAdmin && role === 'owner') {
      // Admin creating owner without tenant_id - will be set to user's own ID by auth-register
      // Don't set tenant_id here, let it be null for now
      finalTenantId = null
    } else {
      // Non-admin creates user under their tenant
      finalTenantId = userId
    }

    // Create user with appropriate tenant_id
    const insertData: any = {
      name,
      email,
      role
    }
    
    if (finalTenantId) {
      insertData.tenant_id = finalTenantId
    }

    const { data, error } = await supabase
      .from('users')
      .insert([insertData])
      .select()
      .single()
    
    if (error) {
      console.error(`Database error creating user for user ${userId}:`, error)
      throw error
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  } catch (error) {
    console.error('Users-create error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})