-- Database backup for idcashier
-- Created on: 2025-11-03
-- Tables: 29

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    permissions JSONB
);

-- Data for table users
INSERT INTO users (id, name, email, role, tenant_id, created_at, updated_at, permissions) VALUES
('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Developer', 'jho.j80@gmail.com', 'admin', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-22 15:56:43.080572', '2025-10-22 15:56:43.080572', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('37db092c-140e-41a0-af9d-bd3b87a83b9a', 'zozo', 'megakomindo@gmail.com', 'owner', '37db092c-140e-41a0-af9d-bd3b87a83b9a', '2025-10-22 17:38:38.984697', '2025-10-22 17:38:38.984697', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('eae32873-5ef8-4251-9764-a5ec92888e46', 'titis', 'projectmandiri10@gmail.com', 'cashier', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-22 17:50:38.890201', '2025-10-22 17:50:38.890201', '{"sales": true, "reports": true, "products": true, "canEditHPP": false, "canViewHPP": false, "canApplyTax": false, "canAddProduct": false, "canAddCustomer": true, "canAddSupplier": false, "canEditProduct": false, "canApplyDiscount": false, "canDeleteProduct": false, "canExportReports": true, "canImportProduct": true, "canAddCustomCosts": false, "canDeleteTransaction": false}'),
('db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'demo', 'demo@gmail.com', 'owner', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', '2025-10-31 17:57:53.659', '2025-10-31 17:57:53.659', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('ecf0741d-e4ae-4de3-bee0-f43d27411366', 'testing', 'testing@idcashier.my.id', 'owner', 'ecf0741d-e4ae-4de3-bee0-f43d27411366', '2025-11-01 09:13:00.331012', '2025-11-01 09:13:00.331012', NULL);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    address TEXT
);

-- Data for table customers
INSERT INTO customers (id, user_id, name, email, phone, created_at, updated_at, address) VALUES
('d0df1d0c-523d-4615-9939-244da40303ab', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'M J Wahyudin', '', '085156861485', '2025-10-22 16:34:52.679276', '2025-10-22 16:34:52.679276', 'Kp. Buaran PLN NO.112 RT.004/RW.004 Kel. Cikokol Kec. Tangerang'),
('5a89ced8-f3ff-42b8-bad9-1baaae491ca9', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'Pelanggan Umum', NULL, NULL, '2025-11-03 04:00:06.903063', '2025-11-03 04:00:06.903063', NULL);

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    category_id UUID,
    supplier_id UUID,
    price NUMERIC,
    cost NUMERIC,
    stock INTEGER DEFAULT 0,
    barcode VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    hpp NUMERIC DEFAULT 0,
    profit_share_enabled BOOLEAN DEFAULT false,
    profit_share_type TEXT,
    profit_share_value NUMERIC DEFAULT 0
);

-- Data for table products
INSERT INTO products (id, user_id, name, category_id, supplier_id, price, cost, stock, barcode, created_at, updated_at, hpp, profit_share_enabled, profit_share_type, profit_share_value) VALUES
('90c9d7d2-59af-4a9b-9b42-4c540f0ce888', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'SOSIS', '3da26c23-5b93-4bd0-91cd-4204821ffd6f', '2a2d6790-2f43-4113-bda4-77728f28e2af', '2000.00', '1500.00', 100, '8999999999999', '2025-11-03 04:00:06.855997', '2025-11-03 04:00:06.855997', '0.00', false, NULL, '0'),
('f65ad85c-6ec7-40b9-81a0-03d662ff9f82', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Sayur', '372472aa-785e-41b0-b90e-c7e66654cc63', 'b52bc979-e162-40dc-981f-387e3894080a', '5000.00', '3000.00', 20, '77876034', '2025-10-26 15:54:31.400118', '2025-10-26 15:54:31.400118', '20.00', false, NULL, '0');

-- Table: sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY,
    user_id UUID,
    customer_id UUID,
    total_amount NUMERIC,
    discount NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    payment_amount NUMERIC DEFAULT 0,
    change_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    payment_status VARCHAR(50) DEFAULT 'paid',
    return_status VARCHAR(50) DEFAULT 'none' CHECK (return_status IN ('none', 'partial', 'full'))
);

-- Data for table sales
INSERT INTO sales (id, user_id, customer_id, total_amount, discount, tax, payment_amount, change_amount, created_at, payment_status, return_status) VALUES
('5ebd78d3-a729-4a27-90e0-87ae13112dca', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 15:55:08.638393', 'paid', 'none'),
('4a75e10f-8e56-471a-8bc9-939b26c7c6c6', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '5000.00', '0.00', '0.00', '5000.00', '0.00', '2025-10-26 17:45:21.994918', 'paid', 'none'),
('c9a2ba49-41ac-468e-b73f-f666a626f1cc', 'eae32873-5ef8-4251-9764-a5ec92888e46', 'd0df1d0c-523d-4615-9939-244da40303ab', '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:05:26.811262', 'paid', 'none'),
('66a1a859-694f-4901-be87-fbc155bfffc0', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:41:18.2632', 'paid', 'none'),
('feeade46-6649-4caf-b616-cfb100365be4', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:41:43.731223', 'paid', 'none'),
('804ed987-3106-426e-9012-1ba80c455be8', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '5000.00', '0.00', '0.00', '5000.00', '0.00', '2025-10-26 19:22:01.021849', 'paid', 'none'),
('06cd2c14-c671-4c49-a774-08e0fa031e4f', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'd0df1d0c-523d-4615-9939-244da40303ab', '25000.00', '0.00', '0.00', '30000.00', '5000.00', '2025-10-27 14:27:58.254019', 'paid', 'none'),
('5a047e01-582c-43af-aeb5-bd188ddf03f2', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '11000.00', '0.00', '10.00', '0.00', '0.00', '2025-10-27 14:30:16.880106', 'unpaid', 'none'),
('13da5f8c-57ca-419b-80da-e8425e8121de', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '11000.00', '0.00', '10.00', '15000.00', '4000.00', '2025-10-27 15:19:37.414516', 'paid', 'none');

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    user_id UUID,
    amount NUMERIC,
    merchant_order_id TEXT UNIQUE,
    product_details TEXT,
    customer_va_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    payment_method TEXT,
    reference TEXT,
    status TEXT DEFAULT 'pending',
    payment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data for table payments
INSERT INTO payments (id, user_id, amount, merchant_order_id, product_details, customer_va_name, customer_email, customer_phone, payment_method, reference, status, payment_url, created_at, updated_at) VALUES
('b48f6ba8-924b-46a7-ae52-fbfd3193a8d1', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '50000.00', 'ORDER-1761846278827-gtxjhogizg@mkzaso.com', 'Langganan 1 bulan', 'zara', 'gtxjhogizg@mkzaso.com', NULL, 'ALL', NULL, 'pending', NULL, '2025-10-30 17:44:41.040421+00', '2025-10-30 17:44:41.040421+00');

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table subscriptions
INSERT INTO subscriptions (id, user_id, start_date, end_date, created_at, updated_at) VALUES
('7d5fe402-3aa8-45d0-8c0e-2b5e65e92baa', 'eae32873-5ef8-4251-9764-a5ec92888e46', '2025-10-25', '2026-04-25', '2025-10-25 04:55:39.561', '2025-10-25 04:55:39.561'),
('80721311-2a02-4e85-b945-3e4ffbed65e0', '37db092c-140e-41a0-af9d-bd3b87a83b9a', '2025-10-25', '2026-10-25', '2025-10-25 04:55:39.94', '2025-10-25 04:55:39.94'),
('22bb2842-3804-482c-a222-edb1943df0f5', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', '2025-10-25', '2026-10-25', '2025-10-25 04:55:40.128', '2025-10-25 04:55:40.128'),
('f0f7587c-9b96-420b-87c0-a22094874b32', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-25', '2026-10-25', '2025-10-25 04:55:40.403', '2025-10-25 04:55:40.403');

-- Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table categories
INSERT INTO categories (id, user_id, name, created_at, updated_at) VALUES
('3da26c23-5b93-4bd0-91cd-4204821ffd6f', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'SNACK', '2025-11-03 04:00:06.818423', '2025-11-03 04:00:06.818423'),
('372472aa-785e-41b0-b90e-c7e66654cc63', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Makanan', '2025-10-26 15:49:13.38185', '2025-10-26 15:49:13.38185'),
('12b2d1e3-f3af-419e-9218-b928f1d1cc41', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Minuman', '2025-10-26 15:52:41.277665', '2025-10-26 15:52:41.277665');

-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    address TEXT,
    phone VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table suppliers
INSERT INTO suppliers (id, user_id, name, address, phone, created_at, updated_at) VALUES
('2a2d6790-2f43-4113-bda4-77728f28e2af', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'PT. BAROKAH', 'Jakarta', '021-000000', '2025-11-03 04:00:06.775537', '2025-11-03 04:00:06.775537'),
('b52bc979-e162-40dc-981f-387e3894080a', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'PT ANTAM', 'Jalan Raya Cilegon', '021557677488', '2025-10-26 15:50:01.84729', '2025-10-26 15:50:01.84729'),
('c7afb31e-ad36-4417-b274-c025db566d55', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'ptgh', 'ghjg', '', '2025-10-26 16:24:46.109983', '2025-10-26 16:24:46.109983');

-- Table: sale_items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY,
    sale_id UUID,
    product_id UUID,
    quantity INTEGER,
    price NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    cost_snapshot NUMERIC DEFAULT 0,
    hpp_extra NUMERIC DEFAULT 0,
    hpp_total NUMERIC DEFAULT 0
);

-- Data for table sale_items
INSERT INTO sale_items (id, sale_id, product_id, quantity, price, created_at, cost_snapshot, hpp_extra, hpp_total) VALUES
('e47c5d15-2575-4ba6-a4dc-83f93171f702', '5ebd78d3-a729-4a27-90e0-87ae13112dca', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 15:55:08.768079', '20.00', '0.00', '20.00'),
('9c5f7efc-2493-4ada-81cd-73bf1ee1a4a4', '4a75e10f-8e56-471a-8bc9-939b26c7c6c6', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 1, '5000.00', '2025-10-26 17:45:22.077383', '20.00', '0.00', '20.00'),
('28615269-d38f-46f9-bc67-dbccaae5a01b', 'c9a2ba49-41ac-468e-b73f-f666a626f1cc', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:05:26.879538', '20.00', '0.00', '20.00'),
('b01dd726-d2fe-49d3-91e5-bd676c61547e', '66a1a859-694f-4901-be87-fbc155bfffc0', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:41:18.384373', '20.00', '0.00', '20.00'),
('295ac437-6072-46cd-bd62-e4c8de210cf6', 'feeade46-6649-4caf-b616-cfb100365be4', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:41:43.804955', '20.00', '0.00', '20.00'),
('ee679a77-70e9-4946-9457-0ae28617fa92', '804ed987-3106-426e-9012-1ba80c455be8', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 1, '5000.00', '2025-10-26 19:22:01.200919', '20.00', '0.00', '20.00'),
('f4ef2afc-8ba7-4039-9e9e-b4d402e77312', '06cd2c14-c671-4c49-a774-08e0fa031e4f', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 5, '5000.00', '2025-10-27 14:27:58.415643', '20.00', '1000.00', '1020.00'),
('eab1c648-5c84-4a50-a149-7b744ada4cbb', '5a047e01-582c-43af-aeb5-bd188ddf03f2', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-27 14:30:16.968181', '20.00', '0.00', '20.00'),
('cd5a9161-0481-4560-b3ae-1219abd9d67e', '13da5f8c-57ca-419b-80da-e8425e8121de', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-27 15:19:37.679496', '20.00', '0.00', '20.00');

-- Table: password_resets
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY,
    user_id UUID,
    token VARCHAR(255),
    expires_at TIMESTAMP,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table password_resets

-- Table: sale_custom_costs
CREATE TABLE IF NOT EXISTS sale_custom_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID,
    label TEXT,
    amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data for table sale_custom_costs
INSERT INTO sale_custom_costs (id, sale_id, label, amount, created_at) VALUES
('85e38599-a599-466f-b19f-9f602f3a3fb1', '06cd2c14-c671-4c49-a774-08e0fa031e4f', 'bensin', '1000.00', '2025-10-27 14:27:58.564203');

-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    setting_key TEXT,
    setting_value JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table app_settings
INSERT INTO app_settings (id, user_id, setting_key, setting_value, created_at, updated_at) VALUES
('a4a2732c-993e-4154-bd0f-e4d680a874f7', '37db092c-140e-41a0-af9d-bd3b87a83b9a', 'hpp_enabled', '{"enabled":false}', '2025-10-25 16:29:23.032947', '2025-10-25 16:29:23.032947'),
('47b9f3f7-3669-4d7e-a538-0980c971e8f4', 'eae32873-5ef8-4251-9764-a5ec92888e46', 'hpp_enabled', '{"enabled":false}', '2025-10-25 16:29:23.032947', '2025-10-25 16:29:23.032947'),
('5bb6ac7c-7b46-46f5-a740-ccdfac871d57', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'hpp_enabled', '{"enabled":true}', '2025-10-25 16:29:23.032947', '2025-10-26 06:16:51.641');

-- Table: product_hpp_breakdown
CREATE TABLE IF NOT EXISTS product_hpp_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID,
    label TEXT,
    amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table product_hpp_breakdown

-- Table: raw_materials
CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT,
    unit TEXT,
    price_per_unit NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table raw_materials
INSERT INTO raw_materials (id, user_id, name, unit, price_per_unit, stock, created_at, updated_at) VALUES
('e45eec36-7944-4e94-81e0-4915bd6228cb', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'kresek', 'pcs', '10.00', '500.000', '2025-10-26 16:25:20.492293', '2025-10-26 16:25:20.492293'),
('9ecf070a-9f1f-4055-b320-e3da186e8059', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Kemasan Plastik', 'pcs', '20.00', '981.000', '2025-10-26 15:51:17.203858', '2025-10-27 15:19:37.953');

-- Table: product_recipes
CREATE TABLE IF NOT EXISTS product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID,
    raw_material_id UUID,
    quantity NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data for table product_recipes
INSERT INTO product_recipes (id, product_id, raw_material_id, quantity, created_at) VALUES
('3e551d46-7253-4c04-92d0-f85939cc5d48', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', '9ecf070a-9f1f-4055-b320-e3da186e8059', '1.000', '2025-10-26 15:54:31.880102');

-- Table: global_hpp
CREATE TABLE IF NOT EXISTS global_hpp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    label TEXT,
    monthly_amount NUMERIC DEFAULT 0,
    month DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table global_hpp
INSERT INTO global_hpp (id, user_id, label, monthly_amount, month, created_at, updated_at) VALUES
('e87bcb15-f98f-43f2-8711-da3082b97097', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Listrik', '100000.00', '2025-10-01', '2025-10-26 15:52:04.020176', '2025-10-26 15:52:03.806');

-- Table: returns
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    sale_id UUID,
    return_type VARCHAR(50) CHECK (return_type IN ('stock', 'loss')),
    reason TEXT,
    total_amount NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- No data for table returns

-- Table: return_items
CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID,
    sale_item_id UUID,
    product_id UUID,
    quantity INTEGER,
    price NUMERIC,
    cost NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table return_items

-- Table: employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    tenant_id UUID,
    name TEXT,
    email TEXT,
    base_salary NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    annual_leave_quota INTEGER DEFAULT 12,
    current_leave_balance INTEGER DEFAULT 12,
    work_schedule JSONB DEFAULT '{"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": false, "thursday": true, "wednesday": true}'
);

-- Data for table employees
INSERT INTO employees (id, user_id, tenant_id, name, email, base_salary, is_active, created_at, updated_at, annual_leave_quota, current_leave_balance, work_schedule) VALUES
('413f6613-2c56-4b34-8a9b-38061d6597b9', 'eae32873-5ef8-4251-9764-a5ec92888e46', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'titis', 'projectmandiri10@gmail.com', '0', true, '2025-10-22 17:50:38.890201+00', '2025-10-29 11:54:38.67335+00', 12, 12, '{"friday":true,"monday":true,"sunday":false,"tuesday":true,"saturday":false,"thursday":true,"wednesday":true}');

-- Table: employee_product_shares
CREATE TABLE IF NOT EXISTS employee_product_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID,
    product_id UUID,
    share_type TEXT CHECK (share_type IN ('percentage', 'fixed')),
    share_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table employee_product_shares

-- Table: profit_shares
CREATE TABLE IF NOT EXISTS profit_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID,
    employee_id UUID,
    product_id UUID,
    quantity INTEGER DEFAULT 1,
    share_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table profit_shares

-- Table: employee_attendance
CREATE TABLE IF NOT EXISTS employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    attendance_date DATE,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    status VARCHAR(50) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_attendance

-- Table: employee_leave_requests
CREATE TABLE IF NOT EXISTS employee_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    leave_type VARCHAR(255),
    start_date DATE,
    end_date DATE,
    total_days INTEGER,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    affects_salary BOOLEAN DEFAULT false,
    affects_profit_share BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_leave_requests

-- Table: employee_salary_adjustments
CREATE TABLE IF NOT EXISTS employee_salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    year INTEGER CHECK (year >= 2020 AND year <= 2100),
    adjustment_type VARCHAR(255),
    amount NUMERIC,
    reason TEXT,
    related_attendance_id UUID,
    related_leave_id UUID,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_salary_adjustments

-- Table: devices
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_serial TEXT UNIQUE,
    tenant_id UUID,
    name TEXT,
    secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table devices

-- Table: device_employee_mappings
CREATE TABLE IF NOT EXISTS device_employee_mappings (
    id BIGINT PRIMARY KEY DEFAULT nextval('device_employee_mappings_id_seq'),
    tenant_id UUID,
    device_id UUID,
    device_employee_id TEXT,
    employee_id UUID,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table device_employee_mappings

-- Table: attendance_logs
CREATE TABLE IF NOT EXISTS attendance_logs (
    id BIGINT PRIMARY KEY DEFAULT nextval('attendance_logs_id_seq'),
    tenant_id UUID,
    device_id UUID,
    device_employee_id TEXT,
    employee_id UUID,
    type TEXT CHECK (type IN ('clock-in', 'clock-out')),
    machine_ts TIMESTAMPTZ,
    ts TIMESTAMPTZ DEFAULT NOW(),
    dedupe_key TEXT UNIQUE,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table attendance_logs

-- Table: expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Database backup for idcashier
-- Created on: 2025-11-03
-- Tables: 29

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    permissions JSONB
);

-- Data for table users
INSERT INTO users (id, name, email, role, tenant_id, created_at, updated_at, permissions) VALUES
('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Developer', 'jho.j80@gmail.com', 'admin', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-22 15:56:43.080572', '2025-10-22 15:56:43.080572', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('37db092c-140e-41a0-af9d-bd3b87a83b9a', 'zozo', 'megakomindo@gmail.com', 'owner', '37db092c-140e-41a0-af9d-bd3b87a83b9a', '2025-10-22 17:38:38.984697', '2025-10-22 17:38:38.984697', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('eae32873-5ef8-4251-9764-a5ec92888e46', 'titis', 'projectmandiri10@gmail.com', 'cashier', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-22 17:50:38.890201', '2025-10-22 17:50:38.890201', '{"sales": true, "reports": true, "products": true, "canEditHPP": false, "canViewHPP": false, "canApplyTax": false, "canAddProduct": false, "canAddCustomer": true, "canAddSupplier": false, "canEditProduct": false, "canApplyDiscount": false, "canDeleteProduct": false, "canExportReports": true, "canImportProduct": true, "canAddCustomCosts": false, "canDeleteTransaction": false}'),
('db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'demo', 'demo@gmail.com', 'owner', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', '2025-10-31 17:57:53.659', '2025-10-31 17:57:53.659', '{"canEditHPP": true, "canViewHPP": true, "canAddCustomCosts": true}'),
('ecf0741d-e4ae-4de3-bee0-f43d27411366', 'testing', 'testing@idcashier.my.id', 'owner', 'ecf0741d-e4ae-4de3-bee0-f43d27411366', '2025-11-01 09:13:00.331012', '2025-11-01 09:13:00.331012', NULL);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    address TEXT
);

-- Data for table customers
INSERT INTO customers (id, user_id, name, email, phone, created_at, updated_at, address) VALUES
('d0df1d0c-523d-4615-9939-244da40303ab', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'M J Wahyudin', '', '085156861485', '2025-10-22 16:34:52.679276', '2025-10-22 16:34:52.679276', 'Kp. Buaran PLN NO.112 RT.004/RW.004 Kel. Cikokol Kec. Tangerang'),
('5a89ced8-f3ff-42b8-bad9-1baaae491ca9', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'Pelanggan Umum', NULL, NULL, '2025-11-03 04:00:06.903063', '2025-11-03 04:00:06.903063', NULL);

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    category_id UUID,
    supplier_id UUID,
    price NUMERIC,
    cost NUMERIC,
    stock INTEGER DEFAULT 0,
    barcode VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    hpp NUMERIC DEFAULT 0,
    profit_share_enabled BOOLEAN DEFAULT false,
    profit_share_type TEXT,
    profit_share_value NUMERIC DEFAULT 0
);

-- Data for table products
INSERT INTO products (id, user_id, name, category_id, supplier_id, price, cost, stock, barcode, created_at, updated_at, hpp, profit_share_enabled, profit_share_type, profit_share_value) VALUES
('90c9d7d2-59af-4a9b-9b42-4c540f0ce888', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'SOSIS', '3da26c23-5b93-4bd0-91cd-4204821ffd6f', '2a2d6790-2f43-4113-bda4-77728f28e2af', '2000.00', '1500.00', 100, '8999999999999', '2025-11-03 04:00:06.855997', '2025-11-03 04:00:06.855997', '0.00', false, NULL, '0'),
('f65ad85c-6ec7-40b9-81a0-03d662ff9f82', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Sayur', '372472aa-785e-41b0-b90e-c7e66654cc63', 'b52bc979-e162-40dc-981f-387e3894080a', '5000.00', '3000.00', 20, '77876034', '2025-10-26 15:54:31.400118', '2025-10-26 15:54:31.400118', '20.00', false, NULL, '0');

-- Table: sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY,
    user_id UUID,
    customer_id UUID,
    total_amount NUMERIC,
    discount NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    payment_amount NUMERIC DEFAULT 0,
    change_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    payment_status VARCHAR(50) DEFAULT 'paid',
    return_status VARCHAR(50) DEFAULT 'none' CHECK (return_status IN ('none', 'partial', 'full'))
);

-- Data for table sales
INSERT INTO sales (id, user_id, customer_id, total_amount, discount, tax, payment_amount, change_amount, created_at, payment_status, return_status) VALUES
('5ebd78d3-a729-4a27-90e0-87ae13112dca', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 15:55:08.638393', 'paid', 'none'),
('4a75e10f-8e56-471a-8bc9-939b26c7c6c6', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '5000.00', '0.00', '0.00', '5000.00', '0.00', '2025-10-26 17:45:21.994918', 'paid', 'none'),
('c9a2ba49-41ac-468e-b73f-f666a626f1cc', 'eae32873-5ef8-4251-9764-a5ec92888e46', 'd0df1d0c-523d-4615-9939-244da40303ab', '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:05:26.811262', 'paid', 'none'),
('66a1a859-694f-4901-be87-fbc155bfffc0', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:41:18.2632', 'paid', 'none'),
('feeade46-6649-4caf-b616-cfb100365be4', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '10000.00', '0.00', '0.00', '10000.00', '0.00', '2025-10-26 18:41:43.731223', 'paid', 'none'),
('804ed987-3106-426e-9012-1ba80c455be8', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '5000.00', '0.00', '0.00', '5000.00', '0.00', '2025-10-26 19:22:01.021849', 'paid', 'none'),
('06cd2c14-c671-4c49-a774-08e0fa031e4f', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'd0df1d0c-523d-4615-9939-244da40303ab', '25000.00', '0.00', '0.00', '30000.00', '5000.00', '2025-10-27 14:27:58.254019', 'paid', 'none'),
('5a047e01-582c-43af-aeb5-bd188ddf03f2', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '11000.00', '0.00', '10.00', '0.00', '0.00', '2025-10-27 14:30:16.880106', 'unpaid', 'none'),
('13da5f8c-57ca-419b-80da-e8425e8121de', '21da4acf-6008-4b4c-9bde-4dc2efaef287', NULL, '11000.00', '0.00', '10.00', '15000.00', '4000.00', '2025-10-27 15:19:37.414516', 'paid', 'none');

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    user_id UUID,
    amount NUMERIC,
    merchant_order_id TEXT UNIQUE,
    product_details TEXT,
    customer_va_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    payment_method TEXT,
    reference TEXT,
    status TEXT DEFAULT 'pending',
    payment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data for table payments
INSERT INTO payments (id, user_id, amount, merchant_order_id, product_details, customer_va_name, customer_email, customer_phone, payment_method, reference, status, payment_url, created_at, updated_at) VALUES
('b48f6ba8-924b-46a7-ae52-fbfd3193a8d1', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '50000.00', 'ORDER-1761846278827-gtxjhogizg@mkzaso.com', 'Langganan 1 bulan', 'zara', 'gtxjhogizg@mkzaso.com', NULL, 'ALL', NULL, 'pending', NULL, '2025-10-30 17:44:41.040421+00', '2025-10-30 17:44:41.040421+00');

-- Table: subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table subscriptions
INSERT INTO subscriptions (id, user_id, start_date, end_date, created_at, updated_at) VALUES
('7d5fe402-3aa8-45d0-8c0e-2b5e65e92baa', 'eae32873-5ef8-4251-9764-a5ec92888e46', '2025-10-25', '2026-04-25', '2025-10-25 04:55:39.561', '2025-10-25 04:55:39.561'),
('80721311-2a02-4e85-b945-3e4ffbed65e0', '37db092c-140e-41a0-af9d-bd3b87a83b9a', '2025-10-25', '2026-10-25', '2025-10-25 04:55:39.94', '2025-10-25 04:55:39.94'),
('22bb2842-3804-482c-a222-edb1943df0f5', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', '2025-10-25', '2026-10-25', '2025-10-25 04:55:40.128', '2025-10-25 04:55:40.128'),
('f0f7587c-9b96-420b-87c0-a22094874b32', '21da4acf-6008-4b4c-9bde-4dc2efaef287', '2025-10-25', '2026-10-25', '2025-10-25 04:55:40.403', '2025-10-25 04:55:40.403');

-- Table: categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table categories
INSERT INTO categories (id, user_id, name, created_at, updated_at) VALUES
('3da26c23-5b93-4bd0-91cd-4204821ffd6f', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'SNACK', '2025-11-03 04:00:06.818423', '2025-11-03 04:00:06.818423'),
('372472aa-785e-41b0-b90e-c7e66654cc63', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Makanan', '2025-10-26 15:49:13.38185', '2025-10-26 15:49:13.38185'),
('12b2d1e3-f3af-419e-9218-b928f1d1cc41', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Minuman', '2025-10-26 15:52:41.277665', '2025-10-26 15:52:41.277665');

-- Table: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY,
    user_id UUID,
    name VARCHAR(255),
    address TEXT,
    phone VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table suppliers
INSERT INTO suppliers (id, user_id, name, address, phone, created_at, updated_at) VALUES
('2a2d6790-2f43-4113-bda4-77728f28e2af', 'db573d3c-acc4-4d8e-a37a-13653d1e70b8', 'PT. BAROKAH', 'Jakarta', '021-000000', '2025-11-03 04:00:06.775537', '2025-11-03 04:00:06.775537'),
('b52bc979-e162-40dc-981f-387e3894080a', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'PT ANTAM', 'Jalan Raya Cilegon', '021557677488', '2025-10-26 15:50:01.84729', '2025-10-26 15:50:01.84729'),
('c7afb31e-ad36-4417-b274-c025db566d55', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'ptgh', 'ghjg', '', '2025-10-26 16:24:46.109983', '2025-10-26 16:24:46.109983');

-- Table: sale_items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY,
    sale_id UUID,
    product_id UUID,
    quantity INTEGER,
    price NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    cost_snapshot NUMERIC DEFAULT 0,
    hpp_extra NUMERIC DEFAULT 0,
    hpp_total NUMERIC DEFAULT 0
);

-- Data for table sale_items
INSERT INTO sale_items (id, sale_id, product_id, quantity, price, created_at, cost_snapshot, hpp_extra, hpp_total) VALUES
('e47c5d15-2575-4ba6-a4dc-83f93171f702', '5ebd78d3-a729-4a27-90e0-87ae13112dca', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 15:55:08.768079', '20.00', '0.00', '20.00'),
('9c5f7efc-2493-4ada-81cd-73bf1ee1a4a4', '4a75e10f-8e56-471a-8bc9-939b26c7c6c6', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 1, '5000.00', '2025-10-26 17:45:22.077383', '20.00', '0.00', '20.00'),
('28615269-d38f-46f9-bc67-dbccaae5a01b', 'c9a2ba49-41ac-468e-b73f-f666a626f1cc', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:05:26.879538', '20.00', '0.00', '20.00'),
('b01dd726-d2fe-49d3-91e5-bd676c61547e', '66a1a859-694f-4901-be87-fbc155bfffc0', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:41:18.384373', '20.00', '0.00', '20.00'),
('295ac437-6072-46cd-bd62-e4c8de210cf6', 'feeade46-6649-4caf-b616-cfb100365be4', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-26 18:41:43.804955', '20.00', '0.00', '20.00'),
('ee679a77-70e9-4946-9457-0ae28617fa92', '804ed987-3106-426e-9012-1ba80c455be8', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 1, '5000.00', '2025-10-26 19:22:01.200919', '20.00', '0.00', '20.00'),
('f4ef2afc-8ba7-4039-9e9e-b4d402e77312', '06cd2c14-c671-4c49-a774-08e0fa031e4f', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 5, '5000.00', '2025-10-27 14:27:58.415643', '20.00', '1000.00', '1020.00'),
('eab1c648-5c84-4a50-a149-7b744ada4cbb', '5a047e01-582c-43af-aeb5-bd188ddf03f2', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-27 14:30:16.968181', '20.00', '0.00', '20.00'),
('cd5a9161-0481-4560-b3ae-1219abd9d67e', '13da5f8c-57ca-419b-80da-e8425e8121de', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', 2, '5000.00', '2025-10-27 15:19:37.679496', '20.00', '0.00', '20.00');

-- Table: password_resets
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY,
    user_id UUID,
    token VARCHAR(255),
    expires_at TIMESTAMP,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table password_resets

-- Table: sale_custom_costs
CREATE TABLE IF NOT EXISTS sale_custom_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID,
    label TEXT,
    amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data for table sale_custom_costs
INSERT INTO sale_custom_costs (id, sale_id, label, amount, created_at) VALUES
('85e38599-a599-466f-b19f-9f602f3a3fb1', '06cd2c14-c671-4c49-a774-08e0fa031e4f', 'bensin', '1000.00', '2025-10-27 14:27:58.564203');

-- Table: app_settings
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    setting_key TEXT,
    setting_value JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table app_settings
INSERT INTO app_settings (id, user_id, setting_key, setting_value, created_at, updated_at) VALUES
('a4a2732c-993e-4154-bd0f-e4d680a874f7', '37db092c-140e-41a0-af9d-bd3b87a83b9a', 'hpp_enabled', '{"enabled":false}', '2025-10-25 16:29:23.032947', '2025-10-25 16:29:23.032947'),
('47b9f3f7-3669-4d7e-a538-0980c971e8f4', 'eae32873-5ef8-4251-9764-a5ec92888e46', 'hpp_enabled', '{"enabled":false}', '2025-10-25 16:29:23.032947', '2025-10-25 16:29:23.032947'),
('5bb6ac7c-7b46-46f5-a740-ccdfac871d57', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'hpp_enabled', '{"enabled":true}', '2025-10-25 16:29:23.032947', '2025-10-26 06:16:51.641');

-- Table: product_hpp_breakdown
CREATE TABLE IF NOT EXISTS product_hpp_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID,
    label TEXT,
    amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table product_hpp_breakdown

-- Table: raw_materials
CREATE TABLE IF NOT EXISTS raw_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT,
    unit TEXT,
    price_per_unit NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table raw_materials
INSERT INTO raw_materials (id, user_id, name, unit, price_per_unit, stock, created_at, updated_at) VALUES
('e45eec36-7944-4e94-81e0-4915bd6228cb', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'kresek', 'pcs', '10.00', '500.000', '2025-10-26 16:25:20.492293', '2025-10-26 16:25:20.492293'),
('9ecf070a-9f1f-4055-b320-e3da186e8059', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Kemasan Plastik', 'pcs', '20.00', '981.000', '2025-10-26 15:51:17.203858', '2025-10-27 15:19:37.953');

-- Table: product_recipes
CREATE TABLE IF NOT EXISTS product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID,
    raw_material_id UUID,
    quantity NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Data for table product_recipes
INSERT INTO product_recipes (id, product_id, raw_material_id, quantity, created_at) VALUES
('3e551d46-7253-4c04-92d0-f85939cc5d48', 'f65ad85c-6ec7-40b9-81a0-03d662ff9f82', '9ecf070a-9f1f-4055-b320-e3da186e8059', '1.000', '2025-10-26 15:54:31.880102');

-- Table: global_hpp
CREATE TABLE IF NOT EXISTS global_hpp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    label TEXT,
    monthly_amount NUMERIC DEFAULT 0,
    month DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Data for table global_hpp
INSERT INTO global_hpp (id, user_id, label, monthly_amount, month, created_at, updated_at) VALUES
('e87bcb15-f98f-43f2-8711-da3082b97097', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Listrik', '100000.00', '2025-10-01', '2025-10-26 15:52:04.020176', '2025-10-26 15:52:03.806');

-- Table: returns
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    sale_id UUID,
    return_type VARCHAR(50) CHECK (return_type IN ('stock', 'loss')),
    reason TEXT,
    total_amount NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- No data for table returns

-- Table: return_items
CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID,
    sale_item_id UUID,
    product_id UUID,
    quantity INTEGER,
    price NUMERIC,
    cost NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table return_items

-- Table: employees
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    tenant_id UUID,
    name TEXT,
    email TEXT,
    base_salary NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    annual_leave_quota INTEGER DEFAULT 12,
    current_leave_balance INTEGER DEFAULT 12,
    work_schedule JSONB DEFAULT '{"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": false, "thursday": true, "wednesday": true}'
);

-- Data for table employees
INSERT INTO employees (id, user_id, tenant_id, name, email, base_salary, is_active, created_at, updated_at, annual_leave_quota, current_leave_balance, work_schedule) VALUES
('413f6613-2c56-4b34-8a9b-38061d6597b9', 'eae32873-5ef8-4251-9764-a5ec92888e46', '21da4acf-6008-4b4c-9bde-4dc2efaef287', 'titis', 'projectmandiri10@gmail.com', '0', true, '2025-10-22 17:50:38.890201+00', '2025-10-29 11:54:38.67335+00', 12, 12, '{"friday":true,"monday":true,"sunday":false,"tuesday":true,"saturday":false,"thursday":true,"wednesday":true}');

-- Table: employee_product_shares
CREATE TABLE IF NOT EXISTS employee_product_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID,
    product_id UUID,
    share_type TEXT CHECK (share_type IN ('percentage', 'fixed')),
    share_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table employee_product_shares

-- Table: profit_shares
CREATE TABLE IF NOT EXISTS profit_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID,
    employee_id UUID,
    product_id UUID,
    quantity INTEGER DEFAULT 1,
    share_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table profit_shares

-- Table: employee_attendance
CREATE TABLE IF NOT EXISTS employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    attendance_date DATE,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    status VARCHAR(50) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_attendance

-- Table: employee_leave_requests
CREATE TABLE IF NOT EXISTS employee_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    leave_type VARCHAR(255),
    start_date DATE,
    end_date DATE,
    total_days INTEGER,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMP,
    affects_salary BOOLEAN DEFAULT false,
    affects_profit_share BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_leave_requests

-- Table: employee_salary_adjustments
CREATE TABLE IF NOT EXISTS employee_salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    year INTEGER CHECK (year >= 2020 AND year <= 2100),
    adjustment_type VARCHAR(255),
    amount NUMERIC,
    reason TEXT,
    related_attendance_id UUID,
    related_leave_id UUID,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- No data for table employee_salary_adjustments

-- Table: devices
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_serial TEXT UNIQUE,
    tenant_id UUID,
    name TEXT,
    secret TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table devices

-- Table: device_employee_mappings
CREATE TABLE IF NOT EXISTS device_employee_mappings (
    id BIGINT PRIMARY KEY DEFAULT nextval('device_employee_mappings_id_seq'),
    tenant_id UUID,
    device_id UUID,
    device_employee_id TEXT,
    employee_id UUID,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table device_employee_mappings

-- Table: attendance_logs
CREATE TABLE IF NOT EXISTS attendance_logs (
    id BIGINT PRIMARY KEY DEFAULT nextval('attendance_logs_id_seq'),
    tenant_id UUID,
    device_id UUID,
    device_employee_id TEXT,
    employee_id UUID,
    type TEXT CHECK (type IN ('clock-in', 'clock-out')),
    machine_ts TIMESTAMPTZ,
    ts TIMESTAMPTZ DEFAULT NOW(),
    dedupe_key TEXT UNIQUE,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table attendance_logs

-- Table: expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table expense_categories

-- Table: expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    expense_number BIGINT DEFAULT nextval('expenses_expense_number_seq'),
    date TIMESTAMPTZ DEFAULT NOW(),
    expense_type TEXT,
    category_id UUID,
    amount NUMERIC CHECK (amount >= 0),
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No data for table expenses