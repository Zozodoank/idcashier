// CORS headers for Supabase Edge Functions
export function getCorsHeaders(origin: string) {
  // Read allowed origins from environment variables with sensible defaults
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  let allowedOrigins: string[];
  
  if (allowedOriginsEnv) {
    allowedOrigins = allowedOriginsEnv.split(',').map(o => o.trim());
  } else {
    // Default allowed origins
    allowedOrigins = [
      'https://idcashier.my.id',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
  }

  // Add Vary: Origin header for proper caching
  const baseHeaders = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Vary': 'Origin'
  };

  if (!allowedOrigins.includes(origin)) {
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    'Access-Control-Allow-Origin': origin
  };
}

// Backward-compatible export for existing functions
// This will be removed after all functions migrate to getCorsHeaders(origin)
export const corsHeaders = getCorsHeaders(Deno.env.get('FRONTEND_URL') || '*');