@echo off
echo Deploying edge function without JWT verification...
npx supabase functions deploy auth-login-final --no-verify-jwt
pause