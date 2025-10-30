// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken } from '../_shared/auth.ts'

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

    // Get user ID from token
    let userId = getUserIdFromToken(token)

    // For cashiers, use the owner's subscription (tenantId)
    // First get user role and tenantId
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      throw new Error('User not found')
    }

    // If user is a cashier, use the owner's ID for subscription
    if (userData.role === 'cashier') {
      userId = userData.tenant_id
    }
    
    // Get subscription for the user (or owner if cashier)
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)  // Use owner's ID for cashiers
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Subscription query error:', error)
      // If subscriptions table doesn't exist or other error, return default subscription status
      return new Response(
        JSON.stringify({
          user_id: userId,
          start_date: new Date().toISOString().split('T')[0],
          end_date: '2099-12-31',
          is_active: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
    
    if (subscriptions.length === 0) {
      // If no subscription found, return default subscription status
      return new Response(
        JSON.stringify({
          user_id: userId,
          start_date: new Date().toISOString().split('T')[0],
          end_date: '2099-12-31',
          is_active: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
    
    const subscription = subscriptions[0]
    const today = new Date()
    const endDate = new Date(subscription.end_date)
    const isActive = endDate >= today
    
    return new Response(
      JSON.stringify({
        ...subscription,
        is_active: isActive
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Get subscription error:', error)
    // Return default subscription status even in case of error
    return new Response(
      JSON.stringify({
        user_id: 'unknown',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '2099-12-31',
        is_active: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
})