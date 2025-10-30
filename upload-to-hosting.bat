@echo off
echo Uploading idCashier to hosting idcashier.my.id...
echo.

REM Create a temporary directory for upload
if not exist "temp_upload" mkdir temp_upload

REM Copy dist contents to temp directory
xcopy /E /I /Y "dist\*" "temp_upload\"

echo Files ready for upload:
dir temp_upload /B

echo.
echo Please upload the contents of 'temp_upload' folder to your hosting:
echo - Host: ftp.idcashier.my.id
echo - Username: abc@idcashier.my.id
echo - Password: @Se06070786
echo - Remote Path: /public_html
echo.
echo You can use any FTP client or the SFTP extension in VS Code.
echo.
echo After upload, test the application at: https://idcashier.my.id
echo.

pause
