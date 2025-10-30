# 🚀 HPP Quick Start Guide

## ⚡ 3 Steps to Enable HPP

### **Step 1: Apply Database Migration** (2 minutes)

1. Open: https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc/sql/new
2. Open file: `migrations/000_apply_hpp_migrations.sql`
3. Copy all → Paste in Supabase SQL Editor → Click **"Run"**
4. ✅ Done! Database ready.

### **Step 2: Deploy Frontend** (Already Done!)

Frontend sudah di-build! ✅

Jika perlu rebuild:
```bash
npm run build
```

### **Step 3: Activate HPP** (30 seconds)

1. Login to idCashier
2. Go to **Settings** → **HPP** tab
3. Toggle **"Aktifkan Fitur HPP"** to ON
4. ✅ Done! HPP active.

---

## 🎯 Test HPP Feature

### Test 1: Custom Costs at Checkout
1. Go to **Sales** page
2. Add product to cart
3. Scroll to **"Biaya Tambahan HPP (Opsional)"**
4. Click **"+ Tambah"**
5. Enter:
   - Label: `Ongkir`
   - Amount: `15000`
6. Click **"Tambah"** again
7. Enter:
   - Label: `Packaging`
   - Amount: `5000`
8. Complete transaction
9. ✅ Verify: Total = Subtotal + Tax (NOT including 20000)
10. ✅ Custom costs recorded for profit calculation only

### Test 2: Permissions
1. Go to **Settings** → **Account** → **Cashier Accounts**
2. Add/Edit cashier
3. Verify HPP permissions checkboxes visible:
   - ☑️ Dapat Melihat HPP
   - ☑️ Dapat Edit HPP
   - ☑️ Dapat Tambah Biaya Kustom
4. ✅ Test granting/revoking permissions

---

## 📋 Migration SQL Preview

```sql
-- Quick verification queries
SELECT COUNT(*) FROM app_settings WHERE setting_key = 'hpp_enabled';
-- Should return: 1 row per user

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'hpp';
-- Should return: 'hpp'

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'sale_items' AND column_name IN ('cost_snapshot', 'hpp_extra', 'hpp_total');
-- Should return: 3 rows

SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'sale_custom_costs';
-- Should return: 1
```

---

## ⚠️ Important Notes

1. **HPP disabled by default** - No impact until you enable it
2. **Custom costs are optional** - Skip if not needed
3. **Backward compatible** - Existing data preserved
4. **No data loss** - All migrations are safe
5. **Rollback safe** - Can disable HPP toggle anytime

---

## 🎉 You're Done!

HPP feature ready to use. Enjoy profit analysis! 📊

**Questions?** Read `HPP_IMPLEMENTATION_GUIDE.md` for detailed docs.

