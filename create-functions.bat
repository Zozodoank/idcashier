@echo off
echo Creating Supabase Edge Functions...

echo.
echo Creating Auth Functions...
npx supabase functions new auth-login
npx supabase functions new auth-me
npx supabase functions new auth-register
npx supabase functions new auth-request-password-reset
npx supabase functions new auth-reset-password

echo.
echo Creating Products Functions...
npx supabase functions new products-get-all
npx supabase functions new products-get-by-id
npx supabase functions new products-create
npx supabase functions new products-update
npx supabase functions new products-delete

echo.
echo Creating Sales Functions...
npx supabase functions new sales-get-all
npx supabase functions new sales-get-by-id
npx supabase functions new sales-create
npx supabase functions new sales-update
npx supabase functions new sales-delete

echo.
echo Creating Categories Functions...
npx supabase functions new categories-get-all
npx supabase functions new categories-get-by-id
npx supabase functions new categories-create
npx supabase functions new categories-update
npx supabase functions new categories-delete

echo.
echo Creating Customers Functions...
npx supabase functions new customers-get-all
npx supabase functions new customers-get-by-id
npx supabase functions new customers-create
npx supabase functions new customers-update
npx supabase functions new customers-delete

echo.
echo Creating Users Functions...
npx supabase functions new users-get-all
npx supabase functions new users-get-by-id
npx supabase functions new users-create
npx supabase functions new users-update
npx supabase functions new users-delete

echo.
echo Creating Suppliers Functions...
npx supabase functions new suppliers-get-all
npx supabase functions new suppliers-get-by-id
npx supabase functions new suppliers-create
npx supabase functions new suppliers-update
npx supabase functions new suppliers-delete

echo.
echo Creating Dashboard Functions...
npx supabase functions new dashboard-stats
npx supabase functions new dashboard-recent-transactions
npx supabase functions new dashboard-top-products

echo.
echo Creating Subscriptions Functions...
npx supabase functions new subscriptions-get-current

echo.
echo All functions created successfully!
pause