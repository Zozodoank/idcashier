# Fix Plan: `invokeFn` Mismatch causing "Invalid or missing plan_id"

## Issue Analysis
The user receives `{"error":"Invalid or missing plan_id"}` when attempting to pay for HPP.
We analyzed `src/lib/invokeFn.js` and `src/components/HPPSettings.jsx`.

### `src/lib/invokeFn.js` Definition
```javascript
export async function invokeFn(name, body, options = {}) {
  // ...
  // Check options.headers.Authorization
  // ...
  const fetchOptions = {
    method: options.method || (body ? 'POST' : 'GET'),
    headers: {
      // ...
      ...options.headers,
    },
  };
  
  if (token && !fetchOptions.headers.Authorization) {
    fetchOptions.headers.Authorization = `Bearer ${token}`;
  }
  // ...
}
```

### `src/components/HPPSettings.jsx` Usage
```javascript
const { invokeFn } = await import('@/lib/invokeFn');
const result = await invokeFn('renew-subscription-payment', requestBody, { token });
```

### The Bug
`HPPSettings.jsx` passes `{ token }` as the 3rd argument (`options`).
However, `invokeFn` **does not look for `token` directly in the root of the `options` object**.
It looks for:
1. `options.headers.Authorization`
2. If not found, it tries `supabase.auth.getSession()` (which might be slow or fail if `localStorage` was cleared weirdly).
3. It tries `localStorage.getItem('idcashier_token')`.

BUT, crucially, it **does not** extract `token` from `options.token`.

If `invokeFn` relies on `supabase.auth.getSession()` and that fails or returns a different/missing session, `token` might be null or invalid.

**Wait, if `token` is missing, `invokeFn` throws "Authentication token is missing."**.
The user reported a **500 error** from the backend: `{"error":"Invalid or missing plan_id"}`.
This implies the request **reached** the backend (so auth likely succeeded, or the backend is public?).
If the backend is `renew-subscription-payment`, it usually requires auth.

**Let's look at `invokeFn` again.**
If `body` is provided, method defaults to `POST`.
`HPPSettings.jsx` passes `requestBody`.
So `POST` is used.
`fetchOptions.body` becomes `JSON.stringify(body)`.

**Why would `plan_id` be missing?**
In `HPPSettings.jsx`:
```javascript
const requestBody = {
  plan_id: selectedPlan,
  // ...
};
```
If `selectedPlan` is `'3_months'`, `requestBody` is `{ plan_id: '3_months', ... }`.
`JSON.stringify` works fine.

**Is it possible the backend expects the body to be wrapped differently?**
No, standard JSON body.

**Alternative Theory: `invokeFn` imports**
In `HPPSettings.jsx`, it uses dynamic import:
```javascript
const { invokeFn } = await import('@/lib/invokeFn');
```
This is fine.

**What if `invokeFn` is NOT what we think it is?**
`HPPSettings.jsx` imports from `@/lib/invokeFn`.
`RenewalPage.jsx` imports from `../lib/invokeFn`.
They refer to the same file.

**Compare `RenewalPage.jsx` usage:**
```javascript
const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
const data = await invokeFn('renew-subscription-payment', requestBody, { 
  method: 'POST',
  headers
});
```
Here, `options` contains `headers`, which contains `Authorization`. `invokeFn` uses this:
```javascript
const authHeader = options.headers?.Authorization || options.headers?.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
  token = authHeader.substring(7);
}
```
This bypasses `getSession`.

**In `HPPSettings.jsx`:**
It passes `{ token }`. `invokeFn` ignores `options.token`.
It falls back to `supabase.auth.getSession()`.
If `getSession` works, `token` is retrieved.
Then:
```javascript
if (token && !fetchOptions.headers.Authorization) {
  fetchOptions.headers.Authorization = `Bearer ${token}`;
}
```
This sets the header.
So Auth should be fine.

**If Auth is fine, why `Invalid or missing plan_id`?**
This error comes from the **Backend**.
Possibilities:
1.  `plan_id` is indeed undefined in `requestBody`.
    *   `selectedPlan` state initialization? `const [selectedPlan, setSelectedPlan] = useState('3_months');`
    *   It seems correct.
2.  The backend logic for `hppActivation` path is buggy.
    *   If `hppActivation: true` is sent, maybe the backend looks for `plan_id` in a different place or ignores it?
3.  The request body is not being sent correctly.
    *   `invokeFn`: `if (body && (fetchOptions.method === 'POST' ...)) { fetchOptions.body = JSON.stringify(body); }`
    *   `HPPSettings` passes `requestBody`.
    *   `options.method` is undefined, defaults to `POST`.
    *   So body is sent.

**Wait! `RenewalPage` usage:**
```javascript
const requestBody = token
  ? { plan_id: planId, paymentMethod: paymentMethodCode }
  : { ... };
```

**`HPPSettings` usage:**
```javascript
const requestBody = {
  plan_id: selectedPlan,
  email: user.email,
  paymentMethod: paymentMethod, // We just fixed this to be undefined if 'ALL'
  hppActivation: true,
  returnUrl: ...
};
```

**Hypothesis: The Backend Logic**
If `hppActivation` is true, does the backend expect `plan_id`? Or does it expect something else?
The error `Invalid or missing plan_id` strongly suggests it *expects* `plan_id`.

**What if `token` passed to `invokeFn` in `HPPSettings` is NOT working as expected?**
If `invokeFn` falls back to `getSession`, and `getSession` hangs or returns null (due to previous issues), then `token` is null.
BUT `invokeFn` throws "Authentication token is missing" if token is missing.
The user got a 500 error from the server. So the request was sent.

**Is it possible `plan_id` is being sent as `undefined`?**
If `selectedPlan` is somehow undefined.
Initialized to `'3_months'`.
Unless the user deselected it? But it's a radio group (or custom div grid) that sets it.

**Let's standardize the call in `HPPSettings.jsx` to match `RenewalPage.jsx` logic.**
Pass `headers` explicitly with the token.
This avoids reliance on `invokeFn`'s internal `getSession` logic (which might be flaky or slow).

```javascript
// In HPPSettings.jsx
const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
const result = await invokeFn('renew-subscription-payment', requestBody, { 
    method: 'POST',
    headers
});
```

**Also, verify `paymentMethod` fix.**
We already applied the fix to set `paymentMethod` to `undefined` if 'ALL'.
Maybe 'ALL' was causing the backend to fail validation?
If the backend tries to validate `paymentMethod` and fails, it might throw a generic error or the error message is misleading?
But the error is specifically `Invalid or missing plan_id`.

**Maybe the backend validation fails if `paymentMethod` is 'ALL' and somehow that affects `plan_id` parsing?** Unlikely.

**Let's proceed with standardizing the `invokeFn` call.**
It's safer and consistent.

## Implementation Steps
1.  Modify `src/components/HPPSettings.jsx`:
    *   Construct `headers` with Authorization token manually.
    *   Pass `headers` and `method: 'POST'` to `invokeFn`.
    *   (We already applied the `paymentMethod` fix, keep that).

2.  Push to GitHub.

3.  Ask user to retry.

## Todo List
- [ ] Update `src/components/HPPSettings.jsx` to use standard `invokeFn` calling convention (headers).
- [ ] Push changes.