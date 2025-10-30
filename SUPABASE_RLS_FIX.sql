-- SUPABASE_RLS_FIX.sql
-- This file contains SQL commands to fix RLS (Row Level Security) configuration in Supabase
-- Run this file in Supabase SQL Editor or via MCP server

-- ========================================
-- PART 1: CHECK CURRENT RLS STATUS
-- ========================================

-- Check RLS status for all tables
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class 
WHERE relname IN ('users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions', 'password_resets')
    AND relkind = 'r'
ORDER BY relname;

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions', 'password_resets')
ORDER BY tablename, policyname;

-- ========================================
-- PART 2: OPTION A - DISABLE RLS (QUICK FIX)
-- ========================================
-- This matches the original design in supabase-schema.sql where RLS is disabled
-- because the app uses custom JWT authentication instead of Supabase Auth

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets DISABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 3: OPTION B - ENABLE RLS WITH PROPER POLICIES (RECOMMENDED)
-- ========================================
-- This provides security while avoiding the recursion issues

-- First, enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can delete own profile" ON users;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Anon can select for login" ON users;

DROP POLICY IF EXISTS "Users can access own customers" ON customers;
DROP POLICY IF EXISTS "Service role full access" ON customers;

DROP POLICY IF EXISTS "Users can access own categories" ON categories;
DROP POLICY IF EXISTS "Service role full access" ON categories;

DROP POLICY IF EXISTS "Users can access own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Service role full access" ON suppliers;

DROP POLICY IF EXISTS "Users can access own products" ON products;
DROP POLICY IF EXISTS "Service role full access" ON products;

DROP POLICY IF EXISTS "Users can access own sales" ON sales;
DROP POLICY IF EXISTS "Service role full access" ON sales;

DROP POLICY IF EXISTS "Users can access own sale_items" ON sale_items;
DROP POLICY IF EXISTS "Service role full access" ON sale_items;

DROP POLICY IF EXISTS "Users can access own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access" ON subscriptions;

DROP POLICY IF EXISTS "Users can access own password_resets" ON password_resets;
DROP POLICY IF EXISTS "Service role full access" ON password_resets;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can delete own profile" ON users
    FOR DELETE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Service role full access" ON users
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Anon can select for login" ON users
    FOR SELECT TO anon
    USING (true);

-- Create policies for customers table
CREATE POLICY "Users can access own customers" ON customers
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON customers
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for categories table
CREATE POLICY "Users can access own categories" ON categories
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON categories
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for suppliers table
CREATE POLICY "Users can access own suppliers" ON suppliers
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON suppliers
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for products table
CREATE POLICY "Users can access own products" ON products
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON products
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for sales table
CREATE POLICY "Users can access own sales" ON sales
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON sales
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for sale_items table
CREATE POLICY "Users can access own sale_items" ON sale_items
    FOR ALL TO authenticated
    USING (
        sale_id IN (
            SELECT id FROM sales WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        sale_id IN (
            SELECT id FROM sales WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access" ON sale_items
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for subscriptions table
CREATE POLICY "Users can access own subscriptions" ON subscriptions
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON subscriptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Create policies for password_resets table
CREATE POLICY "Users can access own password_resets" ON password_resets
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access" ON password_resets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);