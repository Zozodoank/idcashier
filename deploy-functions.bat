@echo off
echo Deploying Supabase Edge Functions...

echo.
echo Deploying Auth Functions...
npx supabase functions deploy auth-login --no-verify-jwt
npx supabase functions deploy auth-me
npx supabase functions deploy auth-register
npx supabase functions deploy auth-request-password-reset
npx supabase functions deploy auth-reset-password

echo.
echo Deploying Products Functions...
npx supabase functions deploy products-get-all
npx supabase functions deploy products-get-by-id
npx supabase functions deploy products-create
npx supabase functions deploy products-update
npx supabase functions deploy products-delete

echo.
echo Deploying Sales Functions...
npx supabase functions deploy sales-get-all

echo.
echo All functions deployed successfully!
pause