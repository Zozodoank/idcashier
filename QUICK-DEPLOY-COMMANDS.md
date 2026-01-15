# Quick Deploy Commands - Copy & Paste

## 🚀 Deploy Payment Functions (Paling Sering Digunakan)

```powershell
npx supabase functions deploy duitku-callback --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy duitku-payment-request --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy duitku-get-payment-methods --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

---

## 📦 Deploy ALL Public Functions (NO JWT) - 21 Functions

```powershell
npx supabase functions deploy duitku-callback --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy duitku-payment-request --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy duitku-get-payment-methods --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-register --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-login --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-request-password-reset --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-reset-password --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-verify-email --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

---

## 🔒 Deploy Protected Functions (WITH JWT)

### Products (5)
```powershell
npx supabase functions deploy products-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Categories (5)
```powershell
npx supabase functions deploy categories-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy categories-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy categories-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy categories-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy categories-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Customers (5)
```powershell
npx supabase functions deploy customers-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy customers-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy customers-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy customers-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy customers-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Suppliers (5)
```powershell
npx supabase functions deploy suppliers-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy suppliers-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy suppliers-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy suppliers-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy suppliers-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Sales (3)
```powershell
npx supabase functions deploy sales-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy sales-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy sales-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Users (5)
```powershell
npx supabase functions deploy users-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy users-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy users-delete --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy users-get-all --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy users-get-by-id --project-ref eypfeiqtvfxxiimhtycc
```

### Subscriptions (5)
```powershell
npx supabase functions deploy subscriptions-create-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy subscriptions-get-all-users --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy subscriptions-get-current --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy subscriptions-get-current-user --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy subscriptions-update-user --project-ref eypfeiqtvfxxiimhtycc
```

### Dashboard (3)
```powershell
npx supabase functions deploy dashboard-stats --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy dashboard-recent-transactions --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy dashboard-top-products --project-ref eypfeiqtvfxxiimhtycc
```

### Store & Auth (3)
```powershell
npx supabase functions deploy auth-me --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy store-setup --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy attendance-ingest --project-ref eypfeiqtvfxxiimhtycc
```

### Payment Management (3)
```powershell
npx supabase functions deploy create-renewal-payment --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy renew-subscription-payment --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy register-with-payment --project-ref eypfeiqtvfxxiimhtycc
```

---

## 🎯 Single Function Deploy (Template)

### NO JWT (Public)
```powershell
npx supabase functions deploy FUNCTION-NAME --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

### WITH JWT (Protected)
```powershell
npx supabase functions deploy FUNCTION-NAME --project-ref eypfeiqtvfxxiimhtycc
```

**Replace `FUNCTION-NAME` dengan nama function**

---

## ⚡ Super Quick Deploy (Most Common)

### Deploy Payment Callback Only (30 detik)
```powershell
npx supabase functions deploy duitku-callback --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

### Deploy Auth Functions (1 menit)
```powershell
npx supabase functions deploy auth-register --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt; npx supabase functions deploy auth-login --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

### Deploy Products Functions (1 menit)
```powershell
npx supabase functions deploy products-create --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-update --project-ref eypfeiqtvfxxiimhtycc; npx supabase functions deploy products-get-all --project-ref eypfeiqtvfxxiimhtycc
```

---

## 💡 Usage

1. Buka PowerShell di direktori project ini
2. Copy command yang diinginkan
3. Paste di PowerShell (klik kanan)
4. Press Enter

**Semicolon (;)** memisahkan multiple commands agar berjalan berurutan.

---

**Project**: IDCashier  
**Project Ref**: eypfeiqtvfxxiimhtycc  
**Last Updated**: 2026-01-15
