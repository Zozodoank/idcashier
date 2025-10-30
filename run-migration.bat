@echo off
title idCashier Multi-Tenancy Migration

echo ========================================
echo idCashier Multi-Tenancy Migration Tool
echo ========================================
echo.

REM Check if PostgreSQL tools are available
echo Checking for PostgreSQL tools...
pg_dump --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ pg_dump is available
) else (
    echo ✗ pg_dump not found in PATH
    echo   You may need to use the full path to pg_dump
    echo   Common locations:
    echo   - "C:\Program Files\PostgreSQL\[version]\bin\pg_dump.exe"
    echo   - "C:\xampp\pgsql\bin\pg_dump.exe"
    echo.
)

psql --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ psql is available
) else (
    echo ✗ psql not found in PATH
    echo   You may need to use the full path to psql
    echo   Common locations:
    echo   - "C:\Program Files\PostgreSQL\[version]\bin\psql.exe"
    echo   - "C:\xampp\pgsql\bin\psql.exe"
    echo.
)

echo.
echo Please ensure you have:
echo 1. Backed up your database
echo 2. Located your PostgreSQL tools
echo 3. Have your database connection details ready
echo.
echo To run the migration:
echo 1. Edit the database connection details below
echo 2. Uncomment the appropriate lines
echo 3. Save and run this batch file
echo.

pause

REM Example database connection details - EDIT THESE BEFORE RUNNING
REM set DB_HOST=localhost
REM set DB_PORT=5432
REM set DB_NAME=your_database_name
REM set DB_USER=your_username
REM set DB_PASS=your_password

REM Example migration commands - UNCOMMENT AND EDIT AS NEEDED
REM "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME% > backup_before_migration.sql
REM "C:\Program Files\PostgreSQL\14\bin\psql.exe" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% %DB_NAME% < migration-add-tenant-id.sql

echo.
echo Migration process completed.
echo Please verify the migration was successful.
echo Check the MIGRATION_GUIDE.md file for verification steps.
echo.
pause