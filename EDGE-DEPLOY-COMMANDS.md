# Quick Deploy Commands

## Deploy ALL Edge Functions (PUBLIC no-jwt + PROTECTED jwt) - 63 Functions

```powershell
npx supabase functions deploy duitku-callback register-with-payment test-env-vars --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy duitku-payment-request duitku-get-payment-methods auth-register auth-login auth-login-bypass auth-login-explicit auth-login-final auth-login-fixed auth-request-password-reset auth-reset-password auth-verify-email auth-me store-setup create-renewal-payment renew-subscription-payment emergency-fix-sub products-create products-update products-delete products-get-all products-get-by-id categories-create categories-update categories-delete categories-get-all categories-get-by-id customers-create customers-update customers-delete customers-get-all customers-get-by-id suppliers-create suppliers-update suppliers-delete suppliers-get-all suppliers-get-by-id sales-delete sales-get-all sales-get-by-id users-create users-update users-delete users-get-all users-get-by-id subscriptions-create-update subscriptions-get-all-users subscriptions-get-current subscriptions-get-current-user subscriptions-update-user dashboard-recent-transactions dashboard-top-products attendance-ingest --project-ref eypfeiqtvfxxiimhtycc
```

---

## Notes

### ⚠️ Yang salah/berisiko dari command versi lama

1) `--no-verify-jwt` **memaksa semua function yang ada di batch itu menjadi public** (tidak butuh JWT), walaupun di code tidak ada marker `@supabase/verify-jwt false`.

Pada versi lama, batch `--no-verify-jwt` memasukkan:
- `duitku-payment-request` (seharusnya endpoint user login)
- `duitku-get-payment-methods` (opsional; biasanya cukup user login)
- `auth-*` (jelas tidak boleh dibuat public)

Itu berbahaya di production karena orang random bisa memanggil endpoint tersebut tanpa token.

2) Separator `;` di PowerShell **tidak menghentikan eksekusi** jika deploy pertama gagal. Kalau Anda ingin “stop on error”, gunakan:

```powershell
npx supabase functions deploy ... --no-verify-jwt --project-ref eypfeiqtvfxxiimhtycc; if ($LASTEXITCODE -ne 0) { throw 'Deploy public functions failed' }
npx supabase functions deploy ... --project-ref eypfeiqtvfxxiimhtycc; if ($LASTEXITCODE -ne 0) { throw 'Deploy protected functions failed' }
```

### Catatan penting tentang verify_jwt di code
- Jika sebuah function memiliki marker `// @supabase/verify-jwt false` (misalnya saat ini `create-renewal-payment`), maka **meskipun Anda deploy tanpa `--no-verify-jwt`**, function itu tetap public.
- Jadi untuk mengubahnya menjadi protected, harus **ubah marker di file** lalu redeploy.

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
