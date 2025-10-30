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
    const userId = await getUserIdFromToken(token)

    // Get subscription data from request body
    const body = await req.json()
    const { start_date, end_date, months } = body

    let finalStartDate: string
    let finalEndDate: string

    // If months is provided, calculate dates automatically
    if (months && typeof months === 'number' && months > 0) {
      // Check if subscription already exists for this user
      const { data: existingSubscriptions } = await supabase
        .from('subscriptions')
        .select('id, start_date, end_date')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      const today = new Date()
      
      if (existingSubscriptions && existingSubscriptions.length > 0) {
        const existingSubscription = existingSubscriptions[0]
        const existingEndDate = new Date(existingSubscription.end_date)
        
        // Check if subscription is still active
        if (existingEndDate >= today) {
          // Extend from existing end date
          finalStartDate = existingSubscription.start_date
          const newEndDate = new Date(existingEndDate)
          newEndDate.setMonth(newEndDate.getMonth() + months)
          finalEndDate = newEndDate.toISOString().split('T')[0]
        } else {
          // Subscription expired, start from today
          finalStartDate = today.toISOString().split('T')[0]
          const newEndDate = new Date(today)
          newEndDate.setMonth(newEndDate.getMonth() + months)
          finalEndDate = newEndDate.toISOString().split('T')[0]
        }
      } else {
        // No existing subscription, create new one
        finalStartDate = today.toISOString().split('T')[0]
        const newEndDate = new Date(today)
        newEndDate.setMonth(newEndDate.getMonth() + months)
        finalEndDate = newEndDate.toISOString().split('T')[0]
      }
    } else if (start_date && end_date) {
      // Use provided dates (backward compatibility)
      finalStartDate = start_date
      finalEndDate = end_date
    } else {
      return new Response(
        JSON.stringify({ error: 'Either months or (start_date and end_date) are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check if subscription already exists for this user
    const { data: existingSubscriptions, error: existingError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)

    let result
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      // Update existing subscription
      const subscriptionId = existingSubscriptions[0].id
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          start_date: finalStartDate,
          end_date: finalEndDate,
          updated_at: new Date()
        })
        .eq('id', subscriptionId)
        .select('*')
        .single()
      
      if (error) {
        throw error
      }
      
      result = data
    } else {
      // Create new subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            id: crypto.randomUUID(), // Generate UUID for the subscription
            user_id: userId,
            start_date: finalStartDate,
            end_date: finalEndDate
          }
        ])
        .select('*')
        .single()
      
      if (error) {
        throw error
      }
      
      result = data
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  } catch (error) {
    console.error('Create/update subscription error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})