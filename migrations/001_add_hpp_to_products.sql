-- Migration: Add HPP (Harga Pokok Penjualan) support
-- Phase 1.1: Add HPP columns to products table
-- Date: 2025-01-25
-- Description: Add HPP column to products table for cost of goods tracking

BEGIN;

-- Add HPP column (keep 'cost' for backward compatibility)
-- HPP is the same as cost, but we keep both for clarity
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS hpp NUMERIC(10, 2) DEFAULT 0;

-- Copy existing cost data to hpp if hpp is null or zero
UPDATE products 
SET hpp = cost 
WHERE hpp IS NULL OR hpp = 0;

-- Add comment for documentation
COMMENT ON COLUMN products.hpp IS 'Harga Pokok Penjualan (base cost of goods)';

COMMIT;

