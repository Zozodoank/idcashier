# PowerShell Script to Remove Desktop.ini Files
# Jalankan sebagai Administrator untuk hasil terbaik

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hapus Desktop.ini Files Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cari semua file desktop.ini
Write-Host "[1/3] Mencari file desktop.ini..." -ForegroundColor Yellow
Write-Host ""

$desktopIniFiles = Get-ChildItem -Path "." -Recurse -Force -Filter "desktop.ini" -ErrorAction SilentlyContinue

if ($desktopIniFiles.Count -eq 0) {
    Write-Host "✅ Tidak ada file desktop.ini ditemukan!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Ditemukan $($desktopIniFiles.Count) file desktop.ini:" -ForegroundColor Yellow
    Write-Host ("-" * 50)
    $desktopIniFiles | ForEach-Object { Write-Host $_.FullName -ForegroundColor Gray }
    Write-Host ("-" * 50)
    Write-Host ""

    # 2. Hapus file desktop.ini
    Write-Host "[2/3] Menghapus file desktop.ini..." -ForegroundColor Yellow
    Write-Host ""
    
    $deletedCount = 0
    $failedCount = 0
    
    foreach ($file in $desktopIniFiles) {
        try {
            Remove-Item -Path $file.FullName -Force -ErrorAction Stop
            Write-Host "✅ Dihapus: $($file.FullName)" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "❌ Gagal: $($file.FullName) (mungkin sedang digunakan)" -ForegroundColor Red
            $failedCount++
        }
    }
    
    Write-Host ""
    Write-Host "Hasil: $deletedCount berhasil dihapus, $failedCount gagal" -ForegroundColor Cyan
    Write-Host ""
}

# 3. Cegah pembuatan desktop.ini baru
Write-Host "[3/3] Mencegah pembuatan desktop.ini di masa depan..." -ForegroundColor Yellow
Write-Host ""

try {
    # Cek apakah sudah ada pengaturan
    $existingSetting = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDesktopIni" -ErrorAction SilentlyContinue
    
    if ($existingSetting.NoDesktopIni -eq 1) {
        Write-Host "✅ Pengaturan sudah ada: NoDesktopIni = 1" -ForegroundColor Green
    } else {
        # Buat key jika belum ada
        if (-not (Test-Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer")) {
            New-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Force | Out-Null
        }
        
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDesktopIni" -Value 1 -Type DWord
        Write-Host "✅ Pengaturan registry diterapkan" -ForegroundColor Green
        Write-Host "   NoDesktopIni = 1 (DWORD)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "⚠️  Catatan Penting:" -ForegroundColor Yellow
    Write-Host "   - Untuk efek penuh, restart File Explorer atau log out/login kembali" -ForegroundColor Gray
    Write-Host "   - Atau jalankan sebagai Administrator untuk sistem-wide effect" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Gagal menerapkan pengaturan registry" -ForegroundColor Red
    Write-Host "   Jalankan PowerShell sebagai Administrator untuk hasil terbaik" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Selesai!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Tunggu user sebelum menutup
Read-Host "Tekan Enter untuk keluar"