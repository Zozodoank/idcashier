@echo off
echo Deploying Duitku Payment Request RLS Fix...

echo 1. Applying SQL migration for RLS policies...
supabase migration up

echo 2. Deploying updated Edge Function...
supabase functions deploy duitku-payment-request

echo Deployment complete!
echo.
echo To test the fix:
echo 1. Make a request without Authorization header - should return 401
echo 2. Make a request with valid Authorization header - should return 200 and create payment record