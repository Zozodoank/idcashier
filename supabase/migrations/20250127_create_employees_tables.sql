-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  base_salary NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create employee_product_shares table
CREATE TABLE IF NOT EXISTS employee_product_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('percentage', 'fixed')),
  share_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, product_id)
);

-- Create profit_shares table
CREATE TABLE IF NOT EXISTS profit_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  share_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add profit share columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS profit_share_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profit_share_type TEXT CHECK (profit_share_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS profit_share_value NUMERIC DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_product_shares_employee_id ON employee_product_shares(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_product_shares_product_id ON employee_product_shares(product_id);
CREATE INDEX IF NOT EXISTS idx_profit_shares_sale_id ON profit_shares(sale_id);
CREATE INDEX IF NOT EXISTS idx_profit_shares_employee_id ON profit_shares(employee_id);
CREATE INDEX IF NOT EXISTS idx_profit_shares_created_at ON profit_shares(created_at);

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_product_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employees
CREATE POLICY "Users can view their own tenant employees"
  ON employees FOR SELECT
  USING (
    tenant_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert employees"
  ON employees FOR INSERT
  WITH CHECK (
    tenant_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can update employees"
  ON employees FOR UPDATE
  USING (
    tenant_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM auth.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete employees"
  ON employees FOR DELETE
  USING (
    tenant_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM auth.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for employee_product_shares
CREATE POLICY "Users can view their tenant employee product shares"
  ON employee_product_shares FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE tenant_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners can manage employee product shares"
  ON employee_product_shares FOR ALL
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE tenant_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- RLS Policies for profit_shares
CREATE POLICY "Users can view their tenant profit shares"
  ON profit_shares FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE tenant_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert profit shares"
  ON profit_shares FOR INSERT
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_updated_at();

