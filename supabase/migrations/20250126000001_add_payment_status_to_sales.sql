-- Add payment_status column to sales table
-- This migration adds support for credit transactions

-- Add payment_status column (paid, unpaid, partial)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- Add comment to document the column
COMMENT ON COLUMN sales.payment_status IS 'Payment status: paid (tunai/lunas), unpaid (kredit belum bayar), partial (sebagian)';

-- Update existing records to have 'paid' status
UPDATE sales SET payment_status = 'paid' WHERE payment_status IS NULL;

-- Set NOT NULL constraint after updating existing records
ALTER TABLE sales ALTER COLUMN payment_status SET NOT NULL;

