-- Add tenant_id column to users table
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- Migrate existing data: set tenant_id = id for all existing users (they are all owners)
UPDATE users SET tenant_id = id WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after migration
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;