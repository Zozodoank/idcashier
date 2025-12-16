-- TEST: Cek apakah RLS policies sudah benar-benar berubah
-- Jalankan query ini di Supabase SQL Editor

-- 1. Cek products policies (harus simple, bukan nested)
SELECT 
    policyname,
    cmd,
    LENGTH(qual::text) as qual_length,
    qual::text as condition
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY policyname;

-- 2. Test query performance dengan EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM products
WHERE user_id = auth.uid()
LIMIT 10;

-- 3. Cek apakah ada slow queries yang masih berjalan
SELECT 
    pid,
    now() - query_start as duration,
    state,
    query
FROM pg_stat_activity
WHERE state != 'idle'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
