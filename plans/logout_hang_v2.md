# Fix Plan V2: Logout Hang & Unresponsiveness

## Status
The initial fix prevented infinite redirects in `supabaseClient.js`, but the user reports the issue persists. This suggests the loop might be happening elsewhere or the condition `window.location.pathname !== '/login'` is not sufficient (e.g., query params causing reloads, or component re-rendering loops).

## Potential Root Causes
1.  **AuthGuard Loop**: `AuthGuard` might be redirecting to `/login` with a query param (e.g., `?redirect=...`), and `LoginPage` might be redirecting back or reloading.
2.  **LoginPage Loop**: `LoginPage` checks `isAuthenticated`. If state is inconsistent (AuthContext says authenticated, but Supabase says not), it might flip-flop.
3.  **AuthContext State**: If `user` is not cleared synchronously but `logout` finishes, `AuthGuard` might still think user is logged in.
4.  **Race Condition**: `logout` clears storage, but `AuthGuard` or `supabaseClient` tries to restore session immediately.

## Investigation Plan
1.  **Review `src/components/AuthGuard.jsx`**:
    *   Does it redirect to `/login`?
    *   Does it use `replace: true`?
    *   What triggers it?

2.  **Review `src/pages/LoginPage.jsx`**:
    *   Does it redirect to `/dashboard` if `isAuthenticated` is true?
    *   If `AuthGuard` redirects to `/login` but `AuthContext` still has `user`, `LoginPage` will redirect back to `/dashboard`, creating a loop: Dashboard -> Logout -> Login -> Dashboard -> ...

3.  **Refine `logout` in `DashboardLayout.jsx`**:
    *   Ensure we *really* wait for `AuthContext` to update its state to `null` before navigating.

## Fix Strategy
1.  **Force Hard Reload on Logout**: instead of `navigate('/login')`, usage of `window.location.href = '/login'` is actually safer for clearing state, *provided* we don't loop.
2.  **Prevent Auto-Redirect on Login Page**: Add a delay or check if the redirect is coming from a logout action.
3.  **Fix AuthGuard**: Ensure it doesn't fight with `LoginPage`.

## Specific Actions
1.  **Modify `LoginPage.jsx`**:
    *   Add a check for `login_redirect` to prevent instant redirection loops.
    *   Or better, ensure `isAuthenticated` is strictly false after logout.

2.  **Modify `AuthContext.jsx`**:
    *   Ensure `logout` updates state synchronously/immediately before async Supabase calls if possible, or ensures `user` is null.

3.  **Modify `DashboardLayout.jsx`**:
    *   Use `window.location.replace('/login')` to replace history, preventing back-button loops.

## Let's examine `AuthGuard.jsx` and `LoginPage.jsx` again.