# Google OAuth Setup Guide

## Error yang Terjadi
```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

Error ini terjadi karena Google OAuth provider belum diaktifkan di Supabase Dashboard.

## Solusi: Aktifkan Google OAuth di Supabase Dashboard

### Langkah 1: Buka Supabase Dashboard
1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda: `eypfeiqtvfxxiimhtycc`

### Langkah 2: Aktifkan Google OAuth Provider
1. Pergi ke **Authentication** > **Providers**
2. Cari **Google** di daftar providers
3. Klik **Enable** atau toggle untuk mengaktifkan Google provider

### Langkah 3: Konfigurasi Google OAuth
Masukkan credentials berikut:

**Client ID (for OAuth):**
```
15568084977-64m1fli3fdf2m4tgtjs5b1u2ev97g1nn.apps.googleusercontent.com
```

**Client Secret (for OAuth):**
```
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
```

### Langkah 4: Set Environment Variable
1. Pergi ke **Settings** > **Secrets** (atau **Edge Functions** > **Secrets**)
2. Tambahkan secret berikut:
   - **Name:** `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
   - **Value:** `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`

### Langkah 5: Konfigurasi Redirect URLs
Pastikan redirect URLs berikut sudah dikonfigurasi:

**Di Supabase Dashboard:**
1. Pergi ke **Authentication** > **URL Configuration**
2. Tambahkan redirect URLs berikut:
   - `https://idcashier.com/auth/callback`
   - `http://localhost:3000/auth/callback` (untuk development)

**Di Google Cloud Console:**
1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Pilih project Anda
3. Pergi ke **APIs & Services** > **Credentials**
4. Edit OAuth 2.0 Client ID Anda
5. Tambahkan **Authorized redirect URIs**:
   - `https://eypfeiqtvfxxiimhtycc.supabase.co/auth/v1/callback`
   - `https://idcashier.com/auth/callback`

### Langkah 6: Verifikasi Konfigurasi
Setelah konfigurasi selesai, coba login dengan Google OAuth lagi. Error seharusnya sudah hilang.

## Catatan Penting

1. **Local Development:**
   - Konfigurasi di `supabase/config.toml` hanya untuk local development
   - Untuk production, harus dikonfigurasi di Supabase Dashboard

2. **Environment Variables:**
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` harus di-set di Supabase Dashboard > Secrets
   - Jangan hardcode secret di code

3. **Redirect URLs:**
   - Harus dikonfigurasi di kedua tempat: Supabase Dashboard dan Google Cloud Console
   - Pastikan URL exact match (termasuk protocol http/https)

## Troubleshooting

Jika masih error setelah konfigurasi:
1. Pastikan Google provider sudah di-enable di Supabase Dashboard
2. Pastikan Client ID dan Secret sudah benar
3. Pastikan redirect URLs sudah dikonfigurasi dengan benar
4. Coba restart Supabase project atau tunggu beberapa menit untuk propagasi

