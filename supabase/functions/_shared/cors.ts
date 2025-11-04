// CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://idcashier.my.id',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  'Vary': 'Origin'
};

// Handle preflight OPTIONS requests
export function handleOptions(req: Request) {
  const origin = req.headers.get('origin') || '';
  
  // For development, allow localhost
  if (origin === 'http://localhost:5173' || origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Origin': origin
      }
    });
  }
  
  // For production, check against allowed origins
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Origin': 'https://idcashier.my.id'
    }
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