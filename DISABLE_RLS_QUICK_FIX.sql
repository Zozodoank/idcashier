-- QUICK FIX: Disable RLS untuk resolve authentication conflict
-- This matches the original design where RLS is disabled

-- Check current RLS status first
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class 
WHERE relname IN ('users', 'products', 'categories', 'suppliers', 'customers')
    AND relkind = 'r'
ORDER BY relname;

-- Disable RLS on all main tables (quick fix)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class 
WHERE relname IN ('users', 'products', 'categories', 'suppliers', 'customers')
    AND relkind = 'r'
ORDER BY relname;