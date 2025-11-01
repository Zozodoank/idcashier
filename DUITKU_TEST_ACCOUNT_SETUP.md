# 📧 Setup Test Account untuk Duitku

## ✅ Yang Sudah Dilakukan

1. ✅ **Migration SQL diterapkan**: `setup_testing_expired_user`
   - Membersihkan user lama `testing@tes.com`
   - Membuat record di `public.users` untuk `testing@idcashier.my.id` (jika auth user ada)
   - Membuat subscription expired (7 hari yang lalu)

## 📋 Langkah yang Perlu Dilakukan

### Step 1: Buat User di Supabase Auth

User **harus dibuat di Supabase Auth terlebih dahulu** karena tidak bisa dibuat langsung via SQL.

#### Option A: Via Supabase Dashboard (RECOMMENDED)

1. Buka https://supabase.com/dashboard
2. Pilih project: `eypfeiqtvfxxiimhtycc`
3. Klik **Authentication** → **Users**
4. Klik **Add user** (atau **Invite user**)
5. Isi form:
   - **Email**: `testing@idcashier.my.id`
   - **Password**: `Tesajakalobisa`
   - ✅ **Auto Confirm User** (check box ini)
6. Klik **Create user**

#### Option B: Via Supabase CLI

```powershell
# Login ke Supabase jika belum
npx supabase login

# Gunakan admin API untuk create user (via script)
# File: create-testing-expired-user.js
node create-testing-expired-user.js
```

**Note**: Jika ada masalah network, gunakan Option A (Dashboard).

### Step 2: Verifikasi Setup

Setelah user dibuat di auth, migration akan otomatis:
- ✅ Membuat record di `public.users`
- ✅ Membuat subscription expired (7 hari yang lalu)

**Verify via SQL:**
```sql
-- Check user
SELECT * FROM users WHERE email = 'testing@idcashier.my.id';

-- Check subscription
SELECT * FROM subscriptions 
WHERE user_id = (SELECT id FROM users WHERE email = 'testing@idcashier.my.id');
```

### Step 3: Test Login

1. Buka aplikasi
2. Login dengan:
   - **Email**: `testing@idcashier.my.id`
   - **Password**: `Tesajakalobisa`
3. Harus muncul **warning subscription expired** atau redirect ke renewal page

### Step 4: Kirim Credentials ke Duitku

Email yang perlu dikirim ke pihak Duitku:

```
Subject: Test Account untuk Testing Subscription Warning

Kepada Tim Duitku,

Berikut adalah test account untuk testing fitur subscription warning di dashboard:

Email: testing@idcashier.my.id
Password: Tesajakalobisa

Purpose: 
- Testing subscription warning di dashboard setelah 7 hari penggunaan
- Account ini memiliki subscription yang sudah expired 7 hari yang lalu
- Digunakan untuk memverifikasi bahwa warning subscription muncul dengan benar

Catatan:
- Account ini khusus untuk testing
- Subscription expired: [7 hari yang lalu dari tanggal setup]
- Warning subscription harus muncul di dashboard setelah login

Terima kasih.
```

## 📊 Detail Subscription

- **Start Date**: 37 hari yang lalu
- **End Date**: 7 hari yang lalu (EXPIRED)
- **Status**: Expired (untuk testing)

## 🔍 Troubleshooting

### User tidak bisa login
- **Check**: Apakah user sudah dibuat di `auth.users`?
  ```sql
  SELECT * FROM auth.users WHERE email = 'testing@idcashier.my.id';
  ```
- **Fix**: Buat user via Dashboard (Step 1)

### Subscription tidak muncul
- **Check**: Apakah subscription sudah dibuat?
  ```sql
  SELECT * FROM subscriptions 
  WHERE user_id = (SELECT id FROM users WHERE email = 'testing@idcashier.my.id');
  ```
- **Fix**: Jalankan migration lagi atau create manual:
  ```sql
  INSERT INTO subscriptions (user_id, start_date, end_date, created_at, updated_at)
  SELECT 
    id,
    (CURRENT_DATE - INTERVAL '37 days')::date,
    (CURRENT_DATE - INTERVAL '7 days')::date,
    NOW(),
    NOW()
  FROM users WHERE email = 'testing@idcashier.my.id';
  ```

### Warning tidak muncul di dashboard
- **Check**: Pastikan edge function `auth-login` sudah di-deploy dengan subscription check
- **Check**: Pastikan frontend menampilkan warning berdasarkan subscription status
- **Fix**: Deploy edge function jika belum:
  ```powershell
  npx supabase functions deploy auth-login --no-verify-jwt
  ```

## ✅ Checklist

- [ ] User dibuat di Supabase Auth (`testing@idcashier.my.id`)
- [ ] User ada di `public.users`
- [ ] Subscription expired sudah dibuat (7 hari yang lalu)
- [ ] Login berhasil dengan credentials
- [ ] Warning subscription muncul di dashboard
- [ ] Credentials dikirim ke pihak Duitku

---

**Status**: Migration sudah diterapkan. Tinggal buat user di Auth via Dashboard.

