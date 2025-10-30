@echo off
:: Test script for the duitku-payment-request function

set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
set FUNCTION_URL=%SUPABASE_URL%/functions/v1/duitku-payment-request

echo Test 1: Request without Authorization header
curl -X POST "%FUNCTION_URL%" ^
  -H "Content-Type: application/json" ^
  -d "{^
    \"paymentAmount\": 50000,^
    \"productDetails\": \"Test Product\",^
    \"merchantOrderId\": \"TEST-%date:~0,4%%date:~5,2%%date:~8,2%%time:~0,2%%time:~3,2%%time:~6,2%\"^
  }"

echo.
echo Expected: 401 Unauthorized

echo.
echo Test 2: Request with invalid Authorization header
curl -X POST "%FUNCTION_URL%" ^
  -H "Authorization: Bearer invalid-token" ^
  -H "Content-Type: application/json" ^
  -d "{^
    \"paymentAmount\": 50000,^
    \"productDetails\": \"Test Product\",^
    \"merchantOrderId\": \"TEST-%date:~0,4%%date:~5,2%%date:~8,2%%time:~0,2%%time:~3,2%%time:~6,2%\"^
  }"

echo.
echo Expected: 401 Unauthorized

echo.
echo Test 3: Valid request with real token
echo To test with a valid token, first authenticate with Supabase and get your access token.
echo Then run:
echo curl -X POST "%FUNCTION_URL%" ^
echo   -H "Authorization: Bearer YOUR_ACCESS_TOKEN" ^
echo   -H "Content-Type: application/json" ^
echo   -d "{^
echo     \"paymentAmount\": 50000,^
echo     \"productDetails\": \"Test Product\",^
echo     \"merchantOrderId\": \"TEST-%date:~0,4%%date:~5,2%%date:~8,2%%time:~0,2%%time:~3,2%%time:~6,2%\"^
echo   }"
echo.
echo Expected: 200 OK with payment record created