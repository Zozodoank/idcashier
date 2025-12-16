-- RLS Policy Fix untuk User Table
-- Mengatasi error 403 pada user endpoint yang menyebabkan infinite loop

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_select_authenticated" ON users;

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