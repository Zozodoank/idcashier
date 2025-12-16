# Fix Plan V3: The Ultimate Logout Loop Fix

## Diagnosis
The user still reports "logout masih hank" (logout still hangs) despite previous fixes.
This implies a **Deep Loop** where the browser is continuously reloading or redirecting between `/login` and `/dashboard` (or another protected route) at a speed that freezes the browser ("RESULT_CODE_HUNG").

### The Mechanics of the Loop
1.  **Logout Clicked**: `DashboardLayout` clears storage and navigates to `/login`.
2.  **LoginPage Loads**:
    *   It checks `isAuthenticated`.
    *   **CRITICAL FAILURE POINT**: If `AuthContext` still reports `isAuthenticated = true` (perhaps due to async state updates not completing, or `localStorage` being restored by a rogue `useEffect`), `LoginPage` redirects BACK to `/dashboard`.
3.  **Dashboard Loads**:
    *   It checks `isAuthenticated` via `AuthGuard`.
    *   If `AuthGuard` detects NO token (because storage *was* partially cleared), it redirects BACK to `/login`.
4.  **Repeat**: This cycle happens fast enough to hang the browser.

### Why Previous Fixes Failed
*   **Fix 1**: Prevented `supabaseClient` from redirecting if already on `/login`. *Good, but didn't stop the Dashboard <-> Login ping-pong.*
*   **Fix 2**: Added delays in `LoginPage` and used `location.replace`. *Helped, but if `isAuthenticated` is stubbornly true on the login page, it still redirects.*

### Root Cause Suspects
1.  **AuthContext State Persistence**: `useAuth` state (`user` object) might not be clearing fast enough or is being re-hydrated.
2.  **Race Condition**: `AuthContext` initializes, finds no token, sets user to null. BUT `LoginPage` might render *before* this initialization completes, seeing stale state or `loading=true`?
3.  **Supabase Client**: `supabase.auth.getSession()` might be returning a session even after `signOut` if the network request hangs or fails, or if it auto-refreshes from a cookie (unlikely but possible).

## The Radical Solution
We need to **physically break** the React application state during logout.

### Step 1: `DashboardLayout.jsx` - The "Nuclear" Logout
Instead of relying on React Router navigation or gentle state updates, we will:
1.  Clear ALL storage (Local Storage, Session Storage, Cookies if accessible).
2.  Force a **Browser Hard Reload** to the login page.
    *   `window.location.href = '/login?logout=true'`
    *   This forces the entire React app to unmount and reload from scratch. Any lingering state in memory (`useState`, `Context`) is destroyed.

### Step 2: `AuthContext.jsx` - Prevent Zombie Resurrection
1.  Ensure `initializeAuth` strictly checks for token presence before declaring a user authenticated.
2.  If `logout=true` query param is present, **force clear everything** before doing anything else.

### Step 3: `LoginPage.jsx` - The Gatekeeper
1.  If `logout=true` is in the URL, **IGNORE** `isAuthenticated` state for the first render cycles.
2.  Force the user to stay on the login page.

## Action Plan
1.  **Modify `src/components/DashboardLayout.jsx`**:
    *   Logout function will strictly:
        *   Clear `localStorage`.
        *   Clear `sessionStorage`.
        *   `window.location.href = '/login?logout=true&t=' + Date.now()` (Cache buster).

2.  **Modify `src/contexts/AuthContext.jsx`**:
    *   Add check for `logout=true` in initialization logic. If found, skip session recovery and ensure state is clean.

3.  **Modify `src/pages/LoginPage.jsx`**:
    *   If `logout=true` query param exists, **never** auto-redirect to dashboard, even if `isAuthenticated` is true.
    *   This stops the loop dead.

## Files to Edit
*   `src/components/DashboardLayout.jsx`
*   `src/contexts/AuthContext.jsx`
*   `src/pages/LoginPage.jsx`
