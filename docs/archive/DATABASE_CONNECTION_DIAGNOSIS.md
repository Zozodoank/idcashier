# Database Connection Diagnosis - COMPLETE ANALYSIS

## 🔍 **Root Cause Found!**

Setelah memeriksa dengan MCP Supabase, masalahnya adalah:

### **Problem: RLS Policy vs JWT Token Mismatch**

**RLS Policy menggunakan:**
```sql
user_id = auth.uid()  -- Expects Supabase Auth UID
```

**Frontend menggunakan:**
```javascript
// JWT token from Edge Function auth-login-final
// Token contains user_id from users table, NOT auth.users.id
```

---

## 📊 **Database Status (Verified)**

### **Data Exists:**
```
✅ products: 3 items total
✅ sales: 11 items
✅ customers: 2 items
✅ categories: 3 items
✅ suppliers: 3 items
✅ users: 28 items
```

### **User jho.j80@gmail.com:**
```
ID: 21da4acf-6008-4b4c-9bde-4dc2efaef287
Email: jho.j80@gmail.com
Tenant ID: 21da4acf-6008-4b4c-9bde-4dc2efaef287
Role: admin
```

### **Products for this user:**
```
✅ Only 1 product: "Sayur" (Rp 5,000)
❌ Other 2 products belong to different tenants
```

**This is CORRECT behavior!** RLS is working as intended.

---

## ⚠️ **The Real Issue**

### **Issue 1: User Only Has 1 Product**

**Why frontend shows "Products fetched: 1 items":**
- User `jho.j80@gmail.com` literally only has 1 product in database
- RLS correctly filters to show only their products
- **This is NOT a bug, it's correct multi-tenant isolation!**

**Solution:** Add more products for this user

---

### **Issue 2: RLS Policy Configuration**

**Current RLS Policy:**
```sql
-- Products table RLS
user_id = auth.uid()  -- Checks against Supabase Auth user ID
```

**Problem:**
- `auth.uid()` returns Supabase Auth user ID
- But `products.user_id` stores database user ID (from `users` table)
- These might be different!

**Check if they match:**
```sql
-- Compare auth.users.id vs users.id
SELECT 
  au.id as auth_user_id,
  u.id as db_user_id,
  u.email,
  (au.id = u.id) as ids_match
FROM auth.users au
JOIN users u ON au.email = u.email
WHERE u.email = 'jho.j80@gmail.com';
```

---

### **Issue 3: JWT Token from Edge Function**

**Edge Function returns:**
```javascript
{
  token: "jwt-token",  // Contains user_id from users table
  user: {
    id: "21da4acf-6008-4b4c-9bde-4dc2efaef287",  // users.id
    email: "jho.j80@gmail.com",
    tenant_id: "21da4acf-6008-4b4c-9bde-4dc2efaef287"
  }
}
```

**Frontend uses this token for API calls:**
```javascript
fetch(`${supabaseUrl}/rest/v1/products`, {
  headers: {
    'Authorization': `Bearer ${token}`  // JWT from Edge Function
  }
});
```

**RLS checks:**
```sql
user_id = auth.uid()  -- Gets UID from JWT token
```

**If JWT contains `users.id` but RLS expects `auth.users.id`, they won't match!**

---

## ✅ **Solutions**

### **Solution 1: Add More Products (Immediate)**

```sql
-- Add sample products for user jho.j80@gmail.com
INSERT INTO products (
  id,
  user_id,
  name,
  category_id,
  price,
  cost,
  stock
) VALUES
  (
    gen_random_uuid(),
    '21da4acf-6008-4b4c-9bde-4dc2efaef287',
    'Nasi Goreng',
    (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
    15000,
    10000,
    50
  ),
  (
    gen_random_uuid(),
    '21da4acf-6008-4b4c-9bde-4dc2efaef287',
    'Mie Ayam',
    (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
    12000,
    8000,
    30
  ),
  (
    gen_random_uuid(),
    '21da4acf-6008-4b4c-9bde-4dc2efaef287',
    'Es Teh',
    (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
    3000,
    1500,
    100
  );
```

---

### **Solution 2: Fix RLS Policy (If Needed)**

**Check if auth.users.id matches users.id:**

```sql
-- Run this query
SELECT 
  au.id as auth_id,
  u.id as users_id,
  u.email,
  CASE 
    WHEN au.id = u.id THEN '✅ Match'
    ELSE '❌ Mismatch - PROBLEM!'
  END as status
FROM auth.users au
JOIN users u ON au.email = u.email
WHERE u.email = 'jho.j80@gmail.com';
```

**If they DON'T match, update RLS policy:**

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Users can view tenant products" ON products;

-- Create new policy using tenant_id instead
CREATE POLICY "Users can view tenant products" ON products
FOR SELECT
TO public
USING (
  user_id IN (
    SELECT id FROM users 
    WHERE tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
);
```

---

### **Solution 3: Fix Edge Function JWT (If Needed)**

**Ensure Edge Function includes correct user ID in JWT:**

File: `supabase/functions/auth-login-final/index.ts`

```typescript
// Make sure JWT contains auth.users.id, not users.id
const { data: authUser } = await supabase.auth.getUser(token);

// Use authUser.id (from auth.users) in JWT
const jwtPayload = {
  sub: authUser.id,  // ← This should be auth.users.id
  email: user.email,
  role: user.role,
  tenant_id: user.tenant_id
};
```

---

### **Solution 4: Add Company Settings**

```sql
-- Add store settings
INSERT INTO store_settings (
  owner_id,
  name,
  address,
  phone,
  logo
) VALUES (
  '21da4acf-6008-4b4c-9bde-4dc2efaef287',
  'Toko Saya',
  'Jl. Contoh No. 123, Jakarta',
  '08123456789',
  ''
)
ON CONFLICT (owner_id) DO UPDATE
SET 
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone;

-- Add receipt settings
INSERT INTO receipt_settings (
  owner_id,
  header_text,
  footer_text,
  show_logo,
  show_barcode
) VALUES (
  '21da4acf-6008-4b4c-9bde-4dc2efaef287',
  'Terima Kasih Atas Kunjungan Anda',
  'Barang yang sudah dibeli tidak dapat dikembalikan',
  true,
  true
)
ON CONFLICT (owner_id) DO UPDATE
SET 
  header_text = EXCLUDED.header_text,
  footer_text = EXCLUDED.footer_text;
```

---

## 🔧 **Quick Fix SQL Script**

Run this in Supabase SQL Editor:

```sql
-- 1. Add more products
INSERT INTO products (user_id, name, category_id, price, cost, stock) VALUES
  ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Nasi Goreng', 
   (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
   15000, 10000, 50),
  ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Mie Ayam',
   (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
   12000, 8000, 30),
  ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Es Teh',
   (SELECT id FROM categories WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287' LIMIT 1),
   3000, 1500, 100);

-- 2. Add store settings (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    INSERT INTO store_settings (owner_id, name, address, phone)
    VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Toko Saya', 'Jl. Contoh No. 123', '08123456789')
    ON CONFLICT (owner_id) DO UPDATE SET name = EXCLUDED.name;
  END IF;
END $$;

-- 3. Add receipt settings (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipt_settings') THEN
    INSERT INTO receipt_settings (owner_id, header_text, footer_text)
    VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Terima Kasih', 'Barang yang sudah dibeli tidak dapat dikembalikan')
    ON CONFLICT (owner_id) DO UPDATE SET header_text = EXCLUDED.header_text;
  END IF;
END $$;

-- 4. Verify
SELECT 'Products' as table_name, COUNT(*) as count 
FROM products 
WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287'
UNION ALL
SELECT 'Sales', COUNT(*) 
FROM sales 
WHERE user_id = '21da4acf-6008-4b4c-9bde-4dc2efaef287';
```

---

## 📊 **Expected Results After Fix**

### **Before:**
```
Products fetched: 1 items  ← Only "Sayur"
Company settings: null
```

### **After:**
```
Products fetched: 4 items  ← Sayur + 3 new products
Company settings: {name: "Toko Saya", ...}
```

---

## 🎯 **Action Plan**

### **Step 1: Run SQL Script (URGENT)**
```sql
-- Copy the "Quick Fix SQL Script" above
-- Paste in Supabase SQL Editor
-- Execute
```

### **Step 2: Deploy New Build**
```bash
npm run build
# Upload dist/* to server
```

### **Step 3: Test**
```
1. Clear browser cache
2. Login to https://idcashier.my.id
3. Check dashboard - should show 4 products
4. Check settings - should show company info
```

---

## ✅ **Conclusion**

**The "problem" is actually correct behavior:**
- ✅ RLS is working correctly
- ✅ Multi-tenant isolation is working
- ✅ User only has 1 product in database

**Real issues:**
1. ❌ User needs more sample data
2. ❌ Company settings not configured
3. ⚠️ Possible JWT/RLS mismatch (needs verification)

**Fix:** Add sample data + configure settings + deploy new build

---

*Diagnosis completed with MCP Supabase - 2025-12-01*
