# 🔐 Reset Password Guide - testing@tes.com

## Masalah Login

Jika Anda mendapatkan error **"Invalid email or password"** saat login dengan `testing@tes.com`, kemungkinan password yang digunakan salah.

## Solusi 1: Reset Password via Supabase Dashboard (RECOMMENDED)

1. Buka **Supabase Dashboard**: https://supabase.com/dashboard
2. Pilih project Anda: `eypfeiqtvfxxiimhtycc`
3. Klik **Authentication** di sidebar kiri
4. Klik **Users** tab
5. Cari user dengan email: `testing@tes.com`
6. Klik **⋮** (three dots) di sebelah user
7. Pilih **Reset Password** atau **Send Password Reset Email**
8. Check email untuk link reset password

## Solusi 2: Reset Password via Edge Function (Developer Only)

Jika Anda memiliki akses developer (email: `jho.j80@gmail.com`), gunakan `developer-operations` edge function:

```javascript
// Call developer-operations edge function
const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/developer-operations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer YOUR_DEVELOPER_TOKEN`
  },
  body: JSON.stringify({
    operation: 'reset_password',
    email: 'testing@tes.com',
    newPassword: '@Testing123'
  })
});
```

## Solusi 3: Reset Password via SQL (Advanced)

**PENTING**: Password di Supabase Auth di-encrypt, jadi tidak bisa direset langsung via SQL. Gunakan salah satu metode di atas.

Namun, Anda bisa memastikan user ada di `public.users`:

```sql
-- Check if user exists in public.users
SELECT * FROM users WHERE email = 'testing@tes.com';

-- If not exists, create it
INSERT INTO users (id, email, name, role, tenant_id, created_at, updated_at)
SELECT 
  id,
  email,
  'Testing User' as name,
  'owner' as role,
  id as tenant_id,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'testing@tes.com'
ON CONFLICT (id) DO NOTHING;
```

## Solusi 4: Create New User (If all else fails)

Jika user tidak bisa di-reset, buat user baru:

1. Register akun baru melalui aplikasi
2. Atau gunakan Supabase Dashboard → Authentication → Users → **Add user**

## Status User Saat Ini

✅ **User ada di `auth.users`**: Ya (ID: `98dc3f00-c319-482f-9b2f-d3e915703c69`)
✅ **Email confirmed**: Ya
✅ **User ada di `public.users`**: Ya (sudah dibuat via migration)
❓ **Password**: Perlu di-reset jika lupa

## Password Default (Jika Di-reset)

Password default yang direkomendasikan untuk testing:
- `@Testing123` (atau password yang Anda inginkan)

## Troubleshooting

### Error: "Invalid email or password"
- **Penyebab**: Password salah atau user tidak ada
- **Solusi**: Reset password menggunakan salah satu metode di atas

### Error: "User not found"
- **Penyebab**: User tidak ada di `auth.users`
- **Solusi**: Buat user baru via registration atau dashboard

### Error: "Email not confirmed"
- **Penyebab**: Email belum dikonfirmasi
- **Solusi**: Check email untuk link konfirmasi, atau gunakan admin untuk confirm

## Quick Test

Setelah reset password, test login dengan:

```javascript
// Via frontend
email: 'testing@tes.com'
password: '<password_yang_direset>'
```

---

**Catatan**: Jika masalah persist, check Supabase Edge Function logs untuk detail error yang lebih spesifik.

