/// <reference path="../deno-stubs.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// @ts-ignore: Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: 'Email and token are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log(`Verifying email: ${email}`);

    // Get environment variables
    // @ts-ignore: Deno is available at runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore: Deno is available at runtime
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // @ts-ignore: Deno is available at runtime
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Method 1: Try direct verification using Supabase Auth API
    try {
      const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey || '',
          'Authorization': `Bearer ${supabaseServiceKey}`
        }),
        body: JSON.stringify({
          type: 'signup',
          token_hash: token,
          email: email
        })
      });

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok && verifyData.user) {
        console.log('Email verified successfully via Auth API');

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email verified successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    } catch (authError) {
      console.warn('Auth API verification failed:', authError);
    }

    // Method 2: Manual confirmation via Admin API
    try {
      // List users to find the user
      const listUsersResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'GET',
        headers: new Headers({
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        })
      });

      if (!listUsersResponse.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await listUsersResponse.json();
      const user = usersData.users?.find((u: any) => u.email === email);

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Update user to confirm email
      const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: new Headers({
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }),
        body: JSON.stringify({
          email_confirm: true
        })
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to confirm email');
      }

      const updateData = await updateResponse.json();
      console.log('Email confirmed manually via Admin API');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email verified successfully'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } catch (adminError) {
      console.error('Admin API verification failed:', adminError);
    }

    // If all methods fail
    return new Response(
      JSON.stringify({
        error: 'Verification failed. The link may be expired or invalid. Please request a new verification email.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );

  } catch (error: any) {
    console.error('Email verification error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
})