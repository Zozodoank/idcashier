# Payment Callback Fix Summary

## Issue
Users were experiencing a 401 Unauthorized error during the payment callback process, specifically when the system attempted to register the user via `auth-register` Edge Function.

**Error Log:**
```
eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-register:1 Failed to load resource: the server responded with a status of 401 ()
index-DtExobNz.js:503 Payment callback error: Error: Missing authorization header
```

## Diagnosis
The `src/pages/PaymentCallbackPage.jsx` file was making a direct `fetch` call to the `auth-register` Edge Function without including the required `Authorization` header. Even though the function might be public, the Supabase Gateway (Kong) enforces the presence of a valid JWT (Anon Key or User Token) by default.

## Fix Applied
Updated `src/pages/PaymentCallbackPage.jsx` to include the `Authorization` header with the Supabase Anon Key in the `fetch` request.

```javascript
// Before
const registerRes = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // ...
});

// After
const registerRes = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-register', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
  },
  // ...
});
```

## Verification
- Checked `src/lib/mcpRegisterClient.js` and confirmed it already includes the header correctly.
- Checked `src/lib/api.js` and confirmed it uses `supabase.functions.invoke` or `fetch` with headers correctly.
- Confirmed `VITE_SUPABASE_ANON_KEY` is present in the environment configuration.

## Next Steps
- Deploy the updated frontend code.
- Test the registration flow with payment to verify the fix.
