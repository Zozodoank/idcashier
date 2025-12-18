Write-Host "🚀 Memulai proses update aplikasi Android..." -ForegroundColor Cyan

# 1. Build Web App
Write-Host "📦 Building web app..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build gagal!" -ForegroundColor Red
    exit
}

# 2. Sync ke Android
Write-Host "🔄 Syncing ke Android project..." -ForegroundColor Yellow
npx cap sync android

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Sync gagal!" -ForegroundColor Red
    exit
}

Write-Host "✅ Selesai! Silakan buka Android Studio dan build APK/AAB." -ForegroundColor Green
Write-Host "   Path: ./android" -ForegroundColor Gray
