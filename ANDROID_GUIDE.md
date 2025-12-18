# Panduan Pembuatan Aplikasi Android (idCashier)

Project ini telah dikonfigurasi menggunakan **Capacitor** untuk mengubah web app menjadi aplikasi Android native yang siap diupload ke Play Store.

Folder project Android native berada di: `./android/`

## Prasyarat

Pastikan Anda telah menginstall:
1. **Android Studio** (terbaru)
2. **Java JDK** (biasanya sudah include di Android Studio)

## Langkah-Langkah Build APK / Bundle (AAB)

### 1. Buka Project di Android Studio
1. Buka **Android Studio**.
2. Pilih **File > Open**.
3. Arahkan ke folder `c:\Users\SEMOGA-AWET\Documents\POS\idcashier\android` dan klik **OK**.
4. Tunggu hingga proses *Gradle Sync* selesai (ini mungkin memakan waktu beberapa menit saat pertama kali membuka).

### 2. Mengganti Icon & Splash Screen
Secara default, aplikasi menggunakan icon Capacitor. Untuk menggantinya:
1. Siapkan icon logo Anda (format PNG, disarankan ukuran 1024x1024 px).
2. Anda bisa menggunakan tool seperti **Android Asset Studio** atau klik kanan pada folder `app > res` di Android Studio -> **New > Image Asset**.
3. Ganti `ic_launcher` dengan logo Anda.

### 3. Konfigurasi Signing (PENTING untuk Play Store)
Untuk upload ke Play Store, aplikasi harus "ditandatangani" (signed).
1. Di menu Android Studio, pilih **Build > Generate Signed Bundle / APK**.
2. Pilih **Android App Bundle** (disarankan untuk Play Store) atau **APK** (untuk test install manual), lalu klik **Next**.
3. Di bagian **Key store path**, klik **Create new...** jika belum punya kunci.
   - Simpan file `.jks` di tempat aman (JANGAN SAMPAI HILANG!).
   - Isi password dan detail lainnya.
4. Isi alias dan password key yang baru dibuat.
5. Klik **Next**.
6. Pilih build variant **release**.
7. Klik **Create** / **Finish**.

### 4. Lokasi File Output
Setelah proses selesai, file `.aab` (Bundle) atau `.apk` akan berada di:
- `android/app/release/app-release.aab`

File inilah yang Anda upload ke **Google Play Console**.

## Update Aplikasi
Jika Anda melakukan perubahan pada kode web (React/Vite):
1. Jalankan perintah ini di terminal VSCode:
   ```bash
   npm run build
   npx cap sync android
   ```
2. Buka Android Studio dan jalankan build ulang atau Run ke device/emulator.

## Troubleshooting
- Jika terjadi error build, coba menu **File > Invalidate Caches / Restart**.
- Pastikan Android SDK yang dibutuhkan sudah terinstall (biasanya Android Studio akan menawarkan install otomatis jika kurang).
