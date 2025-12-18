# Perbaikan Flow Pembayaran Registrasi

## Masalah yang Diperbaiki

### 1. ❌ **Payment Method Selector Muncul 2 Kali**
**Penyebab:**
- Flow OAuth membuat user memilih payment method di RegisterPage
- Kemudian setelah OAuth callback, AuthCallbackPage menampilkan lagi payment method selector
- Ini menyebabkan user harus memilih payment method 2 kali

**Solusi:**
- GoogleOAuthButton menyimpan payment method yang dipilih ke URL parameter dan localStorage
- AuthCallbackPage langsung menggunakan payment method yang sudah dipilih
- Jika payment method tidak ada, redirect ke RegisterPage (bukan menampilkan selector lagi)

### 2. ❌ **Alert Berubah dari Sukses ke Gagal**
**Penyebab:**
- AuthCallbackPage menampilkan toast "Pembayaran Berhasil" sebelum user benar-benar membayar
- Kemudian redirect ke payment gateway
- Setelah payment selesai, di PaymentCallbackPage muncul alert yang berbeda
- Jika ada error di proses callback, alert berubah jadi gagal padahal pembayaran sudah sukses

**Solusi:**
- Menghilangkan toast "Pembayaran Berhasil" di AuthCallbackPage
- Redirect langsung ke payment gateway tanpa delay
- Alert sukses/gagal hanya muncul di PaymentCallbackPage setelah payment benar-benar selesai

### 3. ❌ **Pesan Error Tanpa Spasi**
**Penyebab:**
- Error message dari API/backend tidak memiliki spasi antara kata
- Contoh: "PaymentProcessingFailed" bukan "Payment Processing Failed"

**Solusi:**
- Menambahkan regex untuk menambahkan spasi antara camelCase
- Format: `errorMessage.replace(/([a-z])([A-Z])/g, '$1 $2')`

### 4. ❌ **User Aktif dengan Trial Setelah Pilih Price Card**
**Penyebab:**
- Jika payment method tidak tersedia atau payment gagal, AuthCallbackPage memberikan fallback ke dashboard
- Ini membuat user terdaftar dengan 7 hari trial padahal seharusnya tidak dapat trial

**Solusi:**
- Jika payment method tidak tersedia → redirect ke RegisterPage dengan plan details
- Jika payment gagal → redirect ke RegisterPage dengan plan details
- Jika plan details tidak lengkap → redirect ke landing page
- User TIDAK PERNAH mendapat akses tanpa bayar jika dari price card

## Flow Yang Benar Sekarang

### A. Email/Password Registration dengan Price Card
1. User klik price card di LandingPage
2. Redirect ke `/register?plan=X&price=Y&duration=Z`
3. User isi form dan klik "Register and Pay"
4. **PaymentMethodSelector muncul** (sekali)
5. User pilih payment method
6. `processRegistration(methodCode)` dipanggil
7. User diregister (tanpa trial)
8. Request dibuat ke duitku-payment-request
9. Redirect **langsung** ke payment gateway
10. User bayar di Duitku
11. Callback ke PaymentCallbackPage
12. Jika sukses → Login otomatis → Navigate ke store-setup
13. Jika gagal → Navigate ke /login?payment_failed=1

### B. Google OAuth Registration dengan Price Card
1. User klik price card di LandingPage
2. Redirect ke `/register?plan=X&price=Y&duration=Z`
3. User klik "Sign Up with Google"
4. **PaymentMethodSelector muncul** (sekali)
5. User pilih payment method
6. Plan details + payment method disimpan ke localStorage dan URL params
7. OAuth flow dimulai, redirect ke Google
8. Google redirect kembali ke `/auth/callback?plan=X&price=Y&duration=Z&paymentMethod=ABC`
9. AuthCallbackPage:
   - Cek session dari OAuth
   - Register user (tanpa trial)
   - **TIDAK menampilkan payment selector lagi**
   - Ambil payment method dari URL params
   - Request ke duitku-payment-request dengan payment method
   - Redirect **langsung** ke payment gateway tanpa toast
10. User bayar di Duitku
11. Callback ke PaymentCallbackPage
12. Jika sukses → Login otomatis (password null karena OAuth) → Navigate ke store-setup
13. Jika gagal → Navigate ke /login?payment_failed=1

### C. Error Handling
#### Jika Payment Method Tidak Tersedia (OAuth)
- Toast: "Metode Pembayaran Diperlukan"
- Redirect to: `/register?plan=X&price=Y&duration=Z`
- User diminta memilih payment method lagi

#### Jika Plan Details Tidak Lengkap (OAuth)
- Toast: "Data Paket Tidak Lengkap"
- Redirect to: `/` (landing page)
- User harus pilih price card lagi

#### Jika Payment Request Gagal
- Toast: "Gagal Memproses Pembayaran"
- Redirect to: `/register?plan=X&price=Y&duration=Z`
- User bisa coba lagi dengan payment method yang sama

## Files yang Diubah

1. **AuthCallbackPage.jsx**
   - Line 60-70: Hapus setStatus('success') dan toast, redirect langsung
   - Line 73-82: Redirect ke register dengan plan params, bukan dashboard
   - Line 318-365: Handle missing payment method dengan redirect ke register

2. **PaymentCallbackPage.jsx**
   - Line 262-281: Format error message dengan spasi yang benar

## Testing Checklist

- [ ] Email registration dengan price card → pilih payment method sekali → redirect ke payment gateway
- [ ] Google OAuth registration dengan price card → pilih payment method sekali → redirect ke payment gateway
- [ ] Payment berhasil → alert "Pembayaran berhasil" di PaymentCallbackPage → redirect ke store-setup
- [ ] Payment gagal → alert "Pembayaran gagal" di PaymentCallbackPage → redirect ke login/register
- [ ] OAuth tanpa payment method → alert "Metode Pembayaran Diperlukan" → redirect ke register
- [ ] Error message memiliki spasi yang benar
- [ ] User TIDAK mendapat trial jika mendaftar via price card
