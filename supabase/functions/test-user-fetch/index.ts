// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseForFunction } from '../_shared/client.ts';
import { getUserIdFromToken } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Create Supabase client
    let supabase;
    try {
      supabase = createSupabaseForFunction(authHeader);
    } catch (clientError) {
      return new Response(JSON.stringify({ error: `Failed to create Supabase client: ${clientError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Get user ID from token
    let userId;
    try {
      userId = await getUserIdFromToken(token);
    } catch (error) {
      return new Response(JSON.stringify({ error: `Token validation failed: ${error.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Fetch user data by ID
    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone, role, tenant_id')
        .eq('id', userId)
        .single();

      if (userError || !data) {
        return new Response(JSON.stringify({ 
          error: 'User fetch by ID failed',
          userId: userId,
          userError: userError?.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }

      return new Response(JSON.stringify({
        success: true,
        userId: userId,
        userData: data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (fetchError) {
      return new Response(JSON.stringify({ 
        error: `Exception during user fetch by ID: ${fetchError.message}`,
        userId: userId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});