# Production Deployment Fix - idcashier.my.id

## 🚨 Issues Detected

Berdasarkan console logs dari `idcashier.my.id`:

### 1. **Versi Lama Masih Ter-Deploy**
```
⚠️ setSession timed out (2s), proceeding anyway
```
- Timeout masih 2s (seharusnya 10s setelah fix)
- Versi yang di-deploy belum include fixes terbaru

### 2. **Session Management Issues**
```
Found legacy token but no session. Cleaning up.
```
- Session tidak persist dengan baik
- User harus login berulang kali

### 3. **Data Tidak Muncul**
- Products fetched: 1 items (terlalu sedikit)
- Company settings null
- Kemungkinan RLS policies atau data kosong

---

## ✅ Solusi Step-by-Step

### **Step 1: Build Ulang dengan Fixes Terbaru**

```bash
# 1. Pastikan di directory project
cd c:\Users\SEMOGA-AWET\Documents\POS\idcashier

# 2. Install dependencies (jika belum)
npm install

# 3. Build production
npm run build

# 4. Verify build output
dir dist
```

**Expected output:**
- `dist/index.html`
- `dist/assets/index-[hash].js`
- `dist/assets/index-[hash].css`

---

### **Step 2: Deploy ke Production**

#### **Opsi A: Manual Upload (Jika pakai cPanel/FTP)**

```bash
# 1. Compress dist folder
tar -czf dist.tar.gz dist/

# 2. Upload dist.tar.gz ke server
# 3. Extract di server:
cd /path/to/idcashier.my.id
tar -xzf dist.tar.gz
mv dist/* .
```

#### **Opsi B: Git Deploy (Jika pakai Git)**

```bash
# 1. Commit changes
git add .
git commit -m "Fix: Session timeout and React warnings"
git push origin main

# 2. Di server, pull changes
ssh user@idcashier.my.id
cd /path/to/app
git pull
npm install
npm run build
```

#### **Opsi C: Automated Deploy (Jika pakai CI/CD)**

```bash
# Trigger deployment
git push origin main
# CI/CD akan otomatis build dan deploy
```

---

### **Step 3: Verify Deployment**

```bash
# 1. Clear browser cache
# Chrome: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete

# 2. Hard refresh
# Chrome/Firefox: Ctrl+F5

# 3. Check console logs
# Seharusnya tidak ada lagi:
# - "setSession timed out (2s)"
# - React lifecycle warnings
```

---

### **Step 4: Fix Environment Variables**

Pastikan `.env` di production sudah benar:

```bash
# Di server, check .env file
cat .env

# Seharusnya ada:
VITE_SUPABASE_URL=https://eypfeiqtvfxxiimhtycc.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**PENTING:** Jika deploy static files (dist), environment variables harus di-set saat **build time**, bukan runtime!

---

### **Step 5: Check Supabase Configuration**

#### A. Verify CORS Settings

```bash
# Login ke Supabase Dashboard
# https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc

# Go to: Settings > API
# Allowed Origins should include:
# - https://idcashier.my.id
# - http://localhost:3000 (for development)
```

#### B. Check RLS Policies

```sql
-- Connect to Supabase SQL Editor
-- Run this query to check RLS status:

SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

#### C. Verify Edge Functions

```bash
# Test edge function from production domain
curl -X POST https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login-final \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"jho.j80@gmail.com","password":"@Se06070786"}'

# Should return: {"success":true,"token":"...","user":{...}}
```

---

## 🔍 Troubleshooting Data Issues

### **Issue: "Products fetched: 1 items" (Too Few)**

#### Check 1: Verify Data Exists

```sql
-- Login to Supabase SQL Editor
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM sales;
SELECT COUNT(*) FROM customers;

-- If counts are low, data might be missing
```

#### Check 2: Check Tenant ID

```sql
-- Check user's tenant_id
SELECT id, email, tenant_id FROM users 
WHERE email = 'jho.j80@gmail.com';

-- Check products for that tenant
SELECT COUNT(*) FROM products 
WHERE tenant_id = 'YOUR_TENANT_ID';
```

#### Check 3: RLS Policy Issues

```sql
-- Test RLS policy
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"user-id","tenant_id":"tenant-id"}';

SELECT * FROM products;
-- Should return products for that tenant only
```

---

### **Issue: "Company settings null"**

#### Check 1: Store Settings Table

```sql
-- Check if store_settings table exists
SELECT * FROM store_settings 
WHERE owner_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287';

-- If empty, insert default:
INSERT INTO store_settings (owner_id, name, address, phone)
VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Toko Saya', 'Alamat', '08123456789');
```

#### Check 2: Receipt Settings

```sql
-- Check receipt_settings
SELECT * FROM receipt_settings 
WHERE owner_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287';

-- If empty, insert default:
INSERT INTO receipt_settings (owner_id, header_text, footer_text)
VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Terima Kasih', 'Barang yang sudah dibeli tidak dapat dikembalikan');
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [x] ✅ Session timeout fixes applied (5s→15s, 2s→10s)
- [x] ✅ React helmet migrated to react-helmet-async
- [x] ✅ All dependencies installed
- [ ] ⚠️ Build production version
- [ ] ⚠️ Test build locally

### Deployment
- [ ] ⚠️ Upload/deploy new build
- [ ] ⚠️ Verify environment variables
- [ ] ⚠️ Clear CDN cache (if using CDN)
- [ ] ⚠️ Clear browser cache

### Post-Deployment
- [ ] ⚠️ Test login flow
- [ ] ⚠️ Verify data loads correctly
- [ ] ⚠️ Check console for errors
- [ ] ⚠️ Test on multiple browsers
- [ ] ⚠️ Monitor error logs

---

## 🚀 Quick Fix Commands

```bash
# Complete deployment in one go:

# 1. Build
npm run build

# 2. Deploy (adjust based on your setup)
# For cPanel/FTP:
# - Upload dist/* to public_html/

# For Git:
git add .
git commit -m "Deploy fixes"
git push origin main

# 3. Verify
curl -I https://idcashier.my.id
# Should return 200 OK

# 4. Test
# Open https://idcashier.my.id in incognito mode
# Check console - should be clean
```

---

## 🔧 Additional Fixes Needed

### 1. Update Console Log Message

File: `src/lib/api.js` line 149

```javascript
// Change this:
console.warn('⚠️ setSession timed out (2s), proceeding anyway');

// To this:
console.warn('⚠️ setSession timed out (10s), proceeding anyway');
```

### 2. Add Better Error Handling

```javascript
// In api.js, add error logging
if (result === 'timeout') {
  console.warn('⚠️ setSession timed out (10s), proceeding anyway');
  console.log('Network might be slow. Session will be set in background.');
}
```

---

## 📊 Expected Results After Fix

### Before Fix (Current Production)
- ❌ setSession timeout: 2s
- ❌ React warnings in console
- ❌ Session issues
- ❌ Data loading issues

### After Fix
- ✅ setSession timeout: 10s
- ✅ No React warnings
- ✅ Stable sessions
- ✅ Data loads correctly
- ✅ Better user experience

---

## 🆘 If Still Having Issues

### Check These:

1. **Browser Cache**
   ```bash
   # Clear completely
   # Chrome: chrome://settings/clearBrowserData
   # Select "Cached images and files"
   ```

2. **CDN Cache** (if using Cloudflare/etc)
   ```bash
   # Purge CDN cache
   # Cloudflare: Dashboard > Caching > Purge Everything
   ```

3. **Service Worker**
   ```javascript
   // In browser console:
   navigator.serviceWorker.getRegistrations().then(registrations => {
     registrations.forEach(r => r.unregister());
   });
   ```

4. **Check Network Tab**
   - Open DevTools > Network
   - Reload page
   - Check if JS files are loading from cache or server
   - Look for 304 (cached) vs 200 (fresh)

---

## 📞 Support

Jika masih ada masalah setelah deployment:

1. **Check build output:**
   ```bash
   ls -la dist/assets/
   # Verify file sizes and timestamps
   ```

2. **Check server logs:**
   ```bash
   tail -f /var/log/nginx/error.log
   # or
   tail -f /var/log/apache2/error.log
   ```

3. **Test API directly:**
   ```bash
   curl https://idcashier.my.id/assets/index-*.js | head -n 20
   # Should show minified JS code
   ```

---

*Panduan ini akan membantu deploy fixes ke production dan troubleshoot issues yang ada.*
