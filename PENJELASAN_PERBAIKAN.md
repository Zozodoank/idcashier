# Fix: Missing API Key Error (400 Bad Request)

## Problem
You're getting this error when accessing the expenses endpoint:
```
Failed to load resource: the server responded with a status of 400 ()
{"message":"No API key found in request","hint":"No `apikey` request header or url param was found."}
```

## Root Cause
The `VITE_SUPABASE_ANON_KEY` environment variable is either:
1. Not set in your `.env` file
2. Not properly loaded by Vite
3. The dev server wasn't restarted after changing the `.env` file

## Solution

### Step 1: Verify your `.env` file

Open your `.env` file and ensure it contains:

```env
VITE_SUPABASE_URL=https://eypfeiqtvfxxiimhtycc.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
VITE_SITE_URL=https://idcashier.my.id
```

**Important Notes:**
- The environment variable names MUST start with `VITE_` for Vite to expose them to the client
- Make sure there are NO spaces around the `=` sign
- Make sure there are NO quotes around the values (unless they're part of the actual value)
- The anon key should be a long JWT token (usually 200+ characters)

### Step 2: Get your Supabase Anon Key

If you don't have your anon key:

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc
2. Click on "Settings" (gear icon) in the left sidebar
3. Click on "API" under Project Settings
4. Copy the "anon" key (also called "anon public" key)
5. Paste it into your `.env` file as the value for `VITE_SUPABASE_ANON_KEY`

### Step 3: Restart the development server

After updating the `.env` file, you MUST restart the dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 4: Verify the fix

1. Open your browser console (F12)
2. Look for the "Environment Variables Check" section
3. You should see:
   ```
   === Environment Variables Check ===
   VITE_SUPABASE_URL: ✅ Set
   VITE_SUPABASE_ANON_KEY: ✅ Set (length: 200+)
   VITE_SITE_URL: ✅ Set
   =================================
   ```

4. If you see ❌ for any variable, the `.env` file is not properly configured

### Step 5: Test the expenses page

1. Navigate to the expenses page in your application
2. The expenses should load without the 400 error
3. Check the Network tab in browser DevTools to verify the requests include the `apikey` header

## Additional Debugging

If the problem persists after following all steps above:

### Check if .env file is being read

Create a test file `test-env.js` in your project root:

```javascript
import dotenv from 'dotenv';
dotenv.config();

console.log('Environment variables:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set');
```

Run it with:
```bash
node test-env.js
```

### Check browser console

Open the browser console and run:
```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Not set');
```

### Verify the API calls

In the browser console, check the Network tab:
1. Filter by "expenses"
2. Click on a failed request
3. Go to the "Headers" tab
4. Look for the "Request Headers" section
5. Verify that `apikey` header is present

If the `apikey` header is missing, the environment variable is not being loaded.

## Prevention

To prevent this issue in the future:

1. **Always restart the dev server** after changing `.env` files
2. **Never commit** `.env` files to git (they should be in `.gitignore`)
3. **Use `.env.example`** as a template for other developers
4. **Document** all required environment variables in your README

## Related Files

- `.env` - Your environment variables (not in git)
- `.env.example` - Template for environment variables
- `src/lib/api.js` - API functions that use the environment variables
- `src/lib/supabaseClient.js` - Supabase client initialization
- `vite.config.js` - Vite configuration (handles environment variables)

## Update (Fix Applied for Production Build)

Even with environment variables correctly set, the production build was still reporting "No API key found in request". This suggests the `apikey` header might be getting stripped or malformed in the production environment.

**Solution Applied:**
We modified `src/lib/api.js` to append the API key as a URL query parameter (`?apikey=...`) in addition to sending it in the headers. Supabase accepts the API key in either location, and the URL parameter is more robust against header filtering.

Changes applied to `expensesAPI` methods:
- `getAll`
- `create`
- `update`
- `delete`


The 400 error occurs because the Supabase API key is not being included in the HTTP requests. This is caused by missing or improperly loaded environment variables. The fix is to:

1. ✅ Verify `.env` file has correct values
2. ✅ Restart the dev server
3. ✅ Check browser console for environment variable status
4. ✅ Test the expenses page

After completing these steps, the expenses API should work correctly with the proper `apikey` header included in all requests.
