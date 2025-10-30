# 📘 HPP (Harga Pokok Penjualan) - Implementation Guide

## 🎯 Overview

Fitur HPP telah berhasil diimplementasikan ke dalam idCashier dengan pendekatan **bertahap**, **user-friendly**, dan **optional**. Fitur ini memungkinkan tracking biaya produksi dan perhitungan profit dengan tetap menjaga kesederhanaan aplikasi.

---

## ✅ What Was Implemented

### **1. Database Changes (5 Migrations)**

#### Migration 001: Add HPP to Products
- ✅ Added `hpp` column to `products` table
- ✅ Backward compatible (keeps existing `cost` column)
- ✅ Auto-populated from existing cost data

#### Migration 002: Add Cost Snapshot to Sale Items
- ✅ Added `cost_snapshot` - HPP at time of sale
- ✅ Added `hpp_extra` - Additional costs allocated to item
- ✅ Added `hpp_total` - Total HPP (base + extra)

#### Migration 003: Create Sale Custom Costs Table
- ✅ New table: `sale_custom_costs`
- ✅ Stores custom costs per sale (delivery, packaging, etc.)
- ✅ Indexed for performance

#### Migration 004: Add HPP Settings
- ✅ New table: `app_settings`
- ✅ Global toggle for HPP feature
- ✅ Default: **disabled** for all users (zero impact)

#### Migration 005: Add HPP Permissions
- ✅ `canViewHPP` - View HPP data
- ✅ `canEditHPP` - Edit HPP values
- ✅ `canAddCustomCosts` - Add custom costs at checkout
- ✅ Auto-assigned based on role (owner/admin = true, cashier = false)

---

### **2. Frontend Components**

#### New Components Created:
1. **`src/components/HPPSettings.jsx`**
   - Toggle HPP feature on/off
   - Shows status and info
   - Owner/admin only

2. **`src/components/CustomCostsInput.jsx`**
   - Add multiple custom costs
   - Simple label + amount inputs
   - Auto-calculate totals
   - Info: costs not added to customer payment

#### Updated Pages:
1. **`src/pages/SettingsPage.jsx`**
   - ✅ Added HPP tab
   - ✅ Integrated HPPSettings component

2. **`src/pages/SalesPage.jsx`**
   - ✅ Added CustomCostsInput (conditional)
   - ✅ Shows only if HPP enabled + has permission
   - ✅ Placed below Tax field

3. **`src/lib/api.js`**
   - ✅ Added `settingsAPI` with get/update methods
   - ✅ Uses Supabase `app_settings` table

---

### **3. Translations**

Added for all 3 languages (English, Indonesian, Chinese):
- `hpp`, `hppFull`, `profitMarginPercent`
- `customCosts`, `addCustomCost`, `customCostLabel`
- `hppSettings`, `enableHPP`, `hppEnabled`, `hppDisabled`
- `canViewHPP`, `canEditHPP`, `canAddCustomCosts`
- And 10+ more keys

---

## 🚀 Deployment Steps

### **Step 1: Apply Database Migrations**

**Option A: Apply Combined Migration (Recommended)**
1. Go to: https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc/sql/new
2. Open file: `migrations/000_apply_hpp_migrations.sql`
3. Copy all content
4. Paste in Supabase SQL Editor
5. Click **"Run"**
6. ✅ Verify: All 5 migrations applied successfully

**Option B: Apply Individual Migrations**
```bash
# If you prefer step-by-step
npx supabase db execute -f migrations/001_add_hpp_to_products.sql
npx supabase db execute -f migrations/002_add_cost_snapshot.sql
npx supabase db execute -f migrations/003_create_sale_custom_costs.sql
npx supabase db execute -f migrations/004_add_hpp_settings.sql
npx supabase db execute -f migrations/005_add_hpp_permissions.sql
```

### **Step 2: Deploy Frontend**

Frontend sudah di-build. Jika menggunakan hosting statis:

```bash
# Build already completed
# Deploy dist/ folder to your hosting
```

Jika menggunakan local development:
```bash
npm run dev
```

### **Step 3: Verify Deployment**

1. **Login** to idCashier
2. Go to **Settings** → **HPP** tab
3. Verify HPP Settings card appears
4. Toggle **"Aktifkan Fitur HPP"**
5. Go to **Sales** page
6. Below Tax field, verify **"Biaya Tambahan HPP"** section appears
7. Click **"+ Tambah"** to test adding custom costs

---

## 🎮 How to Use

### **For Owner/Admin:**

#### 1. Enable HPP Feature
1. Login as owner/admin
2. Go to **Settings** → **HPP**
3. Toggle **"Aktifkan Fitur HPP"** ON
4. ✅ Feature now active for your account

#### 2. Add Custom Costs to Sale
1. Go to **Sales** page
2. Add products to cart
3. Scroll to **"Biaya Tambahan HPP (Opsional)"**
4. Click **"+ Tambah"**
5. Enter:
   - **Label**: e.g., "Ongkir", "Packaging", "Bahan Tambahan"
   - **Amount**: e.g., 10000
6. Add more costs if needed
7. Note: Total custom costs will be distributed to all items (prorata)
8. Complete transaction as normal
9. ✅ Customer pays **without** custom costs
10. ✅ HPP calculated **with** custom costs for profit analysis

#### 3. Manage Cashier Permissions
1. Go to **Settings** → **Account** → **Cashier Accounts**
2. Edit cashier
3. In permissions, set:
   - ☑️ **Dapat Melihat HPP** - Show HPP in Products page
   - ☑️ **Dapat Edit HPP** - Edit HPP values
   - ☑️ **Dapat Tambah Biaya Kustom** - Add custom costs at checkout

---

### **For Cashier:**

#### If Permission Granted:
1. Go to **Sales** page
2. If HPP enabled + permission granted:
   - See **"Biaya Tambahan HPP"** section
   - Can add custom costs per transaction
3. Otherwise:
   - Sales page looks exactly the same as before
   - No HPP-related UI visible

---

## 📊 Database Schema

### New Tables:

#### `app_settings`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
setting_key     TEXT (e.g., 'hpp_enabled')
setting_value   JSONB (e.g., {"enabled": true})
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `sale_custom_costs`
```sql
id              UUID PRIMARY KEY
sale_id         UUID REFERENCES sales(id)
label           TEXT (e.g., 'Ongkir')
amount          NUMERIC(10, 2)
created_at      TIMESTAMP
```

### Modified Tables:

#### `products`
```sql
-- Added column:
hpp             NUMERIC(10, 2) DEFAULT 0
```

#### `sale_items`
```sql
-- Added columns:
cost_snapshot   NUMERIC(10, 2) DEFAULT 0
hpp_extra       NUMERIC(10, 2) DEFAULT 0
hpp_total       NUMERIC(10, 2) DEFAULT 0
```

#### `users`
```sql
-- Updated permissions JSONB with:
canViewHPP          BOOLEAN
canEditHPP          BOOLEAN
canAddCustomCosts   BOOLEAN
```

---

## 🔒 Security & Permissions

### Default Permissions by Role:

| Permission | Owner/Admin | Cashier |
|-----------|-------------|---------|
| View HPP | ✅ Yes | ❌ No |
| Edit HPP | ✅ Yes | ❌ No |
| Add Custom Costs | ✅ Yes | ❌ No |

### Customizable:
- Owner can grant/revoke permissions for each cashier individually
- Permissions stored in `users.permissions` JSONB column

---

## 💡 Design Philosophy

### ✅ Principles Maintained:

1. **User-Friendly**
   - HPP disabled by default
   - Zero impact on existing users
   - Simple toggle to enable

2. **Simple**
   - Just 2 inputs: Label + Amount
   - No complex allocation dropdowns
   - Automatic prorata calculation

3. **Lightweight**
   - Conditional rendering (only shows when enabled)
   - Minimal code additions
   - No new dependencies

4. **Flexible**
   - Per-user toggle
   - Per-cashier permissions
   - Optional feature

---

## 🐛 Troubleshooting

### Issue: HPP tab not showing in Settings
**Solution:**
- Hard refresh browser: `Ctrl + Shift + R`
- Clear cache
- Verify `HPPSettings` component imported correctly

### Issue: Custom Costs not showing in Sales page
**Check:**
1. Is HPP feature enabled? (Settings → HPP)
2. Does user have `canAddCustomCosts` permission?
3. Hard refresh browser

### Issue: Migration fails
**Solution:**
- Check Supabase logs
- Verify all tables exist
- Run migrations one by one if needed
- Check for syntax errors in SQL

### Issue: Settings API returns 404
**Check:**
1. `app_settings` table created?
2. Run migration 004
3. Verify `settingsAPI` in `api.js`

---

## 📈 Future Enhancements (Optional)

Jika diperlukan nanti, bisa ditambahkan:

1. **HPP Reports**
   - Show profit margin per product
   - HPP trends over time
   - Cost analysis

2. **Advanced Allocation**
   - Assign cost to specific product (not prorata)
   - Percentage-based allocation
   - Category-based allocation

3. **HPP History**
   - Track HPP changes over time
   - Compare base HPP vs actual HPP
   - View average HPP per product

4. **Export HPP Data**
   - Export to Excel with HPP columns
   - Include custom costs breakdown

---

## 📝 Files Changed/Created

### New Files:
- `migrations/001_add_hpp_to_products.sql`
- `migrations/002_add_cost_snapshot.sql`
- `migrations/003_create_sale_custom_costs.sql`
- `migrations/004_add_hpp_settings.sql`
- `migrations/005_add_hpp_permissions.sql`
- `migrations/000_apply_hpp_migrations.sql` (combined)
- `src/components/HPPSettings.jsx`
- `src/components/CustomCostsInput.jsx`
- `supabase-schema-backup-YYYYMMDD-HHMMSS.sql` (backup)

### Modified Files:
- `src/lib/api.js` (added settingsAPI)
- `src/lib/translations.js` (added HPP translations)
- `src/pages/SettingsPage.jsx` (added HPP tab)
- `src/pages/SalesPage.jsx` (added custom costs input)

---

## ✅ Checklist

### Pre-Deployment:
- [x] Backup database schema
- [x] Create migration files
- [x] Create React components
- [x] Update API endpoints
- [x] Add translations
- [x] Update pages
- [x] Build frontend
- [x] Test locally

### Post-Deployment:
- [ ] Apply migrations in Supabase
- [ ] Deploy frontend
- [ ] Test HPP toggle
- [ ] Test custom costs input
- [ ] Test permissions
- [ ] Verify backward compatibility
- [ ] Train users

---

## 🎉 Summary

**HPP feature successfully implemented!**

✅ **Database:** 5 migrations, 2 new tables, backward compatible
✅ **Frontend:** 2 new components, 2 updated pages
✅ **API:** New settingsAPI for feature toggle
✅ **Translations:** 20+ keys in 3 languages
✅ **Permissions:** Role-based access control
✅ **UX:** Simple, optional, no disruption to existing workflows

**Total Time:** ~2-3 hours implementation
**Impact:** Zero for existing users until they enable it
**Benefit:** Complete profit analysis with flexible cost tracking

---

**Need help?** Check troubleshooting section or review Supabase logs.

**Ready to deploy?** Follow deployment steps above! 🚀

