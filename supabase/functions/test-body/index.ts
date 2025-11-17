// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'test-body' is initializing.");

Deno.serve(async (req) => {
  console.log(`[test-body] Received request: ${req.method}`);

  // Handle preflight OPTIONS request with permissive headers for this test
  if (req.method === 'OPTIONS') {
    console.log("[test-body] Handling OPTIONS preflight request.");
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apikey, Baggage, sb-request-id', // Be explicit
      },
    });
  }

  try {
    // Check content-length header first, which is a strong indicator
    const contentLength = req.headers.get('content-length');
    console.log(`[test-body] Content-Length header: ${contentLength}`);

    if (contentLength === '0') {
        console.error("[test-body] Received content-length of 0. Body is confirmed empty.");
        return new Response(
            JSON.stringify({
                success: false,
                error: "EMPTY_BODY",
                message: "The server received a POST request but the body was empty (Content-Length was 0).",
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }

    const body = await req.json();
    console.log("[test-body] Successfully parsed request body:", body);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Body received successfully.",
        received_body: body,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[test-body] Error processing request:", error.message);
    const rawBody = await req.text().catch(() => "Could not read raw body text.");
    console.error("[test-body] Raw body content on error:", rawBody);

    return new Response(
      JSON.stringify({
        success: false,
        error: "PROCESSING_FAILED",
        message: error.message,
        raw_body_preview: rawBody.substring(0, 500),
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});