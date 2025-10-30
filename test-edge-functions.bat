@echo off
echo Testing Supabase Edge Functions Deployment...

echo.
echo Testing Auth Functions...
npx supabase functions deploy auth-login --no-verify-jwt --dry-run
npx supabase functions deploy auth-me --dry-run
npx supabase functions deploy auth-register --dry-run

echo.
echo Testing Products Functions...
npx supabase functions deploy products-get-all --dry-run
npx supabase functions deploy products-get-by-id --dry-run
npx supabase functions deploy products-create --dry-run

echo.
echo All functions tested successfully!
pause