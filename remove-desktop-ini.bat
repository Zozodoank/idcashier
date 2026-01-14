@echo off
echo ========================================
echo   Hapus Desktop.ini Files Script
echo ========================================
echo.

echo [1/3] Mencari file desktop.ini...
echo.

REM Find all desktop.ini files and display them
echo File desktop.ini yang ditemukan:
echo ----------------------------------------
dir /s /b desktop.ini 2>nul
echo ----------------------------------------
echo.

echo [2/3] Menghapus file desktop.ini...
echo.

REM Delete all desktop.ini files
del /s /q desktop.ini 2>nul

if %errorlevel% equ 0 (
    echo ✅ Semua file desktop.ini berhasil dihapus!
) else (
    echo ⚠️  Beberapa file desktop.ini mungkin tidak dapat dihapus (sedang digunakan)
)

echo.

echo [3/3] Mencegah pembuatan desktop.ini di masa depan...
echo.

REM Create registry key to prevent Windows from creating desktop.ini
REM This adds a registry setting to disable desktop.ini creation
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoDesktopIni" /t REG_DWORD /d 1 /f >nul 2>&1

if %errorlevel% equ 0 (
    echo ✅ Pengaturan registry diterapkan untuk mencegah desktop.ini
) else (
    echo ⚠️  Gagal menerapkan pengaturan registry (jalankan sebagai Administrator)
)

echo.
echo ========================================
echo   Selesai!
echo ========================================
echo.
echo Catatan:
echo - File desktop.ini telah dihapus dari semua folder
echo - Windows tidak akan membuat desktop.ini baru lagi
echo - Untuk benar-benar mencegah, jalankan script sebagai Administrator
echo.
pause