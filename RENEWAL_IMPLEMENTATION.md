# Renewal Subscription Implementation

## Overview
Implementasi fitur perpanjangan subscription untuk user yang sudah terdaftar dengan integrasi payment gateway Duitku.

## Features Implemented
1. **Login Subscription Check**: Auth-login Edge Function sekarang mengecek status subscription dan block login jika expired
2. **Renewal Payment API**: Edge Function baru `renew-subscription-payment` untuk create payment request
3. **Renewal Page**: UI untuk pilih paket subscription (3/6/12 bulan) dan redirect ke payment
4. **Callback Handler Update**: Duitku callback sekarang extend subscription end_date untuk renewal
5. **Frontend Integration**: Update LoginPage, SubscriptionPage, dan PaymentCallbackPage untuk handle renewal flow

## Architecture

### Backend Flow
1. User login → auth-login check subscription → return error jika expired
2. User pilih paket di RenewalPage → call renew-subscription-payment
3. renew-subscription-payment create payment record → call Duitku API → return payment URL
4. User complete payment di Duitku → callback ke duitku-callback
5. duitku-callback detect renewal → extend subscription end_date → update status

### Frontend Flow
1. LoginPage detect subscription expired → redirect ke /renewal
2. RenewalPage display plans → user pilih → redirect ke Duitku
3. PaymentCallbackPage handle callback → redirect ke /subscription dengan success message

## Subscription Plans
- **3 Bulan**: Rp 150.000 (Rp 50.000/bulan)
- **6 Bulan**: Rp 270.000 (Rp 45.000/bulan) - Diskon 10%
- **12 Bulan**: Rp 500.000 (Rp 41.667/bulan) - Diskon 17%

## Environment Variables Required
```
DUITKU_SIGNATURE_ALGO=sha-256
FRONTEND_URL=https://idcashier.my.id
```

## Database Schema
### payments table
- merchant_order_id format untuk renewal: `RENEWAL-{userId}-{timestamp}`

### subscriptions table
- end_date di-extend berdasarkan plan duration
- status di-set ke 'active' setelah payment success

## Testing
1. Test dengan akun expired: testing@tes.com / @Testing123
2. Test login dengan subscription expired → harus redirect ke renewal
3. Test pilih paket → harus redirect ke Duitku
4. Test payment callback → harus extend subscription

## Deployment Checklist
- [ ] Deploy Edge Functions: auth-login, renew-subscription-payment, duitku-callback
- [ ] Set environment variables di Supabase
- [ ] Deploy frontend dengan RenewalPage
- [ ] Test end-to-end flow
- [ ] Monitor logs untuk errors

## Troubleshooting
- **Login tidak block expired user**: Check auth-login Edge Function logs
- **Payment URL tidak muncul**: Check renew-subscription-payment logs dan Duitku credentials
- **Subscription tidak extend**: Check duitku-callback logs dan merchantOrderId format