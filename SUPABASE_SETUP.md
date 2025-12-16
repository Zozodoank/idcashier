# Supabase Setup for idCashier

This document explains how to configure your idCashier application to work with Supabase for local development.

## Prerequisites

1. A Supabase account (free tier available at https://supabase.com/)
2. A Supabase project created

## Setup Instructions

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Click on the "Settings" icon in the left sidebar
3. Go to "API" section
4. Copy your "Project URL" and "Project API keys" (use the `anon` key)
5. Also copy your "Service Role Key" which is needed for administrative operations

### 2. Configure Environment Variables

Update your `.env` file with your Supabase credentials and email configuration:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Site URL
VITE_SITE_URL=https://idcashier.my.id
SITE_URL=https://idcashier.my.id

# Email Configuration (for SMTP)
EMAIL_HOST=mail.idcashier.my.id
EMAIL_PORT=465
EMAIL_USER=support@idcashier.my.id
EMAIL_PASSWORD=@Se06070786
```

**Important for Production:**
Set the same environment variables in Supabase Dashboard > Settings > Secrets:
- `EMAIL_PASSWORD` - SMTP password
- `SITE_URL` - Production site URL

### 3. Create Database Tables in Supabase

In your Supabase SQL editor, run the following queries to create the required tables:

```sql
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
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create suppliers table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
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
CREATE TABLE sales (
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
CREATE TABLE sale_items (
  id UUID PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMIT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
```

### 4. Insert Developer Account

After creating the tables, insert your developer account:

```sql
-- Replace 'your-generated-uuid-here' with an actual UUID
-- You can generate a UUID at https://www.uuidgenerator.net/
INSERT INTO users (id, name, email, password, role)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Replace with actual UUID
  'Developer',
  'jho.j80@gmail.com',
  '$2a$10$example_hashed_password',  -- Replace with actual hashed password
  'admin'
);
```

### 5. SMTP Configuration for Email Sending

**Overview:**
The application uses Supabase Auth's built-in SMTP integration for sending emails (password reset, email verification, etc.).

**Configuration Steps:**

1. **SMTP is Pre-configured in `supabase/config.toml`:**
   - Host: `mail.idcashier.my.id`
   - Port: `465` (SSL/TLS)
   - User: `support@idcashier.my.id`
   - Password: Retrieved from `EMAIL_PASSWORD` environment variable

2. **Set Environment Variables in Supabase:**
   - Go to Supabase Dashboard > Settings > Secrets
   - Add secret: `EMAIL_PASSWORD` = `@Se06070786`
   - Add secret: `SITE_URL` = `https://idcashier.my.id`

3. **Verify SMTP Configuration:**
   - SMTP section should be enabled in `supabase/config.toml`:
     ```toml
     [auth.email.smtp]
     enabled = true
     host = "mail.idcashier.my.id"
     port = 465
     user = "support@idcashier.my.id"
     pass = "env(EMAIL_PASSWORD)"
     admin_email = "support@idcashier.my.id"
     sender_name = "idCashier"
     ```

4. **Test Email Sending:**
   - Register a new user to test welcome email (if confirmations enabled)
   - Request password reset to test reset email
   - Check inbox (and spam folder) for emails from support@idcashier.my.id

**Troubleshooting SMTP:**
- **Emails not sent**: Check Supabase logs for SMTP errors
- **Port 465 blocked**: Try port 587 with STARTTLS instead
- **Authentication failed**: Verify EMAIL_PASSWORD is set correctly
- **Emails in spam**: Configure SPF, DKIM, DMARC for domain

**Alternative SMTP Providers:**
If mail.idcashier.my.id is not available, you can configure alternative providers in `supabase/config.toml`:
- Gmail (with App Password)
- SendGrid
- Mailgun
- AWS SES

### 6. Auth Configuration

**Email Confirmation Settings:**

The `auth.email.enable_confirmations` setting in `supabase/config.toml` controls whether users must verify their email before logging in:

- **`enable_confirmations = false`** (Default - Recommended for development):
  - Users can login immediately after registration
  - No email verification required
  - Faster onboarding for users

- **`enable_confirmations = true`** (Recommended for production):
  - Users must click verification link in email before logging in
  - More secure
  - Prevents fake email registrations
  - Requires SMTP to be configured

**To Change the Setting:**
1. Edit `supabase/config.toml`
2. Find line: `enable_confirmations = false`
3. Change to `true` for production or keep `false` for development
4. Restart Supabase services if running locally

**Password Requirements:**
- Minimum length: 6 characters (configured in `supabase/config.toml`)
- No complexity requirements by default
- Can be customized via `password_requirements` setting

**Session Configuration:**
- JWT expiry: 3600 seconds (1 hour)
- Refresh token rotation: Enabled
- Anonymous sign-ins: Disabled

### 7. Edge Functions Secrets

**Required Secrets for Edge Functions:**

Edge Functions (auth-register, auth-login, etc.) require certain environment variables to be set in Supabase:

1. **Go to Supabase Dashboard > Settings > Secrets**

2. **Add the following secrets:**
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)
   - `EMAIL_PASSWORD` - SMTP password for email sending
   - `SITE_URL` - Your site URL for redirect links (https://idcashier.my.id)

3. **Verify Secrets:**
   - Secrets are automatically available as environment variables in Edge Functions
   - Access via `Deno.env.get('SECRET_NAME')`
   - Never hardcode sensitive credentials in Edge Function code

4. **Test Edge Functions:**
   - Deploy Edge Functions: `supabase functions deploy`
   - Test auth-register: POST to `/functions/v1/auth-register`
   - Test auth-login: POST to `/functions/v1/auth-login`
   - Test password reset: POST to `/functions/v1/auth-request-password-reset`

### 8. Enable Row Level Security (Recommended)

For production use, you should enable Row Level Security on your tables and set up appropriate policies.

**With Supabase Auth Integration:**
- RLS can now be enabled since auth.uid() works properly
- Users are authenticated via Supabase Auth
- Policies can reference auth.uid() and user metadata

**Example RLS Policies:**
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own data
CREATE POLICY "Users can view own data" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

-- Multi-tenant: Users can view data in their tenant
CREATE POLICY "Users can view tenant data" 
  ON products FOR SELECT 
  USING (
    user_id IN (
      SELECT id FROM users 
      WHERE tenant_id = (
        SELECT tenant_id FROM users 
        WHERE id = auth.uid()
      )
    )
  );
```

### 9. Update API Implementation (Optional)

The application is now fully integrated with Supabase Auth and Edge Functions. The authentication flow uses:
- `auth-register` Edge Function for user registration
- `auth-login` Edge Function for user login
- `auth-request-password-reset` Edge Function for password reset requests
- `auth-reset-password` Edge Function for password resets

All password management is handled by Supabase Auth, with no passwords stored in the public.users table.

## Running the Application

To run the application with Supabase:

1. Make sure your `.env` file has the correct Supabase credentials and email configuration
2. Verify SMTP is configured in `supabase/config.toml`
3. Set required secrets in Supabase Dashboard
4. Run the development server:
   ```bash
   npm run dev
   ```

This will start the frontend development server on port 3000 (or the configured port).

## Testing the Integration

1. **Test User Registration:**
   - Navigate to DeveloperPage
   - Create a new user
   - Verify user is created in both auth.users and public.users
   - Check that IDs match between tables

2. **Test Login:**
   - Login with newly created user
   - Should authenticate via Supabase Auth
   - No hardcoded password fallback should be used

3. **Test Password Reset:**
   - Request password reset for a user
   - Check Inbucket (local) or email inbox (production) for reset email
   - Click reset link and set new password
   - Login with new password

4. **Test Email Delivery:**
   - For local development: Check http://localhost:54324 (Inbucket)
   - For production: Check actual email inbox (and spam folder)

## Notes

- **Authentication**: Fully integrated with Supabase Auth (no custom password handling)
- **Password Security**: All passwords hashed and stored in auth.users table
- **Email Sending**: Configured with mail.idcashier.my.id SMTP server
- **Schema**: Password field removed from public.users table
- **RLS**: Can now be enabled since auth.uid() works with Supabase Auth
- **Multi-tenant**: User IDs synchronized between auth.users and public.users
- **Edge Functions**: Used for all auth operations (register, login, password reset)

## Troubleshooting

**Common Issues:**

1. **Email not sending:**
   - Check EMAIL_PASSWORD is set in Supabase Secrets
   - Verify SMTP configuration in config.toml
   - Check Supabase logs for errors

2. **User cannot login:**
   - Verify user exists in auth.users
   - Check if email confirmation is required
   - Ensure password meets minimum requirements

3. **Password reset not working:**
   - Check SITE_URL is set correctly
   - Verify resetPasswordForEmail is being called
   - Check email delivery (Inbucket for local, inbox for production)

For more troubleshooting, see `DEPLOYMENT_CHECKLIST.md` and `README.md`.