-- Fix RLS policies for payments table to support registration flow

-- Enable RLS (if not already enabled)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;
DROP POLICY IF EXISTS "Service role can update payments" ON payments;

-- Create new policies that are more flexible for registration flow
-- Allow authenticated users to view their own payments
CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Allow authenticated users to insert payments for themselves
-- Also allow service role to insert payments (for registration flow)
CREATE POLICY "Users can insert their own payments" ON payments
    FOR INSERT TO authenticated, service_role
    WITH CHECK (
        -- Authenticated users can only insert payments for themselves
        (auth.role() = 'authenticated' AND user_id = auth.uid()) OR
        -- Service role can insert payments with or without user_id (for registration)
        (auth.role() = 'service_role')
    );

-- Allow service role to update payments
CREATE POLICY "Service role can update payments" ON payments
    FOR UPDATE TO service_role
    USING (auth.role() = 'service_role');

-- Allow service role to delete payments (for cleanup if needed)
CREATE POLICY "Service role can delete payments" ON payments
    FOR DELETE TO service_role
    USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payments TO authenticated;
GRANT ALL ON TABLE payments TO service_role;