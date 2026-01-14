// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from '../_shared/cors.ts';

// @ts-ignore: Deno is available in Supabase Edge Functions runtime
Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get environment variables
    // @ts-ignore: Deno is available at runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore: Deno is available at runtime
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      // @ts-ignore: Deno is available at runtime
      const duitkuMerchantCode = Deno.env.get('DUITKU_MERCHANT_CODE');
  // @ts-ignore: Deno is available at runtime
  const duitkuApiKey = Deno.env.get('DUITKU_API_KEY');
  // @ts-ignore: Deno is available at runtime
  const frontendUrl = Deno.env.get('FRONTEND_URL');
    // @ts-ignore: Deno is available at runtime
    const duitkuEnvironment = Deno.env.get('DUITKU_ENVIRONMENT');

    // Return environment variables (redacted for security)
    return new Response(JSON.stringify({
      SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : null,
              SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 10)}...` : null,
        DUITKU_MERCHANT_CODE: duitkuMerchantCode ? `${duitkuMerchantCode.substring(0, 5)}...` : null,
        DUITKU_API_KEY: duitkuApiKey ? `${duitkuApiKey.substring(0, 5)}...` : null,
        FRONTEND_URL: frontendUrl,
        DUITKU_ENVIRONMENT: duitkuEnvironment,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceKey,
            hasDuitkuMerchantCode: !!duitkuMerchantCode,
      hasDuitkuApiKey: !!duitkuApiKey,
      hasFrontendUrl: !!frontendUrl,
      hasDuitkuEnvironment: !!duitkuEnvironment
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});