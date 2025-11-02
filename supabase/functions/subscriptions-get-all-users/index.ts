// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  // Get origin from request headers for dynamic CORS
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
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

    // Get user ID from token
    const userId = await getUserIdFromToken(token)

    // Check if user is admin (only jho.j80@gmail.com can access this function)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    if (userData.email !== 'jho.j80@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Get all users first
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (usersError) {
      throw usersError
    }
    
    // For each user, get their LATEST subscription
    const formattedUsers = await Promise.all(users.map(async (user) => {
      // Get latest subscription for this user (order by created_at DESC, limit 1)
      const { data: latestSubscription } = await supabase
        .from('subscriptions')
        .select('start_date, end_date, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })  // Latest first
        .limit(1)
        .maybeSingle()  // Use maybeSingle instead of single to avoid error if no subscription
      
      let subscription_status = 'no_subscription'
      if (latestSubscription) {
        const today = new Date()
        const endDate = new Date(latestSubscription.end_date)
        subscription_status = endDate >= today ? 'active' : 'expired'
      }
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        start_date: latestSubscription ? latestSubscription.start_date : null,
        end_date: latestSubscription ? latestSubscription.end_date : null,
        subscription_status
      }
    }))
    
    return new Response(
      JSON.stringify(formattedUsers),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Get all users error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})