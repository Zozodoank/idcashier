# 🚀 Deployment Guide - Edge Functions

## ⚠️ PENTING: HARUS DEPLOY EDGE FUNCTIONS!

Perbaikan yang baru saja dilakukan adalah di **backend (Edge Functions)**. 
Perubahan ini **TIDAK AKAN BERLAKU** sampai Edge Functions di-deploy ke production.

---

## 📋 **Langkah Deployment**

### **Option 1: Deploy Semua Critical Functions (RECOMMENDED)**

```bash
# Deploy all 7 critical functions at once
npx supabase functions deploy users-create && \
npx supabase functions deploy users-update && \
npx supabase functions deploy users-delete && \
npx supabase functions deploy sales-create && \
npx supabase functions deploy sales-delete && \
npx supabase functions deploy auth-register && \
npx supabase functions deploy dashboard-recent-transactions
```

### **Option 2: Deploy Satu Per Satu**

```bash
# 1. User Management Functions
npx supabase functions deploy users-create
npx supabase functions deploy users-update
npx supabase functions deploy users-delete

# 2. Sales Functions
npx supabase functions deploy sales-create
npx supabase functions deploy sales-delete

# 3. Auth Function
npx supabase functions deploy auth-register

# 4. Dashboard Function
npx supabase functions deploy dashboard-recent-transactions
```

---

## ✅ **Verify Deployment**

Setelah deploy, verify bahwa semua functions sudah ter-deploy:

```bash
# List all deployed functions
npx supabase functions list
```

Output yang diharapkan harus menunjukkan semua 7 functions dengan status **deployed**.

---

## 🧪 **Test After Deployment**

### **Test 1: Quick Smoke Test**

```bash
# Test users-create endpoint
npx supabase functions invoke users-create --method OPTIONS

# Should return: ok (200)
```

### **Test 2: Browser Testing**

1. **Refresh browser** (Ctrl + F5 atau Cmd + Shift + R)
2. Test fitur-fitur:
   - Add Cashier
   - Create Sale
   - Add User (Developer page)
   - Check Dashboard

---

## 🔍 **Troubleshooting**

### **Error: "supabase: command not found"**

Install Supabase CLI:
```bash
npm install -g supabase
```

### **Error: "Not logged in"**

Login ke Supabase:
```bash
npx supabase login
```

### **Error: "Project not linked"**

Link ke project:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

Dapatkan `YOUR_PROJECT_REF` dari:
- Supabase Dashboard > Project Settings > General > Reference ID

### **Error: "Function deployment failed"**

1. Check function syntax errors:
   ```bash
   npx supabase functions serve users-create
   ```

2. Check logs:
   ```bash
   npx supabase functions logs users-create
   ```

---

## 📊 **Check Deployment Status**

### **Via Supabase Dashboard:**

1. Buka https://supabase.com/dashboard
2. Pilih project Anda
3. Klik **Edge Functions** di sidebar
4. Verify semua 7 functions muncul dengan status **Deployed**

### **Via CLI:**

```bash
# Get detailed info about a function
npx supabase functions describe users-create
```

---

## 🔄 **Rollback (Jika Diperlukan)**

Jika ada masalah setelah deployment, Anda bisa rollback dengan:

```bash
# Deploy versi sebelumnya dari git
git checkout HEAD~1 supabase/functions/users-create/index.ts
npx supabase functions deploy users-create
```

**ATAU** restore dari backup manual jika ada.

---

## 📝 **Deployment Checklist**

Sebelum deploy production, pastikan:

- [x] Semua file Edge Functions sudah diperbaiki
- [x] No linter errors
- [x] Tested di local dengan `npx supabase functions serve`
- [ ] Backup database (opsional tapi recommended)
- [ ] Deploy ke production
- [ ] Verify deployment
- [ ] Test semua fitur
- [ ] Monitor logs untuk errors

---

## 🎯 **Post-Deployment Verification**

Setelah deployment berhasil, test:

1. ✅ **Cashier Creation**: Settings > Add Cashier → Should work
2. ✅ **Sales Recording**: POS > Create Sale → Should appear in Dashboard
3. ✅ **User Creation**: Developer Page > Add User → Should work
4. ✅ **Dashboard**: Recent Transactions → Should show new sales
5. ✅ **Reports**: Should show all new transactions

---

## ⚡ **Quick Commands Reference**

```bash
# Deploy all critical functions
npx supabase functions deploy users-create users-update users-delete sales-create sales-delete auth-register dashboard-recent-transactions

# List functions
npx supabase functions list

# View logs
npx supabase functions logs users-create --tail

# Test locally
npx supabase functions serve users-create
```

---

## 📞 **Need Help?**

Jika ada masalah saat deployment:

1. Check Supabase Dashboard > Edge Functions > Logs
2. Run `npx supabase functions logs [function-name]`
3. Verify .env dan secrets sudah benar
4. Check internet connection
5. Verify Supabase CLI version: `npx supabase --version`

---

**Update:** 22 Oktober 2025  
**Status:** Ready for deployment 🚀

