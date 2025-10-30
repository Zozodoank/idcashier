# Supabase Edge Functions Troubleshooting

This document explains common issues you may encounter when working with Supabase Edge Functions and how to resolve them.

## Common IDE Errors

### 1. "Cannot find module 'https://esm.sh/@supabase/supabase-js@2' or its corresponding type declarations"

**Cause**: Your IDE doesn't recognize ESM imports from CDNs.

**Solution**: 
- This is expected behavior and does not affect functionality
- Edge Functions will work correctly when deployed to Supabase
- You can ignore these errors during development

### 2. "Cannot find name 'Deno'"

**Cause**: Your IDE doesn't recognize Deno globals.

**Solution**:
- This is expected behavior and does not affect functionality
- Edge Functions will work correctly when deployed to Supabase
- You can ignore these errors during development

## Development Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Start Supabase Locally (Optional)

```bash
supabase start
```

### 3. Test Functions Locally

```bash
supabase functions serve
```

## Deployment Issues

### 1. "Missing Environment Variables"

**Cause**: Required environment variables are not set in your Supabase project.

**Solution**:
1. Go to your Supabase dashboard
2. Navigate to Settings > Configuration > Environment Variables
3. Add the following variables:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### 2. "Function Not Found"

**Cause**: Function name doesn't match directory name.

**Solution**:
- Ensure function directory name matches the function name
- Function name should be the same as the directory name in `supabase/functions/`

### 3. CORS Issues

**Cause**: CORS headers not properly set.

**Solution**:
- Ensure all functions import and use `corsHeaders` from `../_shared/cors.ts`
- Verify the allowed origin matches your frontend domain

## Testing Functions

### 1. Local Testing

```bash
# Serve functions locally
supabase functions serve

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/auth-login' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","password":"password"}'
```

### 2. Remote Testing

```bash
# Deploy function
npx supabase functions deploy auth-login --no-verify-jwt

# Test with curl
curl -i --location --request POST 'https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/auth-login' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","password":"password"}'
```

## Best Practices

### 1. Error Handling

Always wrap function logic in try/catch blocks:

```typescript
Deno.serve(async (req) => {
  try {
    // Function logic here
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
```

### 2. CORS Handling

Always handle preflight requests and set CORS headers:

```typescript
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  // Function logic here
})
```

### 3. Environment Variables

Always use `Deno.env.get()` for environment variables:

```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
```

## Function Structure

Each Edge Function should follow this structure:

```
supabase/functions/
├── _shared/
│   ├── cors.ts
│   └── auth.ts
├── FUNCTION_NAME/
│   ├── index.ts
│   ├── deno.json
│   └── .npmrc
├── import_map.json
└── README.md
```

## Deployment Automation

Use the provided scripts for deployment:

```bash
# Deploy all functions
./deploy-functions.bat

# Test all functions
./test-edge-functions.bat
```

## Conclusion

The IDE errors you see when working with Supabase Edge Functions are normal and expected. They occur because:

1. Edge Functions use Deno runtime, not Node.js
2. Your IDE may not recognize Deno globals
3. ESM imports from CDNs may show as unresolved modules

These errors do not affect the functionality of your Edge Functions. They will work correctly when deployed to Supabase. Focus on writing correct logic and proper error handling, and ignore the IDE errors during development.