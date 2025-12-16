-- Drop existing tables in correct order to avoid foreign key conflicts
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

BEGIN;

-- Create users table
-- Note: Password field has been removed as authentication is now handled by Supabase Auth
-- All user passwords are securely managed by Supabase Auth (auth.users table)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
  tenant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for tenant_id for better performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  price NUMERIC(10, 2) NOT NULL,
  cost NUMERIC(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  barcode VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  discount NUMERIC(10, 2) DEFAULT 0,
  tax NUMERIC(10, 2) DEFAULT 0,
  payment_amount NUMERIC(10, 2) DEFAULT 0,
  change_amount NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create password_resets table for password reset functionality
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMIT;

-- Migration: Drop password column if it exists (for backward compatibility)
-- This is safe to run even if the column doesn't exist
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- NOTE: RLS (Row Level Security) and Supabase Auth Integration
-- This application now uses Supabase Auth for authentication and authorization.
-- All user passwords are securely managed by Supabase Auth (auth.users table).
-- The auth.uid() function can now be used in RLS policies since users are authenticated via Supabase Auth.
--
-- RLS can be enabled for enhanced security. Example policies:
-- 
-- Enable RLS on users table:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--
-- Allow users to view their own data:
-- CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
--
-- Allow users to update their own data:
-- CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
--
-- For multi-tenant setup, policies should check tenant_id:
-- CREATE POLICY "Users can view tenant data" ON products FOR SELECT 
-- USING (user_id IN (SELECT id FROM users WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())));

-- For demo account only, sample data should be inserted through the application
-- This ensures that regular user accounts start with empty databases
-- Sample data will only be loaded for demo@idcashier.my.id account