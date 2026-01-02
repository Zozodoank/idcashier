# Cara Menjalankan npm run dev

## Masalah PowerShell Execution Policy

Jika Anda mendapatkan error:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

## Solusi

### Opsi 1: Gunakan File Batch (Paling Mudah)
Jalankan file `run-dev.bat` yang sudah dibuat:
```bash
.\run-dev.bat
```

### Opsi 2: Gunakan PowerShell Script
Jalankan file `run-dev.ps1`:
```powershell
.\run-dev.ps1
```

### Opsi 3: Gunakan Command Prompt (cmd)
Buka Command Prompt (bukan PowerShell) dan jalankan:
```bash
npm run dev
```

### Opsi 4: Bypass Execution Policy untuk Satu Command
Di PowerShell, jalankan:
```powershell
powershell -ExecutionPolicy Bypass -Command "npm run dev"
```

### Opsi 5: Ubah Execution Policy Permanen (Hanya untuk Current User)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Kemudian jalankan `npm run dev` seperti biasa.

## Membersihkan Port yang Terpakai

Jika port 3000 sudah digunakan, Anda bisa:

1. **Cek proses yang menggunakan port:**
```powershell
netstat -ano | findstr :3000
```

2. **Hentikan proses (ganti PID dengan nomor dari langkah 1):**
```powershell
taskkill /PID <PID> /F
```

3. **Atau gunakan port lain dengan mengubah package.json:**
```json
"dev": "vite --host :: --port 3007"
```

