# 🚨 IMMEDIATE FIX REQUIRED - Auth Login Broken

## ❌ Problem Identified

Edge function `auth-login-final` version 32 has **WRONG CONFIGURATION**:
```
verify_jwt: true  ← WRONG! This requires authorization header
```

This is why you're getting:
```
401 - Missing authorization header
```

Login endpoints should be PUBLIC (no JWT verification needed).

---

## ✅ SOLUTION - Manual Fix via Supabase Dashboard

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select project: `eypfeiqtvfxxiimhtycc`
3. Click "Edge Functions" in sidebar

### Step 2: Fix auth-login-final
1. Click on `auth-login-final` function
2. Click "Settings" or "Edit Function"
3. Look for "JWT Verification" setting
4. **DISABLE JWT Verification** (set to false/off)
5. Save changes

### Step 3: Redeploy with Correct Code
1. In the function editor, paste this COMPLETE code:

```typescript
/// <reference path="../deno-stubs.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { headers: corsHeaders, status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const isWhitelistAccount = normalizedEmail === 'demo@idcashier.my.id' || normalizedEmail === 'jho.j80@gmail.com';
    
    // Background auto-confirm for whitelist (non-blocking)
    if (isWhitelistAccount) {
      supabaseAdmin.from('users').select('id').eq('email', normalizedEmail).maybeSingle()
        .then(async ({ data: publicUser }) => {
          if (publicUser?.id) {
            const { data: authUserResult } = await supabaseAdmin.auth.admin.getUserById(publicUser.id);
            if (authUserResult?.user && !authUserResult.user.email_confirmed_at) {
              await supabaseAdmin.auth.admin.updateUserById(publicUser.id, {
                email_confirm: true,
                user_metadata: { ...authUserResult.user.user_metadata, email_verified: true }
              });
            }
          }
        }).catch(e => console.error('Auto-confirm error:', e));
    }

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: normalizedEmail,
      password: password
    })

    if (authError) {
      let errorMessage = 'Invalid email or password'
      
      if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
        errorMessage = isWhitelistAccount 
          ? 'Email not confirmed. Please try again in 10 seconds.'
          : 'Please confirm your email before logging in.'
      } else if (authError.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: authError.message }),
        { headers: corsHeaders, status: 401 }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { headers: corsHeaders, status: 401 }
      )
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, tenant_id, permissions, created_at')
      .eq('email', normalizedEmail)
      .single()

    if (userError) {
      if (userError.code === 'PGRST116') {
        const { data: newUserData, error: insertError } = await supabaseAdmin
          .from('users')
          .insert([{
            id: authData.user.id,
            name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'User',
            email: normalizedEmail,
            role: authData.user.user_metadata?.role || 'owner',
            tenant_id: authData.user.id,
            permissions: null
          }])
          .select('id, name, email, role, tenant_id, permissions, created_at')
          .single()

        if (insertError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user profile' }),
            { headers: corsHeaders, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({
            user: { ...newUserData, tenantId: newUserData.tenant_id },
            token: authData.session.access_token,
            session: {
              access_token: authData.session.access_token,
              refresh_token: authData.session.refresh_token,
              expires_at: authData.session.expires_at,
              expires_in: authData.session.expires_in
            },
            message: 'Login successful'
          }),
          { headers: corsHeaders, status: 200 }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { headers: corsHeaders, status: 500 }
      )
    }

    // Subscription check (skip for whitelist accounts)
    if (normalizedEmail === 'testing@idcashier.my.id') {
      return new Response(
        JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir.', subscriptionExpired: true }),
        { headers: corsHeaders, status: 403 }
      );
    } else if (!isWhitelistAccount) {
      const effectiveUserId = userData.role === 'cashier' ? userData.tenant_id : userData.id;
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('end_date')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subscription) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const endDate = new Date(subscription.end_date); endDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() + 1);
        if (today >= endDate) {
          return new Response(
            JSON.stringify({ error: 'Subscription expired', message: 'Langganan Anda telah berakhir.', subscriptionExpired: true }),
            { headers: corsHeaders, status: 403 }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        user: { ...userData, tenantId: userData.tenant_id },
        token: authData.session.access_token,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in
        },
        message: 'Login successful'
      }),
      { headers: corsHeaders, status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: corsHeaders, status: 500 }
    )
  }
})
```

2. **IMPORTANT:** Make sure "JWT Verification" is DISABLED/OFF
3. Click "Deploy"
4. Wait for deployment to complete

### Step 4: Verify
1. Check logs show version 33 (or new version)
2. Test login at https://idcashier.my.id
3. Should work without 401 error

---

## 🔄 Alternative: Use Working Function

If you can't fix `auth-login-final`, use one of the working alternatives:

### Option A: Use auth-login-bypass
This function already has `verify_jwt: false` and should work.

Update frontend to use:
```javascript
const functionsUrl = `${supabaseUrl}/functions/v1/auth-login-bypass`;
```

### Option B: Use auth-login-explicit  
Also has `verify_jwt: false`.

Update frontend to use:
```javascript
const functionsUrl = `${supabaseUrl}/functions/v1/auth-login-explicit`;
```

---

## 📝 What Went Wrong

Version 32 was deployed with:
- `verify_jwt: true` ← This requires Authorization header
- Incomplete/corrupt code

This means the function expects a JWT token in the request, but login requests don't have tokens yet (that's what they're trying to get!).

---

## ✅ Quick Test After Fix

Open browser console and try login:
```
Expected: "Login successful"
NOT: "Missing authorization header"
```

---

## 🚀 After Login Works

1. Deploy new frontend build (dist/) to hosting
2. Test complete flow
3. Verify data loads on Dashboard/Reports/Developer pages

---

## 📞 If Still Having Issues

Check these:
1. Edge function logs for errors
2. Browser console for network errors
3. Verify JWT verification is OFF
4. Try using alternative functions (auth-login-bypass)
