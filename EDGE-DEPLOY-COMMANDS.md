# Quick Deploy Commands

## Deploy ALL Edge Functions (NO JWT + WITH JWT) - 63 Functions

```powershell
npx supabase functions deploy duitku-callback duitku-payment-request duitku-get-payment-methods auth-register auth-login auth-login-bypass auth-login-explicit auth-login-final auth-login-fixed auth-request-password-reset auth-reset-password auth-verify-email register-with-payment test-simple test-env-vars test-log test-body test-user-fetch test-renewal-simple check-debug-status developer-operations demo-reset --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-me store-setup create-renewal-payment renew-subscription-payment emergency-fix-sub products-create products-update products-delete products-get-all products-get-by-id categories-create categories-update categories-delete categories-get-all categories-get-by-id customers-create customers-update customers-delete customers-get-all customers-get-by-id suppliers-create suppliers-update suppliers-delete suppliers-get-all suppliers-get-by-id sales-delete sales-get-all sales-get-by-id users-create users-update users-delete users-get-all users-get-by-id subscriptions-create-update subscriptions-get-all-users subscriptions-get-current subscriptions-get-current-user subscriptions-update-user dashboard-recent-transactions dashboard-top-products attendance-ingest --project-ref eypfeiqtvfxxiimhtycc
```

---

## Notes

**Removed functions** (no index.ts file):
- `ensure-subscription` - Empty directory
- `products-cleanup-cronjob` - No index.ts
- `sales-create` - No index.ts

**Total**: 63 functions (21 public + 42 protected)

**Time**: ~7-10 minutes for all functions

---

## Usage

1. Copy command above (triple-click to select all)
2. Paste in PowerShell
3. Press Enter
4. Wait for completion
