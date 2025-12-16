-- Fix RLS policies for employee_product_shares
-- The existing policies incorrectly reference auth.users.tenant_id which doesn't exist
-- auth.users doesn't have tenant_id - it's in public.users
-- Since auth.uid() matches public.users.id for authenticated users, we can:
-- 1. Check if employees.tenant_id = auth.uid() (for owners)
-- 2. Check if employees.tenant_id = user's tenant_id (for cashiers)

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can view their tenant employee product shares" ON employee_product_shares;
DROP POLICY IF EXISTS "Owners can manage employee product shares" ON employee_product_shares;

-- Create corrected SELECT policy
-- Users can view product shares for employees in their tenant
-- Works for both owners (tenant_id = auth.uid()) and cashiers (tenant_id = their owner's id)
CREATE POLICY "Users can view their tenant employee product shares"
  ON employee_product_shares FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE tenant_id = auth.uid()  -- Owner's tenant
         OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())  -- Cashier's owner's tenant
    )
  );

-- Create corrected INSERT/UPDATE/DELETE policy
-- Owners can manage product shares for employees in their tenant
CREATE POLICY "Owners can manage employee product shares"
  ON employee_product_shares FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE tenant_id = auth.uid()  -- Owner's tenant
         OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())  -- Cashier's owner's tenant
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees 
      WHERE tenant_id = auth.uid()  -- Owner's tenant
         OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())  -- Cashier's owner's tenant
    )
  );

-- Also fix profit_shares policies if they have the same issue
DROP POLICY IF EXISTS "Users can view their tenant profit shares" ON profit_shares;

CREATE POLICY "Users can view their tenant profit shares"
  ON profit_shares FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE tenant_id = auth.uid()  -- Owner's tenant
         OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())  -- Cashier's owner's tenant
    )
  );

