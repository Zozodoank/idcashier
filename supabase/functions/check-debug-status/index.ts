import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_URL') || '',
      // @ts-ignore: Deno is available at runtime
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Get Recent Payments
    const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    // Get Recent Subscriptions
    const { data: subscriptions, error: subErr } = await supabase
        .from('subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

     // Get Recent Users (First 5 updated)
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, email, role, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

    return new Response(JSON.stringify({ 
        timestamp: new Date().toISOString(),
        payments, 
        subscriptions, 
        users,
        errors: { payErr, subErr, userErr }
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
