-- Migration: Add HPP permissions
-- Phase 1.5: Control who can view/edit HPP data
-- Date: 2025-01-25
-- Description: Add HPP-related permissions to existing users

BEGIN;

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

-- Add comment for documentation
COMMENT ON COLUMN users.permissions IS 'User permissions in JSONB format, includes HPP access control';

COMMIT;

