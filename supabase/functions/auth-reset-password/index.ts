// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    // When user clicks the reset link, they are redirected to /reset-password with token in URL
    // The frontend should extract the token and call this endpoint with token and new password
    const { token, password, access_token } = await req.json()
    
    // Validate input
    if ((!token && !access_token) || !password) {
      return new Response(
        JSON.stringify({ error: 'Token/access_token and password are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Check password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // If access_token is provided (from email link), verify and update password
    if (access_token) {
      // Get user from access token
      const { data: { user }, error: userError } = await supabase.auth.getUser(access_token)
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired reset token' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      // Update password using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: password }
      )

      if (updateError) {
        console.error('Error updating password:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update password' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Password has been reset successfully. You can now log in with your new password.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Fallback: Check if the reset token exists in password_resets table (for backward compatibility)
    if (token) {
      const { data: resetRecords, error: resetError } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())

      if (resetError) {
        throw resetError
      }

      if (resetRecords.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired reset token' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      const resetRecord = resetRecords[0]

      // Get user from database to find their auth ID
      const { data: users, error: userLookupError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', resetRecord.user_id)
        .single()

      if (userLookupError || !users) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        users.id,
        { password: password }
      )

      if (updateError) {
        console.error('Error updating password:', updateError)
        throw updateError
      }

      // Mark the reset token as used
      const { error: usedError } = await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('id', resetRecord.id)

      if (usedError) {
        console.error('Error marking reset token as used:', usedError)
        // Don't fail the request if we can't mark the token as used
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Password has been reset successfully. You can now log in with your new password.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  } catch (error) {
    console.error('Password reset error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})