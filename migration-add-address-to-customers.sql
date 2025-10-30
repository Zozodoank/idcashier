-- Migration to add address column to customers table
-- This fixes the PGRST204 error when creating/updating customers

-- Add address column to customers table (idempotent - safe to run multiple times)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;