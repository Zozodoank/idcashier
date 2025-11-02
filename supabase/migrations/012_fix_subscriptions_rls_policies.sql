-- Fix RLS policies for subscriptions table to allow Edge Functions to access subscription data
-- This migration adds proper policies for Edge Functions to read subscription data

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON subscriptions;

-- Create updated RLS policies
-- Allow users to view their own subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to insert subscriptions
CREATE POLICY "Service role can insert subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Allow service role to update subscriptions
CREATE POLICY "Service role can update subscriptions" ON subscriptions
    FOR UPDATE USING (auth.role() = 'service_role');

-- Allow authenticated users to view subscriptions (needed for Edge Functions with service role)
CREATE POLICY "Authenticated users can view subscriptions" ON subscriptions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON TABLE subscriptions TO service_role;
GRANT SELECT ON TABLE subscriptions TO authenticated;