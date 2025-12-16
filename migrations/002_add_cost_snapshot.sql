-- Migration: Add cost snapshot to sale_items
-- Phase 1.2: Track HPP at the time of sale
-- Date: 2025-01-25
-- Description: Add columns to track cost snapshot and additional HPP costs per sale item

BEGIN;

-- Add cost snapshot column
ALTER TABLE sale_items 
  ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC(10, 2) DEFAULT 0;

-- Add additional HPP columns for custom costs
ALTER TABLE sale_items 
  ADD COLUMN IF NOT EXISTS hpp_extra NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE sale_items 
  ADD COLUMN IF NOT EXISTS hpp_total NUMERIC(10, 2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN sale_items.cost_snapshot IS 'Snapshot of product cost/HPP at time of sale';
COMMENT ON COLUMN sale_items.hpp_extra IS 'Additional HPP from custom costs allocated to this item';
COMMENT ON COLUMN sale_items.hpp_total IS 'Total HPP (cost_snapshot + hpp_extra)';

-- Update existing records (backward compatibility)
-- Set cost_snapshot from products.cost for existing sale items
UPDATE sale_items si
SET cost_snapshot = COALESCE(p.cost, 0),
    hpp_total = COALESCE(si.cost_snapshot, p.cost, 0) + COALESCE(si.hpp_extra, 0)
FROM products p
WHERE si.product_id = p.id 
  AND (si.cost_snapshot IS NULL OR si.cost_snapshot = 0);

COMMIT;

