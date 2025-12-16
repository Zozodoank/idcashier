@echo off
echo "--- Supabase Edge Function Final Deployment Script ---"

set SUPABASE_PROJECT_ID=eypfeiqtvfxxiimhtycc

echo "Deploying auth-login-final function with explicit import map..."
npx supabase functions deploy auth-login-final --project-ref %SUPABASE_PROJECT_ID% --import-map supabase/functions/import_map.json

echo "--- Deployment script finished. ---"