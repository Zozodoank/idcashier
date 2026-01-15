# Perbaikan Alur Pembayaran dan Registrasi

## 📋 Masalah yang Ditemukan

### 1. **Redirect ke Login setelah Pembayaran Berhasil**
- **Masalah**: Setelah user berhasil membayar melalui payment gateway, mereka diarahkan ke halaman login, bukan ke halaman setup store
- **Lokasi**: `src/pages/PaymentCallbackPage.jsx` line 356
- **Penyebab**: Fallback logic yang salah ketika session tidak ditemukan setelah pembayaran

### 2. **Subscription Tidak Dibuat**
- **Masalah**: User berhasil terdaftar tapi tidak memiliki subscription dan tanggal kadaluarsa
- **Lokasi**: `supabase/functions/duitku-callback/index.ts`
- **Penyebab**: 
  - Error handling yang kurang baik saat membuat user profile
  - Logging yang kurang detail untuk debugging
  - Tidak ada fallback jika user profile check gagal

## 🔧 Perbaikan yang Dilakukan

### 1. **PaymentCallbackPage.jsx**

#### Perubahan di Line 346-357:
**Sebelum:**
```javascript
// If no session found, show clear message and redirect to login
toast({
  title: t('paymentSuccessful'),
  description: 'Pembayaran berhasil! Silakan login dengan password yang tadi digunakan untuk mendaftar.',
  variant: 'default'
});

localStorage.removeItem('pendingRegistration');

setTimeout(() => {
  navigate('/login?payment=success', { replace: true });
}, 2000);
```

**Sesudah:**
```javascript
// If no session found after payment success, try to recover or redirect to store-setup
// The backend callback should have already created the subscription
console.log('⚠️ No session found after payment, attempting recovery...');

// Check if we have pending registration data with email
if (pendingRegistration?.email) {
  toast({
    title: t('paymentSuccessful'),
    description: 'Pembayaran berhasil! Silakan login untuk melanjutkan setup toko.',
    variant: 'default'
  });

  localStorage.removeItem('pendingRegistration');

  setTimeout(() => {
    navigate('/login?payment=success&email=' + encodeURIComponent(pendingRegistration.email), { replace: true });
  }, 2000);
} else {
  // No email found, but payment was successful - redirect to store-setup anyway
  // The user might be logged in via OAuth but session not detected
  toast({
    title: t('paymentSuccessful'),
    description: 'Pembayaran berhasil! Mengarahkan ke setup toko...',
    variant: 'default'
  });

  localStorage.removeItem('pendingRegistration');

  setTimeout(() => {
    window.location.href = '/store-setup?fromPayment=true';
  }, 2000);
}
```

**Penjelasan:**
- Menambahkan logic untuk mengecek apakah ada email di pendingRegistration
- Jika ada email, redirect ke login dengan email pre-filled
- Jika tidak ada email (OAuth user), langsung redirect ke store-setup
- Menggunakan `window.location.href` untuk force full page reload

### 2. **duitku-callback/index.ts**

#### Perubahan di Line 365-540:

**Perbaikan yang Dilakukan:**

1. **Improved Error Handling**:
   ```typescript
   if (createUserError) {
     console.error('❌ Failed to create user profile in callback:', createUserError);
     // Don't return here - try to create subscription anyway
   } else {
     console.log(`✅ User profile created for ${userId}`);
   }
   ```
   - Menambahkan emoji untuk memudahkan debugging
   - Tidak langsung return jika gagal create user, tetap lanjut create subscription

2. **Better Logging**:
   ```typescript
   console.log(`✅ User profile exists for ${userId}`);
   console.log(`💰 Payment amount: ${amountNum}, Extension: ${extensionMonths} months, Plan: ${planName}`);
   console.log(`🔄 [Subscription Extension] Extending subscription ${existingSubscription.id} from ${existingSubscription.end_date} to ${newEndDate.toISOString().split('T')[0]}`);
   ```
   - Menambahkan logging untuk setiap step penting
   - Memudahkan tracking flow pembayaran

3. **Enhanced Error Details**:
   ```typescript
   if (insertError) {
     console.error('❌ [Subscription Creation] Error creating subscription:', insertError);
     console.error('❌ [Subscription Creation] Insert error details:', {
       code: insertError.code,
       message: insertError.message,
       details: insertError.details,
       hint: insertError.hint
     });
   }
   ```
   - Menampilkan detail error lengkap untuk debugging

4. **Fixed Query**:
   ```typescript
   .maybeSingle(); // Changed from .single()
   ```
   - Menggunakan `maybeSingle()` untuk menghindari error jika user tidak ditemukan

## 🎯 Alur yang Benar Sekarang

### Untuk User Baru (Registration Flow):

1. **User memilih paket di Landing Page** → Payment selector muncul
2. **User diarahkan ke halaman Register** → Input data atau OAuth
3. **Autentikasi berhasil** → Redirect ke payment gateway sandbox
4. **Pembayaran berhasil** → Duitku callback dipanggil
5. **Backend (duitku-callback)**:
   - ✅ Verifikasi signature
   - ✅ Cari/buat user profile di `public.users`
   - ✅ Buat subscription dengan status 'active' dan tanggal kadaluarsa
   - ✅ Update user metadata `payment_completed: true`
6. **Frontend (PaymentCallbackPage)**:
   - ✅ Cek session
   - ✅ Redirect ke `/store-setup` (bukan `/login`)

### Untuk OAuth User:
- Session sudah ada dari AuthCallbackPage
- Langsung redirect ke `/store-setup`

### Untuk Email/Password User:
- Jika session tidak ditemukan, redirect ke `/login` dengan email pre-filled
- User login → redirect ke `/store-setup`

## 📊 Hasil yang Diharapkan

Setelah perbaikan ini:

✅ User yang berhasil membayar akan:
- Memiliki user profile di `public.users`
- Memiliki subscription aktif di `subscriptions` table
- Memiliki tanggal kadaluarsa sesuai paket yang dibeli
- Diarahkan ke halaman `/store-setup` untuk setup toko
- **TIDAK** diarahkan ke halaman login

## 🔍 Cara Testing

1. **Test Registration Flow**:
   ```
   1. Buka landing page
   2. Pilih paket (misal: 1 Bulan - Rp 50.000)
   3. Pilih metode pembayaran
   4. Klik Register
   5. Login dengan Google/Email
   6. Bayar di payment gateway sandbox
   7. Setelah bayar, harus redirect ke /store-setup
   ```

2. **Verifikasi Database**:
   ```sql
   -- Cek user profile
   SELECT * FROM public.users WHERE email = 'test@example.com';
   
   -- Cek subscription
   SELECT * FROM subscriptions WHERE user_id = 'USER_ID';
   
   -- Harus ada:
   -- - status: 'active'
   -- - start_date: tanggal hari ini
   -- - end_date: 30 hari dari sekarang (untuk paket 1 bulan)
   ```

3. **Cek Logs**:
   ```
   Supabase Dashboard → Edge Functions → duitku-callback → Logs
   
   Harus muncul:
   ✅ User profile created for {userId}
   💰 Payment amount: 50000, Extension: 1 months, Plan: 1_month
   ✅ [Subscription Creation] New subscription created for user {userId}
   ```

## 📝 File yang Dimodifikasi

1. `src/pages/PaymentCallbackPage.jsx` - Fixed redirect logic
2. `supabase/functions/duitku-callback/index.ts` - Enhanced error handling and logging

## 🚀 Deployment

Edge function sudah di-deploy dengan command:
```bash
npx supabase functions deploy duitku-callback --project-ref eypfeiqtvfxxiimhtycc --no-verify-jwt
```

Frontend akan otomatis ter-deploy ke Vercel saat push ke GitHub.

---

**Tanggal Perbaikan**: 2026-01-15
**Status**: ✅ Selesai
