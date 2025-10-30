@echo off
echo Fixing idCashier Database Issues
echo ===============================
echo.

echo IMPORTANT: Before running this script, make sure you have:
echo 1. Updated your .env file with your Supabase Service Role Key
echo 2. Backed up any important data (this will wipe your database)
echo.
pause

echo Step 1: Testing Supabase Connection...
node "c:\xampp\htdocs\idcashier\test-supabase-connection.js"
echo.
pause

echo Step 2: Resetting Database...
echo Opening Supabase SQL Editor instructions:
echo.
echo 1. Go to your Supabase project dashboard
echo 2. Open the SQL Editor
echo 3. Run these statements:
echo.
echo DROP TABLE IF EXISTS sale_items CASCADE;
echo DROP TABLE IF EXISTS sales CASCADE;
echo DROP TABLE IF EXISTS products CASCADE;
echo DROP TABLE IF EXISTS categories CASCADE;
echo DROP TABLE IF EXISTS suppliers CASCADE;
echo DROP TABLE IF EXISTS customers CASCADE;
echo DROP TABLE IF EXISTS subscriptions CASCADE;
echo DROP TABLE IF EXISTS users CASCADE;
echo.
pause

echo Step 3: Applying Updated Schema...
echo.
echo 1. In the Supabase SQL Editor, open the file supabase-schema.sql
echo 2. Copy its contents
echo 3. Paste and run in the SQL Editor
echo.
pause

echo Step 4: Inserting Developer Account...
echo.
echo 1. In the Supabase SQL Editor, open the file insert-developer.sql
echo 2. Copy its contents
echo 3. Paste and run in the SQL Editor
echo.
pause

echo Process Complete!
echo.
echo Test your application with: npm run dev:full
echo.
pause