// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createResponse } from '../_shared/cors.ts'

// @ts-ignore: Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
  const body = await req.json();
  const headers = Object.fromEntries(req.headers.entries());

  console.log('Request body:', body);
  console.log('Request headers:', headers);

  return createResponse({
    body,
    headers
  });
})