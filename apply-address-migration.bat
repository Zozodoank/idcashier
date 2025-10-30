@echo off
REM Apply address column migration to Supabase database
REM This script adds the missing address column to the customers table

echo Applying address column migration...
cd /d %~dp0
node apply-address-migration.js

echo.
echo Migration process completed.
pause