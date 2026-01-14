// Setup type definitions for built-in Supabase Runtime APIs
/// <reference path="../deno-stubs.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '../_shared/cors.ts'
import { createSupabaseClient, getUserIdFromToken, getUserEmailFromToken } from '../_shared/auth.ts'

// @ts-ignore
Deno.serve(async (req: Request) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return handleOptions(req)
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

    // Create Supabase client
    const supabase = createSupabaseClient()

    // Get user ID and email from token
    const userId = await getUserIdFromToken(token)
    const userEmail = await getUserEmailFromToken(token)
    console.log('Request by:', userEmail)

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

    // Get request body
    let body;
    try {
      // Clone the request to avoid consuming the body multiple times
      const requestClone = req.clone();
      const rawBody = await requestClone.text()

      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body')
      }

      body = JSON.parse(rawBody)
      console.log('Parsed request body:', body)
    } catch (parseError: any) {
      console.error('Request body parse error:', parseError)
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: parseError.message
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { userId: targetUserId, operation } = body
    console.log('Operation:', operation, 'Target:', targetUserId)

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required', receivedBody: body }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!operation) {
      return new Response(
        JSON.stringify({ error: 'Operation is required', receivedBody: body }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    switch (operation) {
      case 'delete':
        // Check if target user is protected
        const { data: targetUserData, error: targetUserError } = await supabase
          .from('users')
          .select('email')
          .eq('id', targetUserId)
          .single()

        // Prevent deleting protected users
        if (targetUserData && (targetUserData.email === 'demo@idcashier.com' || targetUserData.email === 'jho.j80@gmail.com')) {
          return new Response(
            JSON.stringify({ error: 'Cannot delete protected user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          )
        }

        console.log('Deleting user data for:', targetUserId)

        // 1. Delete sub-users (employees/cashiers)
        const { data: subUsers } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', targetUserId)
          .neq('id', targetUserId)

        if (subUsers && subUsers.length > 0) {
          console.log(`Deleting ${subUsers.length} sub-users`)
          for (const subUser of subUsers) {
            const { error: subAuthErr } = await supabase.auth.admin.deleteUser(subUser.id)
            if (subAuthErr) console.error('Error deleting subuser auth:', subAuthErr)

            const { error: subPublicErr } = await supabase.from('users').delete().eq('id', subUser.id)
            if (subPublicErr) console.error('Error deleting subuser public:', subPublicErr)
          }
        }

        // 2. Delete all related data
        const tables = [
          'sales_items',
          'sales',
          'products',
          'customers',
          'suppliers',
          'categories',
          'expenses',
          'subscriptions',
          'attendance',
          'leaves',
          'employees'
        ]

        for (const table of tables) {
          try {
            const { error: err1 } = await supabase.from(table).delete().eq('user_id', targetUserId)
            if (err1 && !err1.message.includes('does not exist') && !err1.message.includes('no such column')) {
              console.log(`Log: Table ${table} cleanup by user_id: ${err1.message}`)
            }
          } catch (e: any) { /* Ignore */ }

          try {
            const { error: err2 } = await supabase.from(table).delete().eq('tenant_id', targetUserId)
            if (err2 && !err2.message.includes('does not exist') && !err2.message.includes('no such column')) {
              console.log(`Log: Table ${table} cleanup by tenant_id: ${err2.message}`)
            }
          } catch (e: any) { /* Ignore */ }
        }

        // 3. Delete public user profile
        await supabase.from('users').delete().eq('id', targetUserId)

        // 4. Delete auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId)
        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            operation: 'delete',
            result: { userId: targetUserId },
            message: 'User and all associated data deleted successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'ban':
        // Disable user by setting end_date to yesterday
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data: banSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (banSub) {
          const { error: banError } = await supabase
            .from('subscriptions')
            .update({
              end_date: yesterday.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
              status: 'expired'
            })
            .eq('id', banSub.id)

          if (banError) throw new Error(`Failed to ban user: ${banError.message}`)
        } else {
          const { error: createBanError } = await supabase
            .from('subscriptions')
            .insert({
              id: crypto.randomUUID(),
              user_id: targetUserId,
              start_date: yesterday.toISOString().split('T')[0],
              end_date: yesterday.toISOString().split('T')[0],
              status: 'expired'
            })

          if (createBanError) throw new Error(`Failed to ban user: ${createBanError.message}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            operation: 'ban',
            result: { userId: targetUserId, bannedDate: yesterday.toISOString().split('T')[0] },
            message: 'User banned successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      case 'unban':
      case 'unblock':
        // Re-enable user by setting end_date to next month
        console.log('Starting unban/unblock operation for user:', targetUserId)
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        console.log('Next month date:', nextMonth.toISOString().split('T')[0])

        try {
          const { data: unbanSub, error: queryError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (queryError) {
            console.log('Query error:', queryError)
            // If no subscription exists, we'll create one
            if (queryError.code === 'PGRST116') {
              console.log('No subscription found, will create new one')
            } else {
              throw new Error(`Failed to query subscription: ${queryError.message}`)
            }
          }

          if (unbanSub) {
            console.log('Updating existing subscription:', unbanSub.id)
            const { error: unbanError } = await supabase
              .from('subscriptions')
              .update({
                end_date: nextMonth.toISOString().split('T')[0],
                updated_at: new Date().toISOString(),
                status: 'active'
              })
              .eq('id', unbanSub.id)

            if (unbanError) {
              console.error('Update error:', unbanError)
              throw new Error(`Failed to unban user: ${unbanError.message}`)
            }
            console.log('Subscription updated successfully')
          } else {
            console.log('Creating new subscription')
            const { error: createUnbanError } = await supabase
              .from('subscriptions')
              .insert({
                id: crypto.randomUUID(),
                user_id: targetUserId,
                start_date: new Date().toISOString().split('T')[0],
                end_date: nextMonth.toISOString().split('T')[0],
                status: 'active'
              })

            if (createUnbanError) {
              console.error('Insert error:', createUnbanError)
              throw new Error(`Failed to unban user: ${createUnbanError.message}`)
            }
            console.log('New subscription created successfully')
          }
        } catch (operationError: any) {
          console.error('Unban operation failed:', operationError)
          throw operationError
        }

        console.log('Unban/unblock operation completed successfully')
        return new Response(
          JSON.stringify({
            success: true,
            operation: 'unban',
            result: { userId: targetUserId, endDate: nextMonth.toISOString().split('T')[0] },
            message: 'User unbanned successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation. Supported: delete, ban, unban', receivedBody: body }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error: any) {
    console.error('=== subscriptions-update-user ERROR ===')
    console.error('Error type:', error.name)
    console.error('Error message:', error.message)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message || error.toString(),
        type: error.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
