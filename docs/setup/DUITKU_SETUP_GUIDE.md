# Panduan Setup Duitku Payment

## Status Saat Ini

✅ **Kode sudah diperbaiki dan siap deploy:**
- Edge Function mendukung pembayaran tanpa login (untuk registrasi)
- Error handling ditingkatkan dengan logging detail
- Frontend menampilkan error dengan lebih jelas
- Script test tersedia untuk diagnosis

❌ **Yang perlu dilakukan:**
- Set secrets Duitku di Supabase
- Deploy fungsi yang sudah diperbaiki
- Test dengan credentials sandbox

---

## Langkah 1: Dapatkan Credentials Duitku

### Sandbox (untuk testing)

1. Daftar/login ke [Duitku Sandbox](https://sandbox.duitku.com)
2. Buka **Dashboard** → **Settings**
3. Catat:
   - **Merchant Code** (contoh: DS12345)
   - **API Key** / **Merchant Key**
   - **Signature Algorithm** (biasanya MD5 atau SHA256)

### Production (setelah testing berhasil)

1. Daftar merchant production di [Duitku](https://passport.duitku.com)
2. Tunggu approval
3. Catat credentials production dari dashboard

---

## Langkah 2: Set Secrets di Supabase

### Via Dashboard (Recommended)

1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project Anda
3. Klik **Project Settings** (icon gear di sidebar)
4. Pilih **Edge Functions** tab
5. Scroll ke section **Secrets**
6. Tambahkan secrets berikut:

```
DUITKU_BASE_URL=https://sandbox.duitku.com
DUITKU_MERCHANT_CODE=DS12345
DUITKU_MERCHANT_KEY=your_merchant_key_here
```

**Optional:** Jika merchant Anda butuh MD5 signature:
```
DUITKU_SIGNATURE_ALGO=md5
```

**Optional:** Custom URLs (jika perlu):
```
RETURN_URL=https://idcashier.my.id/payment/finish
CALLBACK_URL=https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-callback
```

7. Klik **Save** untuk setiap secret

### Via CLI (Alternative)

```bash
# Set secrets via Supabase CLI
supabase secrets set DUITKU_BASE_URL=https://sandbox.duitku.com
supabase secrets set DUITKU_MERCHANT_CODE=DS12345
supabase secrets set DUITKU_MERCHANT_KEY=your_merchant_key_here

# Optional
supabase secrets set DUITKU_SIGNATURE_ALGO=md5
```

---

## Langkah 3: Deploy Edge Function

### Via CLI

```bash
# Dari folder root project
cd c:\xampp\htdocs\idcashier

# Deploy function
supabase functions deploy duitku-payment-request

# Atau deploy semua functions sekaligus
supabase functions deploy
```

### Via Dashboard

1. Buka Supabase Dashboard → **Edge Functions**
2. Pilih `duitku-payment-request`
3. Klik **Deploy** atau upload file `index.ts` yang sudah diperbaiki
4. Tunggu hingga status **Deployed**

---

## Langkah 4: Test Function

### Test via Script (Recommended)

```bash
# Jalankan test script
node test-duitku-payment.js
```

Script ini akan:
- ✅ Cek environment variables
- ✅ Kirim test request ke function
- ✅ Tampilkan response detail
- ✅ Berikan rekomendasi jika ada error

### Test via Dashboard

1. Buka Supabase Dashboard → **Edge Functions**
2. Pilih `duitku-payment-request`
3. Klik **Invoke**
4. Masukkan test payload:

```json
{
  "amount": 10000,
  "paymentMethod": "VC",
  "orderId": "TEST-123",
  "productDetails": "Test Payment",
  "customerEmail": "test@example.com"
}
```

5. Klik **Send Request**
6. Periksa response

### Test via Browser

1. Build frontend: `npm run build`
2. Buka halaman register di browser
3. Isi form dan submit
4. Buka **Browser Console** (F12)
5. Periksa logs:
   - ✅ Sukses: Lihat "✅ Payment created"
   - ❌ Error: Lihat "❌ Payment Function Error" dengan detail

---

## Troubleshooting

### Error: "Missing Duitku credentials"

**Penyebab:** Secrets belum di-set atau salah nama

**Solusi:**
1. Cek nama secrets di Dashboard (harus **exact match**):
   - `DUITKU_MERCHANT_CODE` (bukan `MERCHANT_CODE`)
   - `DUITKU_MERCHANT_KEY` (bukan `API_KEY`)
2. Redeploy function setelah set secrets

### Error: "Invalid signature" dari Duitku

**Penyebab:** Signature algorithm tidak cocok

**Solusi:**
1. Cek merchant settings di Duitku dashboard
2. Jika pakai MD5, set: `DUITKU_SIGNATURE_ALGO=md5`
3. Jika pakai SHA256, hapus secret tersebut (default SHA256)
4. Redeploy function

### Error: "Merchant not found"

**Penyebab:** 
- Merchant code salah
- Base URL salah (sandbox vs production)

**Solusi:**
1. Verifikasi merchant code dari Duitku dashboard
2. Pastikan base URL sesuai:
   - Sandbox: `https://sandbox.duitku.com`
   - Production: `https://passport.duitku.com`
3. Update secrets dan redeploy

### Error 502 terus menerus

**Langkah diagnosis:**

1. **Cek Edge Function Logs:**
   - Dashboard → Edge Functions → `duitku-payment-request` → **Logs**
   - Lihat console.log output untuk detail error

2. **Run test script:**
   ```bash
   node test-duitku-payment.js
   ```
   Baca error analysis di output

3. **Cek secrets:**
   ```bash
   supabase secrets list
   ```
   Pastikan semua DUITKU_* secrets ada

4. **Test langsung ke Duitku:**
   Gunakan Postman/curl untuk test ke Duitku API langsung
   (buat signature manual untuk verify credentials)

---

## Checklist Setup

- [ ] Dapatkan credentials Duitku sandbox
- [ ] Set secrets di Supabase Dashboard
- [ ] Deploy edge function
- [ ] Run `node test-duitku-payment.js`
- [ ] Verifikasi response 200 dengan paymentUrl
- [ ] Test di browser (registrasi page)
- [ ] Verifikasi redirect ke Duitku payment page
- [ ] Test callback/return flow
- [ ] Jika berhasil, lanjut ke production setup

---

## Production Deployment

Setelah sandbox berhasil:

1. **Dapatkan production credentials** dari Duitku
2. **Update secrets** dengan production values:
   ```
   DUITKU_BASE_URL=https://passport.duitku.com
   DUITKU_MERCHANT_CODE=<production_code>
   DUITKU_MERCHANT_KEY=<production_key>
   ```
3. **Test dengan amount kecil** (Rp 10,000)
4. **Monitor logs** untuk beberapa transaksi pertama
5. **Setup monitoring/alerting** untuk production errors

---

## Support

Jika masih ada masalah setelah mengikuti panduan ini:

1. **Run test script** dan copy full output
2. **Cek Edge Function logs** dan copy error messages
3. **Screenshot** browser console errors
4. Hubungi support Duitku jika credentials issue
5. Atau beri tahu developer dengan info di atas

---

## Quick Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DUITKU_BASE_URL` | No | `https://sandbox.duitku.com` | Duitku API base URL |
| `DUITKU_MERCHANT_CODE` | **Yes** | - | Merchant code dari Duitku |
| `DUITKU_MERCHANT_KEY` | **Yes** | - | API key dari Duitku |
| `DUITKU_SIGNATURE_ALGO` | No | `sha256` | Signature algorithm (md5/sha256) |
| `RETURN_URL` | No | `https://idcashier.my.id/payment/finish` | URL redirect setelah pembayaran |
| `CALLBACK_URL` | No | `${SUPABASE_URL}/functions/v1/duitku-callback` | URL untuk payment callback |

### Useful Commands

```bash
# Deploy function
supabase functions deploy duitku-payment-request

# View logs (real-time)
supabase functions logs duitku-payment-request

# List secrets
supabase secrets list

# Set secret
supabase secrets set KEY=VALUE

# Test function
node test-duitku-payment.js

# Build frontend
npm run build
```
