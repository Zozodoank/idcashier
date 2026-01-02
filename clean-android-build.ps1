Write-Host "🧹 Membersihkan semua folder build Android..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  PASTIKAN ANDROID STUDIO SUDAH DITUTUP!" -ForegroundColor Yellow
Write-Host ""
Read-Host "Tekan Enter jika sudah menutup Android Studio..."

# Hapus folder build di android
Write-Host "📁 Menghapus android/build..." -ForegroundColor Gray
Remove-Item -Recurse -Force ".\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\android\app\build" -ErrorAction SilentlyContinue

# Hapus folder build di node_modules capacitor
Write-Host "📁 Menghapus build Capacitor plugins..." -ForegroundColor Gray
Remove-Item -Recurse -Force ".\node_modules\@capacitor\app\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\node_modules\@capacitor\haptics\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\node_modules\@capacitor\keyboard\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\node_modules\@capacitor\status-bar\android\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\android\capacitor-cordova-android-plugins\build" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Selesai! Sekarang:" -ForegroundColor Green
Write-Host "   1. Buka Android Studio" -ForegroundColor White
Write-Host "   2. File > Sync Project with Gradle Files" -ForegroundColor White
Write-Host "   3. Build > Rebuild Project" -ForegroundColor White
Write-Host ""
