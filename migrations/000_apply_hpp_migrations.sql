-- ========================================
-- COMBINED HPP MIGRATION - Apply All Changes
-- ========================================
-- Date: 2025-01-25
-- Description: Complete HPP feature implementation
-- 
-- This file combines all 5 HPP migrations:
-- 001_add_hpp_to_products
-- 002_add_cost_snapshot
-- 003_create_sale_custom_costs
-- 004_add_hpp_settings
-- 005_add_hpp_permissions
--
-- Apply this in Supabase SQL Editor:
-- 1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
-- 2. Copy and paste this entire file
-- 3. Click "Run"
-- ========================================

BEGIN;

-- ========================================
-- MIGRATION 001: Add HPP to Products
-- ========================================

-- Add HPP column (keep 'cost' for backward compatibility)
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS hpp NUMERIC(10, 2) DEFAULT 0;

-- Copy existing cost data to hpp if hpp is null or zero
UPDATE products 
SET hpp = cost 
WHERE hpp IS NULL OR hpp = 0;

-- Add comment for documentation
COMMENT ON COLUMN products.hpp IS 'Harga Pokok Penjualan (base cost of goods)';

-- ========================================
-- MIGRATION 002: Add Cost Snapshot to Sale Items
-- ========================================

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
UPDATE sale_items si
SET cost_snapshot = COALESCE(p.cost, 0),
    hpp_total = COALESCE(si.cost_snapshot, p.cost, 0) + COALESCE(si.hpp_extra, 0)
FROM products p
WHERE si.product_id = p.id 
  AND (si.cost_snapshot IS NULL OR si.cost_snapshot = 0);

-- ========================================
-- MIGRATION 003: Create Sale Custom Costs Table
-- ========================================

-- Create custom costs table
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

-- Add comments
COMMENT ON TABLE sale_custom_costs IS 'Custom HPP costs per sale (e.g., delivery, packaging, production costs)';
COMMENT ON COLUMN sale_custom_costs.label IS 'Description of the custom cost (e.g., "Ongkir", "Packaging")';
COMMENT ON COLUMN sale_custom_costs.amount IS 'Amount of the custom cost (will be allocated to sale items)';

-- ========================================
-- MIGRATION 004: Add HPP Settings Table
-- ========================================

-- Create settings table if not exists
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_user_key 
  ON app_settings(user_id, setting_key);

-- Add comments
COMMENT ON TABLE app_settings IS 'User-specific application settings';
COMMENT ON COLUMN app_settings.setting_key IS 'Setting key (e.g., "hpp_enabled")';
COMMENT ON COLUMN app_settings.setting_value IS 'Setting value as JSON (e.g., {"enabled": true})';

-- Add default HPP setting for existing users (disabled by default)
INSERT INTO app_settings (user_id, setting_key, setting_value)
SELECT id, 'hpp_enabled', '{"enabled": false}'::jsonb
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings 
  WHERE app_settings.user_id = users.id 
  AND app_settings.setting_key = 'hpp_enabled'
);

-- ========================================
-- MIGRATION 005: Add HPP Permissions
-- ========================================

-- Update existing users' permissions to include HPP access control
-- By default, owners and admins can access HPP, cashiers cannot
UPDATE users
SET permissions = COALESCE(permissions, '{}'::jsonb) || 
  jsonb_build_object(
    'canViewHPP', CASE WHEN role IN ('owner', 'admin') THEN true ELSE false END,
    'canEditHPP', CASE WHEN role IN ('owner', 'admin') THEN true ELSE false END,
    'canAddCustomCosts', CASE WHEN role IN ('owner', 'admin') THEN true ELSE false END
  )
WHERE permissions IS NULL 
   OR NOT (permissions ? 'canViewHPP');

-- Add comment
COMMENT ON COLUMN users.permissions IS 'User permissions in JSONB format, includes HPP access control';

COMMIT;

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- 
-- ✅ Changes Applied:
-- - Added HPP column to products table
-- - Added cost tracking columns to sale_items
-- - Created sale_custom_costs table
-- - Created app_settings table with HPP toggle
-- - Updated user permissions with HPP access controls
--
-- 🎯 Next Steps:
-- 1. Deploy frontend (npm run build)
-- 2. Test HPP feature toggle in Settings page
-- 3. Test custom costs input in Sales page
-- 4. Verify permissions work correctly for different roles
--
-- 📝 Notes:
-- - HPP feature is disabled by default for all users
-- - Existing data is preserved and backward compatible
-- - No data loss will occur
-- ========================================

