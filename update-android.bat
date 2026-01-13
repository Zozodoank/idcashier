@echo off
echo 🚀 Starting update...

echo 📦 Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed!
    exit /b %errorlevel%
)

echo 🔄 Syncing to Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ❌ Sync failed!
    exit /b %errorlevel%
)

echo 🔧 Patching capacitor.build.gradle (Java 21 -> 17)...
powershell -Command "(Get-Content android\app\capacitor.build.gradle) -replace 'JavaVersion.VERSION_21', 'JavaVersion.VERSION_17' | Set-Content android\app\capacitor.build.gradle"

echo ✅ Done! Open Android Studio and build.
pause
