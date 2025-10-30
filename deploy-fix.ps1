Write-Host "Deploying Duitku Payment Request RLS Fix..." -ForegroundColor Green

Write-Host "1. Applying SQL migration for RLS policies..." -ForegroundColor Yellow
supabase migration up

Write-Host "2. Deploying updated Edge Function..." -ForegroundColor Yellow
supabase functions deploy duitku-payment-request

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To test the fix:" -ForegroundColor Cyan
Write-Host "1. Make a request without Authorization header - should return 401" -ForegroundColor Cyan
Write-Host "2. Make a request with valid Authorization header - should return 200 and create payment record" -ForegroundColor Cyan