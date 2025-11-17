// CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://idcashier.my.id',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, baggage, sb-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  'Vary': 'Origin'
};

// Handle preflight OPTIONS requests dynamically
export function handleOptions(req: Request) {
  const headers = new Headers(corsHeaders);

  // Reflect the requested headers for dynamic handling
  const requestHeaders = req.headers.get('Access-Control-Request-Headers');
  if (requestHeaders) {
    headers.set('Access-Control-Allow-Headers', requestHeaders);
  }

  // Reflect the requested origin
  const origin = req.headers.get('origin');
  if (origin && (origin.startsWith('http://localhost:') || origin === 'https://idcashier.my.id')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', 'https://idcashier.my.id');
  }

  return new Response(null, {
    status: 204, // No Content
    headers: headers
  });
}

// Dynamic CORS headers function
export function getCorsHeaders(origin: string) {
  // For development, allow localhost
  if (origin === 'http://localhost:5173' || origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin
    };
  }
  
  // For production, return standard headers
  return corsHeaders;
}

// Helper function to create JSON responses with CORS headers
export function createResponse(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    },
  });
}

// Helper function to create error responses with CORS headers
export function createErrorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders
    },
  });
}