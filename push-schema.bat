@echo off
title Push Schema to Supabase

echo ========================================
echo    Push Schema to Supabase
echo ========================================
echo.

node push-schema-to-supabase.cjs

echo.
echo ========================================
echo    Next Steps:
echo ========================================
echo 1. Follow the instructions above to push your schema
echo 2. Open your Supabase dashboard at https://app.supabase.com
echo 3. Navigate to SQL Editor and paste the schema content
echo 4. Run the SQL commands
echo.
echo If you encounter any errors, check TROUBLESHOOTING.md for solutions
echo.

pause