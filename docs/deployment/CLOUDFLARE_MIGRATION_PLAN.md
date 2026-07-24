# Rencana Migrasi `idcashier` ke Cloudflare Free Tier

## Ringkasan

Project ini bisa dipindahkan ke Cloudflare Free Tier untuk:

- hosting frontend statis hasil build Vite
- DNS dan custom domain
- SSL dan edge caching

Project ini tidak disarankan dipindahkan full stack ke Cloudflare pada tahap awal, karena backend aplikasi saat ini bergantung kuat pada Supabase untuk:

- database
- authentication
- Edge Functions
- payment callback Duitku
- email dan OAuth redirect flow

Rekomendasi paling aman untuk aplikasi yang sudah dipakai user adalah:

- frontend pindah ke Cloudflare Pages
- domain dan DNS pindah ke Cloudflare
- Supabase tetap dipakai sebagai backend

## Kondisi Project Saat Ini

Berdasarkan struktur repo saat ini:

- frontend menggunakan Vite dan menghasilkan output ke folder `dist`
- routing aplikasi memakai React Router dengan `BrowserRouter`
- hosting lama mengandalkan `.htaccess` untuk fallback SPA
- frontend melakukan request langsung ke Supabase dan Supabase Edge Functions
- alur login, register, reset password, Google OAuth, dashboard, CRUD utama, attendance, dan pembayaran Duitku masih terhubung ke Supabase

Konsekuensinya:

- Cloudflare Pages cocok untuk frontend
- `.htaccess` tidak akan berlaku di Cloudflare, jadi fallback routing SPA harus diganti ke mekanisme Cloudflare Pages
- backend tidak perlu dipindahkan jika target hanya migrasi hosting dan domain

## Arsitektur Target Yang Disarankan

Arsitektur target yang direkomendasikan:

- Cloudflare Pages Free untuk frontend
- Cloudflare DNS untuk `idcashier.com`
- Supabase tetap untuk database, auth, Edge Functions, dan callback payment

Arsitektur ini menjaga perubahan tetap minimal pada sistem yang sudah aktif di production.

## Yang Perlu Dilakukan

### 1. Siapkan Deployment Frontend di Cloudflare Pages

- buat project Cloudflare Pages baru
- hubungkan repository atau gunakan direct upload
- gunakan build command:

```bash
npm run build
```

- gunakan output directory:

```text
dist
```

### 2. Tambahkan Environment Variables di Cloudflare Pages

Minimal env frontend yang perlu diisi:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`

Jika domain produksi tetap `idcashier.com`, maka nilai `VITE_SITE_URL` sebaiknya tetap mengarah ke domain itu.

### 3. Ganti Mekanisme Routing SPA

Karena Cloudflare tidak memakai `.htaccess`, maka route seperti berikut harus tetap bisa dibuka langsung:

- `/login`
- `/register`
- `/reset-password`
- `/auth/callback`
- `/payment-callback`
- `/dashboard/*`

Saat implementasi, fallback route perlu dipindahkan ke aturan Cloudflare Pages, biasanya melalui file `_redirects` atau konfigurasi routing lain yang setara.

### 4. Buat Staging Dulu

Sebelum domain utama dipindah:

- deploy frontend ke subdomain staging atau `*.pages.dev`
- test semua alur utama dari staging
- pastikan request dari domain staging diizinkan oleh backend Supabase jika ada pembatasan origin

### 5. Sinkronkan Konfigurasi Supabase

Kalau frontend production dipindahkan, konfigurasi berikut harus dicek di Supabase:

- `site_url`
- additional redirect URLs
- Google OAuth redirect URL
- `SITE_URL`
- `FRONTEND_URL`
- `RETURN_URL`
- `CALLBACK_URL`

Catatan penting:

- `CALLBACK_URL` Duitku bisa tetap mengarah ke Supabase Function seperti sekarang
- yang biasanya berubah adalah `RETURN_URL` ke frontend dan daftar redirect URL auth

### 6. Cek CORS dan Origin Allowlist

Beberapa fungsi dan helper backend terlihat memakai domain yang spesifik. Saat migrasi, pastikan origin baru diizinkan, terutama jika:

- frontend sempat diuji di subdomain staging
- domain utama berubah
- ada helper CORS yang masih hardcoded ke domain lama

Jika domain utama tetap `idcashier.com`, kebutuhan perubahan biasanya jauh lebih kecil.

### 7. Pindahkan Domain ke Cloudflare

Untuk domain apex seperti `idcashier.com`:

- tambahkan zone domain ke Cloudflare
- arahkan nameserver registrar ke nameserver Cloudflare
- setelah zone aktif, hubungkan domain ke project Pages
- verifikasi sertifikat SSL aktif

Jika hanya ingin subdomain, CNAME biasanya cukup. Tetapi untuk apex domain, nameserver Cloudflare umumnya perlu dipakai.

### 8. Siapkan Rollback

Karena project ini sudah dipakai user, rollback plan wajib ada:

- turunkan TTL DNS sebelum cutover
- jangan matikan hosting lama sebelum verifikasi selesai
- simpan konfigurasi DNS lama
- siapkan rollback nameserver atau DNS jika login, payment, atau callback bermasalah

## Yang Tidak Disarankan Pada Tahap Pertama

Jangan lakukan ini dulu kecuali memang ingin proyek migrasi besar:

- memindahkan semua Supabase Edge Functions ke Cloudflare Workers/Pages Functions
- memindahkan database ke D1
- memindahkan auth dari Supabase Auth ke sistem lain
- memindahkan callback pembayaran ke worker baru tanpa kebutuhan jelas

Alasannya:

- biaya implementasi lebih besar
- risiko gangguan ke user aktif lebih tinggi
- perlu rewrite signifikan untuk auth, payment, email flow, dan data access

## Checklist Pengujian Sebelum Go Live

Sebelum domain utama benar-benar dialihkan, pastikan semua ini lulus:

- homepage terbuka normal
- login email/password berhasil
- register user baru berhasil
- reset password berjalan
- Google OAuth callback berhasil
- halaman dashboard bisa di-refresh langsung
- route `/auth/callback` dan `/payment-callback` tidak 404
- CRUD utama tetap jalan
- dashboard dan report tetap mengambil data dengan benar
- payment Duitku tetap bisa:
  - membuat payment
  - kembali ke frontend
  - memproses callback ke backend
  - mengubah status subscription
- logout dan session refresh tetap normal
- cache asset tidak membuat user mendapat bundle lama

## Kesimpulan

Jawaban singkatnya:

- ya, project ini bisa dipindahkan ke Cloudflare Free Tier untuk frontend dan domain
- tidak disarankan memindahkan seluruh backend ke Cloudflare Free Tier untuk tahap awal

Strategi migrasi paling aman adalah:

1. pindahkan frontend ke Cloudflare Pages
2. pindahkan DNS/domain ke Cloudflare
3. pertahankan Supabase sebagai backend
4. uji staging
5. lakukan cutover bertahap dengan rollback plan

Dengan pendekatan ini, migrasi tetap hemat, perubahan minimal, dan risiko ke user production jauh lebih rendah.
