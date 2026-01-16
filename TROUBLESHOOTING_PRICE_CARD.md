# 🔧 TROUBLESHOOTING - Price Card Registration Stuck

## ❌ **PROBLEM**

User stuck di "Processing authentication..." saat register dari price card di Landing Page.
Payment gateway tidak muncul.

---

## 🔍 **DEBUGGING STEPS**

### **Step 1: Verify Frontend is Latest Build**

**Check:**
```
Apakah folder dist/ yang di-upload adalah hasil build terakhir?
Build terakhir: 2026-01-16 09:10 WIB
```

**Action:**
1. Cek timestamp file di hosting
2. Jika bukan yang terbaru, upload ulang dari `c:\Users\LENOVO\Documents\POS\idcashier\dist\`

---

### **Step 2: Check Browser Console**

**How to:**
1. Buka website
2. Tekan `F12` untuk buka Developer Tools
3. Klik tab "Console"
4. Clear console (icon 🚫)
5. Coba register dari price card
6. Screenshot semua error yang muncul

**Look for:**
- ❌ Network errors (fetch failed, CORS, etc.)
- ❌ JavaScript errors
- ❌ API errors (400, 401, 500, etc.)

---

### **Step 3: Check Network Tab**

**How to:**
1. Buka Developer Tools (F12)
2. Klik tab "Network"
3. Clear network log
4. Coba register dari price card
5. Cari request yang failed (warna merah)

**Check these requests:**
1. ✅ `auth-register` - Should return 200 or 201
2. ✅ `duitku-payment-request` - Should return 200 with paymentUrl

**Common Issues:**
- ❌ 401 Unauthorized - API key issue
- ❌ 500 Internal Server Error - Backend error
- ❌ CORS error - Domain/origin issue
- ❌ No response - Network/timeout issue

---

## 🎯 **POSSIBLE CAUSES**

### **1. Frontend Not Updated**
**Symptom:** Old code still running
**Solution:** Upload latest `dist/` folder

### **2. auth-register Function Error**
**Symptom:** Request to auth-register fails
**Check:** Supabase Edge Function logs
**Solution:** Check function deployment

### **3. duitku-payment-request Function Error**
**Symptom:** Registration succeeds but payment fails
**Check:** Supabase Edge Function logs
**Solution:** Check Duitku credentials

### **4. CORS Issue**
**Symptom:** "CORS policy" error in console
**Solution:** Check domain configuration

### **5. API Key Issue**
**Symptom:** 401 Unauthorized
**Solution:** Check .env file has correct VITE_SUPABASE_ANON_KEY

---

## 📋 **CHECKLIST**

### **Frontend:**
- [ ] Latest build uploaded to hosting
- [ ] No JavaScript errors in console
- [ ] PaymentMethodSelector component loads correctly

### **Backend:**
- [ ] auth-register function deployed
- [ ] duitku-payment-request function deployed
- [ ] Both functions have no errors in logs

### **Environment:**
- [ ] VITE_SUPABASE_URL correct in .env
- [ ] VITE_SUPABASE_ANON_KEY correct in .env
- [ ] Duitku credentials correct

---

## 🔍 **HOW TO CHECK SUPABASE LOGS**

1. Go to: https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc/functions
2. Click on function name (e.g., `auth-register`)
3. Click "Logs" tab
4. Look for recent errors (red text)
5. Screenshot any errors

---

## 💡 **QUICK FIX ATTEMPTS**

### **Attempt 1: Hard Refresh Browser**
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### **Attempt 2: Clear Browser Cache**
```
1. Open Developer Tools (F12)
2. Right-click on refresh button
3. Select "Empty Cache and Hard Reload"
```

### **Attempt 3: Try Incognito Mode**
```
Windows: Ctrl + Shift + N
Mac: Cmd + Shift + N
```

---

## 📊 **EXPECTED FLOW**

### **Correct Flow:**
```
1. User clicks "Pilih Paket" on Landing Page
   ↓
2. PaymentMethodSelector opens
   ↓
3. User selects payment method
   ↓
4. Redirects to RegisterPage with params:
   ?plan=1_month&price=50000&duration=1&paymentMethod=VC
   ↓
5. User fills form (name, email, password)
   ↓
6. User clicks "Register and Pay"
   ↓
7. PaymentMethodSelector opens AGAIN (to confirm method)
   ↓
8. User confirms payment method
   ↓
9. processRegistration() called with payment method
   ↓
10. Call auth-register (skipTrial=true)
    ↓
11. Call duitku-payment-request
    ↓
12. Save pendingRegistration to localStorage
    ↓
13. Redirect to Duitku payment page ✅
```

### **Where it's Stuck:**
```
Stuck at step 9-11:
- "Processing authentication..." message shows
- Means processRegistration() is running
- But not completing
```

---

## 🚨 **WHAT TO SEND FOR DEBUGGING**

Please provide:

1. **Browser Console Screenshot**
   - Full console output when stuck
   - Any red errors

2. **Network Tab Screenshot**
   - Show failed requests (if any)
   - Show request/response details

3. **Supabase Logs Screenshot**
   - auth-register function logs
   - duitku-payment-request function logs

4. **Confirm:**
   - [ ] Frontend uploaded is from latest build (09:10 WIB)
   - [ ] Using Chrome/Firefox (not IE/old browser)
   - [ ] Internet connection stable

---

## 📝 **TEMPORARY WORKAROUND**

If price card registration doesn't work:

**Option 1: Direct Registration**
1. Go to `/register` directly
2. Register with trial (7 days free)
3. After login, go to Subscription page
4. Upgrade to paid plan

**Option 2: Manual Payment Link**
1. Register with trial
2. Contact admin for payment link
3. Complete payment
4. Admin activates subscription

---

**Status:** ⏳ **WAITING FOR DEBUG INFO**

Please provide browser console screenshot and network tab screenshot untuk analisis lebih lanjut.
