-- Migration: Create table for custom HPP costs
-- Phase 1.3: Allow flexible custom cost entries per sale
-- Date: 2025-01-25
-- Description: Create table to store custom costs like delivery, packaging, etc.

BEGIN;

-- Create custom costs table (simple version)
CREATE TABLE IF NOT EXISTS sale_custom_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sale_custom_costs_sale_id 
  ON sale_custom_costs(sale_id);

-- Add comment for documentation
COMMENT ON TABLE sale_custom_costs IS 'Custom HPP costs per sale (e.g., delivery, packaging, production costs)';
COMMENT ON COLUMN sale_custom_costs.label IS 'Description of the custom cost (e.g., "Ongkir", "Packaging")';
COMMENT ON COLUMN sale_custom_costs.amount IS 'Amount of the custom cost (will be allocated to sale items)';

COMMIT;

