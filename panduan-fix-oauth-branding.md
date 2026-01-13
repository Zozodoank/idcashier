# Panduan Mengamankan Branding Google OAuth

Untuk menyamarkan URL project Supabase dan menggunakan domain sendiri (`idcashier.com`) pada tampilan login Google, Anda perlu melakukan konfigurasi di **Google Cloud Console** dan **Supabase Dashboard**.

## 1. Konfigurasi Google Cloud Console (Wajib)

Langkah ini akan mengubah tampilan "Continue to eypfeiqtvfxxiimhtycc.supabase.co" menjadi "Continue to idCashier" lengkap dengan logo Anda.

1.  Buka [Google Cloud Console](https://console.cloud.google.com/).
2.  Pilih project yang terhubung dengan OAuth login Anda.
3.  Masuk ke menu **APIs & Services** > **OAuth Consent Screen**.
4.  Klik **Edit App**.
5.  Isi informasi berikut:
    *   **App name**: `idCashier` (atau nama brand yang diinginkan).
    *   **User support email**: Pilih email support Anda.
    *   **App logo**: Upload logo idCashier (file persegi, max 1MB).
    *   **Application home page**: `https://idcashier.com`
    *   **Application privacy policy link**: `https://idcashier.com/privacy-policy` (pastikan halaman ini ada).
    *   **Application terms of service link**: `https://idcashier.com/terms` (pastikan halaman ini ada).
    *   **Authorized domains**: Tambahkan `idcashier.com`. Hapus domain lain yang tidak perlu.
6.  Klik **Save and Continue**.

*Catatan: Jika status aplikasi masih "Testing", logo dan nama mungkin tidak muncul untuk semua orang. Anda perlu melakukan "Publish App" untuk membuatnya live (Production).*

## 2. Menggunakan Custom Domain untuk URL Redirect (Opsional tapi Sangat Disarankan)

Secara default, saat user login, mereka akan melihat URL di browser melompat ke `https://eypfeiqtvfxxiimhtycc.supabase.co/...`. Untuk mengubah ini menjadi `https://auth.idcashier.com/...` atau sejenisnya, Anda perlu fitur **Custom Domain** di Supabase.

*Catatan: Fitur ini berbayar (Add-on) di Supabase.*

1.  Buka **Supabase Dashboard** > **Settings** > **Custom Domains**.
2.  Ikuti petunjuk untuk menambahkan domain (misal: `idcashier.com` atau `auth.idcashier.com`).
3.  Anda perlu mengonfigurasi DNS (CNAME/TXT records) di penyedia domain Anda.
4.  Setelah terverifikasi, update konfigurasi Google OAuth:
    *   Kembali ke **Google Cloud Console** > **APIs & Services** > **Credentials**.
    *   Edit **OAuth 2.0 Client ID** Anda.
    *   Pada **Authorized redirect URIs**, tambahkan URI baru menggunakan domain Anda:
        *   Lama: `https://eypfeiqtvfxxiimhtycc.supabase.co/auth/v1/callback`
        *   Baru: `https://idcashier.com/auth/v1/callback` (sesuaikan dengan domain yang didaftarkan).
5.  Update kode aplikasi (`.env`):
    *   Ubah `VITE_SUPABASE_URL` menjadi URL custom domain Anda (jika didukung penuh) atau pastikan auth redirect menggunakan URL baru.

## 3. Verifikasi Aplikasi oleh Google (Untuk Menghilangkan Peringatan Keamanan)

Jika saat login user melihat layar merah/peringatan "This app isn't verified", itu karena Anda menggunakan scope sensitif atau belum diverifikasi.

1.  Di **OAuth Consent Screen**, submit aplikasi untuk **Verification**.
2.  Google akan meminta bukti kepemilikan domain (via Google Search Console).
3.  Google akan mereview logo dan nama aplikasi Anda.

---

**Ringkasan untuk Keamanan:**
1.  **Ganti App Name & Logo** di Google Cloud Console (Paling penting agar terlihat profesional).
2.  **Authorized Domains** harus hanya berisi `idcashier.com` dan `supabase.co`.
3.  Gunakan **Custom Domain** di Supabase jika ingin URL `supabase.co` benar-benar hilang dari address bar saat redirect.
