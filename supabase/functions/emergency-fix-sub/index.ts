import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const email = url.searchParams.get('email');
  
  if (!email) return new Response('Email required', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  // 1. Find User
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('email', email)
    .single();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'User not found', details: userError }), { status: 404 });
  }

  // 2. Find Existing Subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.tenant_id || user.id) // Use tenant_id logic same as real payment
    .single();

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // Grant 30 days access

  let result;
  if (sub) {
     // Update - Schema only has start_date, end_date, created_at, updated_at
     result = await supabase.from('subscriptions').update({
        end_date: endDate.toISOString(),
        updated_at: new Date().toISOString()
     }).eq('id', sub.id).select();
  } else {
     // Insert
     result = await supabase.from('subscriptions').insert({
        user_id: user.tenant_id || user.id,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString()
     }).select();
  }
  
  // Also fix pending payments for this user to avoid confusion
  await supabase.from('payments')
    .update({ status: 'completed', result_message: 'Manual Fix' })
    .eq('user_id', user.id)
    .eq('status', 'pending');

  return new Response(JSON.stringify({ success: true, action: sub ? 'updated' : 'inserted', data: result.data, error: result.error }), { 
      headers: { 'Content-Type': 'application/json' } 
  });
});
