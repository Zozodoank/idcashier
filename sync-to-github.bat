@echo off
REM Batch script to run the PowerShell sync script
REM Repository: https://github.com/projectmandiri10-lang/idcashier.git
REM Location: c:\xampp\htdocs\idcashier

echo Starting synchronization with GitHub repository...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0sync-to-github.ps1"

echo.
echo Script execution completed.
pause