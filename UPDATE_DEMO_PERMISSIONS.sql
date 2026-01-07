-- UPDATE PERMISSIONS AKUN DEMO
-- Jalankan di Supabase SQL Editor

-- Set full permissions untuk akun demo (sama seperti developer account)
UPDATE users
SET permissions = '{
  "canViewReports": true,
  "canManageProducts": true,
  "canManageCategories": true,
  "canManageSuppliers": true,
  "canManageCustomers": true,
  "canProcessSales": true,
  "canProcessReturns": true,
  "canApplyDiscount": true,
  "canApplyTax": true,
  "canAddCustomCosts": true,
  "canManageRawMaterials": true,
  "canManageRecipes": true,
  "canViewHPP": true,
  "canManageExpenses": true,
  "canManageEmployees": true,
  "canViewProfitShares": true,
  "canManageAttendance": true
}'::jsonb
WHERE email = 'demo@idcashier.com';

-- Verify
SELECT 
    email,
    role,
    permissions
FROM users
WHERE email = 'demo@idcashier.com';
