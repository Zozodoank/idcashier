# Panduan Verifikasi Homepage Aplikasi di Google

Jika Google meminta "Verify your existing app homepage", artinya Google butuh konfirmasi bahwa anda benar-benar pemilik domain `idcashier.com`. Proses ini dilakukan melalui **Google Search Console**.

Berikut adalah langkah-langkah untuk memverifikasi domain Anda:

## Langkah 1: Buka Google Search Console
1. Kunjungi [Google Search Console](https://search.google.com/search-console).
2. Login menggunakan akun Google yang **sama** dengan yang Anda gunakan untuk Google Cloud Console (Project OAuth Anda).

## Langkah 2: Tambahkan Properti (Domain)
1. Klik menu *dropdown* properti di kiri atas, lalu pilih **+ Add property**.
2. Anda akan melihat dua pilihan: **Domain** dan **URL prefix**.
   
   **Pilihan A: Domain (Disarankan)**
   *   Mewakup seluruh subdomain (www, auth, dll).
   *   Memerlukan akses ke DNS Provider (tempat Anda beli domain).
   
   **Pilihan B: URL prefix (Lebih Mudah jika hanya punya akses file)**
   *   Hanya untuk URL spesifik (misal `https://idcashier.com`).
   *   Bisa verifikasi pakai upload file HTML.

## Langkah 3: Metode Verifikasi

### Metode A: DNS Record (Paling Stabil)
1. Pilih tipe properti **Domain** dan masukkan `idcashier.com`.
2. Google akan memberikan **TXT record** (contoh: `google-site-verification=...`).
3. Buka dashboard penyedia domain Anda (Niagahoster, GoDaddy, Namecheap, dll).
4. Cari menu **DNS Management**.
5. Tambahkan record baru:
    *   **Type**: TXT
    *   **Host/Name**: `@` (atau kosong)
    *   **Value/Target**: (Paste kode dari Google)
6. Simpan, tunggu beberapa menit, lalu klik **Verify** di Google Search Console.

### Metode B: HTML File Upload (Jika metode DNS sulit)
1. Pilih tipe properti **URL prefix** dan masukkan `https://idcashier.com`.
2. Pilih metode **HTML file**.
3. Download file yang diberikan (biasanya bernama `googleXXXXX.html`).
4. Letakkan file tersebut di folder `public` di project Anda (`c:\Users\LENOVO\Documents\POS\idcashier\public`).
5. **Deploy ulang** website Anda agar file tersebut bisa diakses di `https://idcashier.com/googleXXXXX.html`.
6. Kembali ke Search Console dan klik **Verify**.

## Langkah 4: Kembali ke Google Cloud Console
1. Setelah domain terverifikasi "Ownership verified".
2. Kembali ke halaman [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Domain verification**.
3. Klik **Add Domain**.
4. Masukkan `idcashier.com`.
5. Karena akun Google-nya sama, domain akan langsung terverifikasi.
6. Sekarang Anda bisa melanjutkan proses pengisian "Application home page" di OAuth Consent Screen tanpa error.
