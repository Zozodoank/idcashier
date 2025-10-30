-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    merchant_order_id TEXT UNIQUE NOT NULL,
    product_details TEXT,
    customer_va_name TEXT,
    customer_email TEXT,
    payment_method TEXT,
    reference TEXT,
    status TEXT DEFAULT 'pending',
    payment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_order_id ON payments(merchant_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments" ON payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update payments" ON payments
    FOR UPDATE USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON TABLE payments TO authenticated;
GRANT ALL ON TABLE payments TO service_role;

-- Add status column if it doesn't exist (for compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'status'
    ) THEN
        ALTER TABLE payments ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_name TEXT,
    duration INTEGER, -- in months
    amount NUMERIC(10, 2),
    status TEXT DEFAULT 'inactive',
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update subscriptions" ON subscriptions
    FOR UPDATE USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON TABLE subscriptions TO service_role;
GRANT SELECT ON TABLE subscriptions TO authenticated;

-- Add status column if it doesn't exist (for compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' AND column_name = 'status'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN status TEXT DEFAULT 'inactive';
    END IF;
END $$;