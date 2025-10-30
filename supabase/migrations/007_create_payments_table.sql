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