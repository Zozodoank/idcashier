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
    console.log('=== subscriptions-update-user START ===')
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('ERROR: No auth header')
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
    console.log('Token received, length:', token.length)
    
    // Create Supabase client
    const supabase = createSupabaseClient()
    console.log('Supabase client created')

    // Get user ID and email from token
    console.log('Verifying token...')
    const userId = await getUserIdFromToken(token)
    const userEmail = await getUserEmailFromToken(token)
    console.log('Token verified. User:', userEmail)

    // Check if user is admin (only jho.j80@gmail.com can access this function)
    if (userEmail !== 'jho.j80@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin privileges required.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      )
    }

    // Get subscription data from request body
    console.log('Parsing request body...')
    let body;
    try {
      const rawBody = await req.text()
      console.log('Raw body received (length):', rawBody.length)
      console.log('Raw body content:', rawBody)
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body')
      }
      
      body = JSON.parse(rawBody)
      console.log('Parsed body:', JSON.stringify(body))
    } catch (parseError) {
      console.log('ERROR parsing body:', parseError.message)
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: parseError.message 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
    
    const { userId: targetUserId, months, operation, reason } = body
    console.log('Extracted - targetUserId:', targetUserId, 'months:', months, 'operation:', operation)

    if (!targetUserId) {
      console.log('ERROR: No targetUserId provided')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Handle different operations
    if (operation) {
      console.log('Processing operation:', operation)
      
      switch (operation) {
        case 'delete':
          // Check if target user is protected
          const { data: targetUserData, error: targetUserError } = await supabase
            .from('users')
            .select('email')
            .eq('id', targetUserId)
            .single()
          
          if (targetUserError) {
            throw new Error('User not found')
          }
          
          // Prevent deleting protected users
          if (targetUserData.email === 'demo@idcashier.my.id' || targetUserData.email === 'jho.j80@gmail.com') {
            return new Response(
              JSON.stringify({ error: 'Cannot delete protected user' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
          }
          
          // Delete user from auth.users
          const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId)
          if (deleteError) {
            throw new Error(`Failed to delete user: ${deleteError.message}`)
          }
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              operation: 'delete', 
              result: { userId: targetUserId }, 
              message: 'User deleted successfully' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )

        case 'ban':
          // Disable user by setting end_date to yesterday
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)

          // Get current subscription
          const { data: banSub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (banSub) {
            // Update existing subscription to expire yesterday
            const { error: banError } = await supabase
              .from('subscriptions')
              .update({
                end_date: yesterday.toISOString().split('T')[0],
                updated_at: new Date().toISOString()
              })
              .eq('id', banSub.id)

            if (banError) {
              throw new Error(`Failed to ban user: ${banError.message}`)
            }
          } else {
            // Create expired subscription
            const { error: createBanError } = await supabase
              .from('subscriptions')
              .insert({
                id: crypto.randomUUID(),
                user_id: targetUserId,
                start_date: yesterday.toISOString().split('T')[0],
                end_date: yesterday.toISOString().split('T')[0]
              })

            if (createBanError) {
              throw new Error(`Failed to ban user: ${createBanError.message}`)
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              operation: 'ban',
              result: { userId: targetUserId, bannedDate: yesterday.toISOString().split('T')[0], reason },
              message: `User banned successfully${reason ? `: ${reason}` : ''}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )

        case 'extend':
          // Continue with existing extend logic below
          break

        default:
          return new Response(
            JSON.stringify({ error: 'Invalid operation. Supported: delete, extend, ban' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
      }
    }

    // Validate and convert months parameter
    const monthsNum = Number(months)
    console.log('Months validation - original:', months, 'converted:', monthsNum, 'type:', typeof monthsNum)
    
    if (months === undefined || months === null || isNaN(monthsNum) || monthsNum <= 0) {
      console.log('ERROR: Invalid months parameter')
      return new Response(
        JSON.stringify({ error: 'Valid months parameter is required (positive number)' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
    console.log('Validation passed. monthsNum:', monthsNum)

    // Check if target user exists
    console.log('Checking if target user exists:', targetUserId)
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .single()
    
    if (targetUserError) {
      console.log('ERROR checking user:', targetUserError.message)
    }
    console.log('Target user query result:', targetUser ? 'Found' : 'Not found')
    
    if (targetUserError || !targetUser) {
      console.log('ERROR: User not found')
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }
    
    // Check if subscription already exists for this user
    console.log('Checking existing subscriptions for user:', targetUserId)
    const { data: existingSubscriptions, error: existingError } = await supabase
      .from('subscriptions')
      .select('id, start_date, end_date')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (existingError) {
      console.log('ERROR querying subscriptions:', existingError.message)
    }
    console.log('Existing subscriptions found:', existingSubscriptions?.length || 0)

    let start_date
    let end_date
    const today = new Date()
    
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      const existingSubscription = existingSubscriptions[0]
      const existingEndDate = new Date(existingSubscription.end_date)
      
      // Check if subscription is still active
      if (existingEndDate >= today) {
        // Extend from existing end date
        start_date = existingSubscription.start_date
        const newEndDate = new Date(existingEndDate)
        newEndDate.setMonth(newEndDate.getMonth() + monthsNum)
        end_date = newEndDate.toISOString().split('T')[0]
      } else {
        // Subscription expired, start from today
        start_date = today.toISOString().split('T')[0]
        const newEndDate = new Date(today)
        newEndDate.setMonth(newEndDate.getMonth() + monthsNum)
        end_date = newEndDate.toISOString().split('T')[0]
      }
    } else {
      // No existing subscription, create new one
      start_date = today.toISOString().split('T')[0]
      const newEndDate = new Date(today)
      newEndDate.setMonth(newEndDate.getMonth() + monthsNum)
      end_date = newEndDate.toISOString().split('T')[0]
    }

    console.log('Calculated dates - start:', start_date, 'end:', end_date)

    // Calculate duration and amount based on dates
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const timeDiff = endDateObj.getTime() - startDateObj.getTime();
    const duration = Math.ceil(timeDiff / (1000 * 3600 * 24 * 30)); // Approximate months
    const amount = 0; // Default amount for admin operations
    const planName = `${duration}_months`;

    let result
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      // Update existing subscription
      const subscriptionId = existingSubscriptions[0].id
      console.log('UPDATING existing subscription:', subscriptionId)
      console.log('Update payload:', { start_date, end_date, updated_at: new Date().toISOString() })
      
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          plan_name: planName,
          duration: duration,
          amount: amount,
          start_date,
          end_date,
          updated_at: new Date().toISOString(),
          status: 'active'
        })
        .eq('id', subscriptionId)
        .select('*')
        .single()
      
      if (error) {
        console.log('ERROR updating subscription:', error.message, error.details, error.hint)
        throw error
      }
      
      console.log('Update successful:', data)
      result = data
    } else {
      // Create new subscription
      const newId = crypto.randomUUID()
      console.log('CREATING new subscription with ID:', newId)
      console.log('Insert payload:', { id: newId, user_id: targetUserId, start_date, end_date })
      
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            id: newId,
            user_id: targetUserId,
            plan_name: planName,
            duration: duration,
            amount: amount,
            start_date,
            end_date,
            status: 'active'
          }
        ])
        .select('*')
        .single()
      
      if (error) {
        console.log('ERROR creating subscription:', error.message, error.details, error.hint)
        throw error
      }
      
      console.log('Insert successful:', data)
      result = data
    }
    
    console.log('=== subscriptions-update-user SUCCESS ===')

    // Return response based on operation type
    const response = operation === 'extend' ? {
      success: true,
      operation: 'extend',
      result: { ...result, months: monthsNum },
      message: `Subscription extended by ${monthsNum} months`
    } : result

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('=== subscriptions-update-user ERROR ===')
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    if (error.code) console.error('Error code:', error.code)
    if (error.details) console.error('Error details:', error.details)
    if (error.hint) console.error('Error hint:', error.hint)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || error.toString(),
        type: error.name,
        code: error.code
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})