-- Migration: Fix Users Table RLS Policies
-- Date: 2025-12-02
-- Purpose: Fix infinite loop after payment success caused by 403 errors on user table

BEGIN;

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
DROP POLICY IF EXISTS "users_service_role_all" ON users;

-- Allow users to select their own data
CREATE POLICY "users_select_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow service role to do everything (for edge functions)
CREATE POLICY "users_service_role_all"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant necessary permissions to authenticated role
GRANT SELECT, UPDATE ON users TO authenticated;
GRANT SELECT, UPDATE ON users TO service_role;

-- Also fix any potential RLS issues on subscriptions table
-- Ensure subscriptions policies are correctly set
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_service_role_all" ON subscriptions;

CREATE POLICY "subscriptions_select_own"
ON subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_service_role_all"
ON subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT ON subscriptions TO authenticated;
GRANT ALL ON subscriptions TO service_role;

COMMIT;