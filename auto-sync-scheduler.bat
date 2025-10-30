@echo off
REM Batch script to run the advanced PowerShell sync script
REM Repository: https://github.com/projectmandiri10-lang/idcashier.git
REM Location: c:\xampp\htdocs\idcashier

echo Starting advanced synchronization with GitHub repository...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0auto-sync-scheduler.ps1"

echo.
echo Advanced sync script execution completed.
echo Log files are available in the logs directory.
pause