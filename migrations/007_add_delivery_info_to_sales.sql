-- Add receiver_name and sender_name columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);
