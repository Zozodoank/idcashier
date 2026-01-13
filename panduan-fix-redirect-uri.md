# Panduan Memperbaiki Masalah "Redirect URI Mismatch"

Anda mengalami error setelah mengubah **Authorized Redirect URI** di Google Cloud Console menjadi `https://idcashier.com/auth/callback`.

## Penyebab Error
Secara teknis, **Google tidak boleh** diarahkan langsung ke aplikasi Anda (`idcashier.com`). Alurnya harus melalui server Supabase terlebih dahulu untuk menukar token keamanan.

Arsitektur yang benar adalah:
1.  **Aplikasi Anda** meminta login ke **Supabase**.
2.  **Supabase** mengarahkan user ke **Google**.
3.  **Google** mengembalikan user ke **Supabase** (Disini terjadi verifikasi data).
4.  **Supabase** akhirnya mengembalikan user ke **Aplikasi Anda**.

Jika Anda memotong langkah 3 (langsung dari Google ke Aplikasi), proses login akan gagal karena aplikasi Anda tidak memiliki kemampuan server Supabase untuk memverifikasi "code" dari Google.

## Solusi: Kembalikan Konfigurasi yang Benar

Ikuti langkah ini agar login Google kembali berfungsi normal:

### 1. Perbaiki Google Cloud Console (WAJIB)
1.  Buka [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
2.  Edit **OAuth 2.0 Client ID** Anda.
3.  Pada bagian **Authorized redirect URIs**, ganti `https://idcashier.com/auth/callback` menjadi:
    ```
    https://eypfeiqtvfxxiimhtycc.supabase.co/auth/v1/callback
    ```
    *(Link ini adalah alamat server Auth Supabase project Anda)*.
4.  Klik **Save**.

### 2. Pastikan Konfigurasi Supabase Benar
1.  Buka **Supabase Dashboard** > **Authentication** > **URL Configuration**.
2.  Pastikan **Site URL** adalah: `https://idcashier.com`.
3.  Pastikan di daftar **Redirect URLs** terdapat: `https://idcashier.com/auth/callback`.
    *(Supabase perlu tahu bahwa setelah selesai memproses data dari Google, user boleh dilempar ke halaman ini)*.

### 3. Masalah Branding (Pesan "supabase.co")
Saya mengerti Anda ingin menghilangkan pesan "Login ke supabase.co". Mengganti Redirect URI di Google secara paksa bukanlah caranya dan malah merusak sistem.

Cara yang benar dan aman untuk branding adalah:
1.  **Verifikasi Domain di Google**: Pastikan di **OAuth Consent Screen** Google Cloud, Anda sudah menambahkan `idcashier.com` di **Authorized Domains** dan mengisi link Privacy Policy ke `https://idcashier.com/privacy`.
2.  **Custom Domain (Opsional)**: Jika Anda benar-benar ingin menghilangkan total URL `supabase.co` dari browser address bar saat login, Anda harus membeli fitur **Custom Domain** di Supabase ($10/bln) dan mengatur subdomain seperti `auth.idcashier.com`.

**Kesimpulan:**
Mohon kembalikan settingan Google Console ke `https://eypfeiqtvfxxiimhtycc.supabase.co/auth/v1/callback` agar sistem berjalan kembali. Branding diperbaiki melalui verifikasi domain, bukan dengan mengubah alur teknis redirect.
