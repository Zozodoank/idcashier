@echo off
echo "--- Supabase Edge Function Deployment ---"

set SUPABASE_PROJECT_ID=eypfeiqtvfxxiimhtycc

echo "Deploying auth-login-final function..."
npx supabase functions deploy auth-login-final --project-ref %SUPABASE_PROJECT_ID%

echo "--- Deployment finished ---"