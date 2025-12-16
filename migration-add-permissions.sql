-- Add permissions column to users table
-- This column will store JSONB data for cashier permissions
-- Structure: {sales: boolean, products: boolean, reports: boolean}
-- Only used for cashier role, owner role doesn't need permissions

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.permissions IS 'JSONB column storing cashier permissions. Structure: {sales: boolean, products: boolean, reports: boolean}. Only used for cashier role.';