-- Modify payments table to support registration flow
-- Allow user_id to be NULL initially for registration payments

-- Alter the user_id column to allow NULL values
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;

-- Update the RLS policy to allow NULL user_id for registration payments
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;

-- Create a new policy that allows:
-- 1. Authenticated users to insert payments for themselves
-- 2. Service role to insert payments with or without user_id (for registration)
CREATE POLICY "Users can insert payments" ON payments
    FOR INSERT TO authenticated, service_role
    WITH CHECK (
        -- Authenticated users can only insert payments for themselves
        (auth.role() = 'authenticated' AND user_id = auth.uid()) OR
        -- Service role can insert payments with or without user_id (for registration)
        (auth.role() = 'service_role')
    );

-- Update the select policy to handle NULL user_id
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;

CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT TO authenticated
    USING (
        -- Users can view their own payments
        (user_id = auth.uid()) OR
        -- Service role can view all payments
        (auth.role() = 'service_role')
    );-- Modify payments table to support registration flow
-- Allow user_id to be NULL initially for registration payments

-- Alter the user_id column to allow NULL values
ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;

-- Update the RLS policy to allow NULL user_id for registration payments
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;

-- Create a new policy that allows:
-- 1. Authenticated users to insert payments for themselves
-- 2. Service role to insert payments with or without user_id (for registration)
CREATE POLICY "Users can insert payments" ON payments
    FOR INSERT TO authenticated, service_role
    WITH CHECK (
        -- Authenticated users can only insert payments for themselves
        (auth.role() = 'authenticated' AND user_id = auth.uid()) OR
        -- Service role can insert payments with or without user_id (for registration)
        (auth.role() = 'service_role')
    );

-- Update the select policy to handle NULL user_id
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;

CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT TO authenticated
    USING (
        -- Users can view their own payments
        (user_id = auth.uid()) OR
        -- Service role can view all payments
        (auth.role() = 'service_role')
    );