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
    const { email } = await req.json()
    
    // Validate input
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Normalize email to lowercase for consistency
    const normalizedEmail = email.toLowerCase()

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Use Supabase Auth to send password reset email
    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://idcashier.my.id'
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${siteUrl}/reset-password`
    })

    // Log any errors but still return success to prevent email enumeration
    if (resetError) {
      console.error('Password reset error for ${normalizedEmail}:', resetError)
    } else {
      console.log('Password reset email sent successfully to ${normalizedEmail}')
    }

    // Return success response without exposing the token
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    // Always return success to prevent email enumeration attacks
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'If your email is registered, you will receive a password reset link shortly.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
})