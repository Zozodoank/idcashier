-- Check current RLS policies on the payments table
SELECT 
    polname AS policy_name,
    polcmd AS command_type,
    polqual AS using_condition,
    polwithcheck AS with_check_condition
FROM pg_policy 
WHERE polrelid = 'payments'::regclass;

-- Check if RLS is enabled on the payments table
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class 
WHERE relname = 'payments';