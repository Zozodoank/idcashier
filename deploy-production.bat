@echo off
echo ========================================
echo   idCashier Production Deployment
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Building production version...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [3/4] Verifying build output...
if not exist "dist\index.html" (
    echo ERROR: Build output not found
    pause
    exit /b 1
)

echo.
echo [4/4] Build completed successfully!
echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo 1. Upload contents of 'dist' folder to your server
echo 2. Clear browser cache (Ctrl+Shift+Delete)
echo 3. Hard refresh (Ctrl+F5)
echo 4. Verify no console errors
echo.
echo Build location: %CD%\dist
echo.
pause
