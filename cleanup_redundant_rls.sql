-- Hapus policy redundant yang menyebabkan beban performa tinggi
-- Policy 'Users can access own ...' (ALL) seringkali tumpang tindih dengan policy spesifik tenant/role

-- 1. Categories
DROP POLICY IF EXISTS "Users can access own categories" ON categories;
DROP POLICY IF EXISTS "Users can create own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
-- Sisakan: "Users can view tenant categories", "Users can insert tenant categories", dll.

-- 2. Customers
DROP POLICY IF EXISTS "Users can access own customers" ON customers;
DROP POLICY IF EXISTS "Users can create own customers" ON customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
DROP POLICY IF EXISTS "Users can update own customers" ON customers;

-- 3. Products
DROP POLICY IF EXISTS "Users can access own products" ON products;
DROP POLICY IF EXISTS "Users can create own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;

-- 4. Sales
DROP POLICY IF EXISTS "Users can access own sales" ON sales;
DROP POLICY IF EXISTS "Users can create own sales" ON sales;
DROP POLICY IF EXISTS "Users can delete own sales" ON sales;
DROP POLICY IF EXISTS "Users can update own sales" ON sales;

-- 5. Sale Items
DROP POLICY IF EXISTS "Users can access own sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can create own sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can delete own sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can update own sale_items" ON sale_items;

-- 6. Suppliers
DROP POLICY IF EXISTS "Users can access own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can create own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update own suppliers" ON suppliers;

-- 7. Subscriptions
DROP POLICY IF EXISTS "Users can access own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can create own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;

-- 8. Password Resets
DROP POLICY IF EXISTS "Users can access own password_resets" ON password_resets;
DROP POLICY IF EXISTS "Users can create own password_resets" ON password_resets;
DROP POLICY IF EXISTS "Users can delete own password_resets" ON password_resets;
DROP POLICY IF EXISTS "Users can update own password_resets" ON password_resets;

-- 9. Users
-- Hati-hati dengan users table, pastikan policy sisa masih mengizinkan akses dasar
-- Policy "Allow authenticated users to view own profile" vs "Users can view own profile"
DROP POLICY IF EXISTS "Users can view own profile" ON users;
-- Sisakan "Allow authenticated users to view own profile" atau "Users can view their tenant members"

-- Tambahkan index yang hilang untuk Foreign Keys (rekomendasi Advisor)
CREATE INDEX IF NOT EXISTS idx_attendance_machines_tenant_id ON attendance_machines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_machines_user_id ON attendance_machines(user_id);

-- Optimasi Auth RLS (membungkus auth.uid() dengan SELECT agar tidak re-evaluasi per row)
-- Contoh untuk satu table, idealnya diterapkan ke semua policy yang menggunakan auth.uid()
-- ALTER POLICY "Users can view tenant categories" ON categories 
-- USING ((user_id = (SELECT auth.uid())) OR (user_id = (SELECT users.tenant_id FROM users WHERE users.id = (SELECT auth.uid()))));
