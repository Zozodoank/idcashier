@echo off
REM Verify address column in customers table
REM This script verifies that the address column was successfully added to the customers table

echo Verifying address column...
cd /d %~dp0
node verify-address-column.js

echo.
echo Verification process completed.
pause