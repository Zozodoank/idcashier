# Fix Plan: Logout Hang and Unresponsiveness

## Issue Analysis
The user reports "RESULT_CODE_HUNG" and browser unresponsiveness after logging out and returning to the login page. This indicates a tight infinite loop, likely caused by:
1.  **Repeated Page Reloads**: `window.location.href = '/login'` being triggered repeatedly.
2.  **Repeated State Updates**: React `useEffect` loop.

### Findings
1.  **`src/lib/supabaseClient.js`**:
    *   Listens for `TOKEN_REFRESH_FAILED`.
    *   Executes `window.location.href = '/login'` immediately.
    *   **Risk**: If the token is invalid but present (or Supabase attempts to recover it on load) and fails validation immediately, this triggers a reload loop if the user is already on `/login`.

2.  **`src/components/DashboardLayout.jsx`**:
    *   Logout logic forces `window.location.href = '/login'` without awaiting `logout()`.
    *   Manually clears `localStorage` keys, including a hardcoded Supabase key `sb-eypfeiqtvfxxiimhtycc-auth-token`.
    *   **Risk**: If the manual clear fails or races with Supabase client initialization on the next page load, the client might try to use a stale/invalid token, fail refresh, and trigger the loop above.

3.  **`src/contexts/AuthContext.jsx`**:
    *   `initializeAuth` runs on mount.
    *   Calls `supabase.auth.getSession()`.
    *   If `DashboardLayout` didn't clear storage effectively, `getSession` might try to use the persisted token.

## Implementation Steps

### Step 1: Prevent Redirect Loop in `supabaseClient.js`
Modify the `onAuthStateChange` listener to check the current URL before forcing a reload.

```javascript
case 'TOKEN_REFRESH_FAILED':
  console.log('Token refresh failed');
  clearStaleSession();
  // Only redirect if not already on login page
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  break;
```

### Step 2: Improve Logout Logic in `DashboardLayout.jsx`
Make the logout process more robust:
1.  Await `logout()` from AuthContext.
2.  Use `navigate` instead of `window.location.href` where possible, or ensure clean state before reload.
3.  Ensure the hardcoded Supabase key matches the actual project or use `supabase.auth.signOut()` as the primary mechanism.

### Step 3: Verify `AuthContext.jsx`
Ensure `onAuthStateChange` doesn't trigger loops when `SIGNED_OUT` event is received.

### Step 4: Verify `LoginPage.jsx`
Ensure `isAuthenticated` check doesn't flip-flop.

## Todo List
- [ ] Update `src/lib/supabaseClient.js` to prevent redirect loop on `TOKEN_REFRESH_FAILED`.
- [ ] Update `src/components/DashboardLayout.jsx` to improve logout reliability.
- [ ] Verify `src/contexts/AuthContext.jsx` handles `SIGNED_OUT` gracefully.