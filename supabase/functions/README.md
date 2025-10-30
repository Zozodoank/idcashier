# Supabase Edge Functions

This directory contains all the Edge Functions for the idCashier application.

## Important Notes

1. **IDE Errors**: You may see TypeScript errors in your IDE for Edge Functions. This is expected because:
   - Edge Functions use Deno runtime, not Node.js
   - The IDE may not recognize Deno globals like `Deno.env`
   - ESM imports from CDNs may show as unresolved modules

2. **These errors do not affect functionality**: The Edge Functions will work correctly when deployed to Supabase.

## Development

To test Edge Functions locally:

1. Install Supabase CLI: `npm install -g supabase`
2. Start Supabase locally: `supabase start`
3. Deploy functions locally: `supabase functions deploy FUNCTION_NAME`

## Deployment

To deploy Edge Functions to Supabase:

```bash
# Deploy a single function
npx supabase functions deploy FUNCTION_NAME

# Deploy all functions
./deploy-functions.bat
```

## Structure

- `_shared/` - Shared utilities and constants
- `FUNCTION_NAME/` - Individual Edge Functions
- `import_map.json` - Module import mappings

## Environment Variables

Make sure the following environment variables are set in your Supabase project:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Function List

### Auth Functions
- `auth-login` - User authentication
- `auth-me` - Get current user profile
- `auth-register` - User registration
- `auth-request-password-reset` - Request password reset
- `auth-reset-password` - Reset password

### Products Functions
- `products-get-all` - Get all products
- `products-get-by-id` - Get product by ID
- `products-create` - Create new product
- `products-update` - Update existing product
- `products-delete` - Delete product

### Sales Functions
- `sales-get-all` - Get all sales