-- Migration: Add HPP feature toggle settings
-- Phase 1.4: Allow users to enable/disable HPP features
-- Date: 2025-01-25
-- Description: Create settings table and add default HPP setting for all users

BEGIN;

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

-- Add comments for documentation
COMMENT ON TABLE app_settings IS 'User-specific application settings';
COMMENT ON COLUMN app_settings.setting_key IS 'Setting key (e.g., "hpp_enabled")';
COMMENT ON COLUMN app_settings.setting_value IS 'Setting value as JSON (e.g., {"enabled": true})';

-- Add default HPP setting for existing users (disabled by default to not disrupt existing workflows)
INSERT INTO app_settings (user_id, setting_key, setting_value)
SELECT id, 'hpp_enabled', '{"enabled": false}'::jsonb
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings 
  WHERE app_settings.user_id = users.id 
  AND app_settings.setting_key = 'hpp_enabled'
);

COMMIT;

