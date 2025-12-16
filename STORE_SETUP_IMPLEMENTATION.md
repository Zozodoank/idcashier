# Store Setup Page Implementation

## Overview
Created a new `StoreSetupPage` to be displayed after successful subscription payment. This page allows users to fill in essential store information which is then saved to `localStorage` (mirroring the existing `SettingsPage` behavior) and redirects them to the dashboard.

## Changes Made

1.  **Created `src/pages/StoreSetupPage.jsx`**:
    -   Implements a form with fields: Store Name, Owner Name, Address, NPWP, Phone, Bank Account, and Logo.
    -   Saves data to `localStorage` key `idcashier_store_settings_${user.id}`.
    -   Redirects to `/dashboard` upon successful save.

2.  **Updated `src/App.jsx`**:
    -   Added route `/store-setup` protected by `ProtectedRoute`.

3.  **Updated `src/pages/PaymentCallbackPage.jsx`**:
    -   Changed redirect after successful registration/payment from `/dashboard/settings?tab=store` to `/store-setup`.

## Verification
-   Ran `npm run build` to ensure no build errors.

## Next Steps
-   Redeploy frontend to make these changes live.
