-- ========================================
-- MIGRATION 006: Add RLS Policies for HPP Tables
-- ========================================
-- Date: 2025-01-29
-- Description: Add Row Level Security policies for HPP-related tables
-- 
-- This migration adds RLS policies for:
-- - app_settings
-- - sale_custom_costs  
-- - employee_product_shares
-- ========================================

BEGIN;

-- ========================================
-- Enable RLS on HPP Tables
-- ========================================

-- Enable RLS on app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sale_custom_costs
ALTER TABLE sale_custom_costs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on employee_product_shares (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_product_shares') THEN
    ALTER TABLE employee_product_shares ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ========================================
-- RLS Policies for app_settings
-- ========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON app_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON app_settings;

-- Policy: Users can view their own settings
CREATE POLICY "Users can view own settings"
ON app_settings FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
ON app_settings FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
ON app_settings FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own settings
CREATE POLICY "Users can delete own settings"
ON app_settings FOR DELETE
USING (user_id = auth.uid());

-- ========================================
-- RLS Policies for sale_custom_costs
-- ========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view tenant custom costs" ON sale_custom_costs;
DROP POLICY IF EXISTS "Users can insert tenant custom costs" ON sale_custom_costs;
DROP POLICY IF EXISTS "Users can update tenant custom costs" ON sale_custom_costs;
DROP POLICY IF EXISTS "Users can delete tenant custom costs" ON sale_custom_costs;

-- Policy: Users can view custom costs for sales in their tenant
CREATE POLICY "Users can view tenant custom costs"
ON sale_custom_costs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())
  )
);

-- Policy: Users can insert custom costs for their tenant's sales
CREATE POLICY "Users can insert tenant custom costs"
ON sale_custom_costs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())
  )
);

-- Policy: Users can update custom costs for their tenant's sales
CREATE POLICY "Users can update tenant custom costs"
ON sale_custom_costs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())
  )
);

-- Policy: Users can delete custom costs for their tenant's sales
CREATE POLICY "Users can delete tenant custom costs"
ON sale_custom_costs FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())
  )
);

-- ========================================
-- RLS Policies for employee_product_shares (if table exists)
-- ========================================

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_product_shares') THEN
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view tenant employee shares" ON employee_product_shares;
    DROP POLICY IF EXISTS "Users can insert tenant employee shares" ON employee_product_shares;
    DROP POLICY IF EXISTS "Users can update tenant employee shares" ON employee_product_shares;
    DROP POLICY IF EXISTS "Users can delete tenant employee shares" ON employee_product_shares;
    
    -- Policy: Users can view employee shares for their tenant
    CREATE POLICY "Users can view tenant employee shares"
    ON employee_product_shares FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_product_shares.employee_id
        AND e.tenant_id IN (
          SELECT id FROM users WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    );
    
    -- Policy: Users can insert employee shares for their tenant
    CREATE POLICY "Users can insert tenant employee shares"
    ON employee_product_shares FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_product_shares.employee_id
        AND e.tenant_id IN (
          SELECT id FROM users WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    );
    
    -- Policy: Users can update employee shares for their tenant
    CREATE POLICY "Users can update tenant employee shares"
    ON employee_product_shares FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_product_shares.employee_id
        AND e.tenant_id IN (
          SELECT id FROM users WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_product_shares.employee_id
        AND e.tenant_id IN (
          SELECT id FROM users WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    );
    
    -- Policy: Users can delete employee shares for their tenant
    CREATE POLICY "Users can delete tenant employee shares"
    ON employee_product_shares FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = employee_product_shares.employee_id
        AND e.tenant_id IN (
          SELECT id FROM users WHERE id = auth.uid()
          UNION
          SELECT tenant_id FROM users WHERE id = auth.uid()
        )
      )
    );
    
  END IF;
END $$;

COMMIT;

-- ========================================
-- MIGRATION COMPLETE!
-- ========================================
-- 
-- ✅ RLS Policies Added For:
-- - app_settings (user can only access their own settings)
-- - sale_custom_costs (tenant-level access)
-- - employee_product_shares (tenant-level access)
--
-- 🎯 Next Steps:
-- 1. Apply this migration in Supabase SQL Editor
-- 2. Test that 403/406 errors are resolved
-- 3. Verify data access works correctly
-- ========================================

