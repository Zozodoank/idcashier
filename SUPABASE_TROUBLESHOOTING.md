# Supabase Troubleshooting Guide

This document provides solutions for common issues you might encounter when setting up Supabase with the idCashier application.

## Common Issues and Solutions

### 1. "supabase-schema.sql sudah saya run di query supabase dan masih error"

This is the issue you're currently experiencing. Here are the possible causes and solutions:

#### Cause 1: Existing Tables with Conflicting Structures
**Solution**: Use the reset script to completely wipe the database:
```bash
npm run supabase:reset-db
```

#### Cause 2: Mixed Primary Key Types
**Solution**: Ensure all tables use UUID primary keys consistently. The updated schema in `supabase-schema.sql` now uses UUID for all tables.

#### Cause 3: Foreign Key Constraint Violations
**Solution**: The updated schema ensures all foreign key references use the same data types.

#### Cause 4: Missing 'admin' Role
**Solution**: The updated schema includes 'admin' in the role constraint.

### 2. "Connection refused" or "Invalid credentials" errors

#### Solution:
1. Verify your Supabase URL and API keys in the `.env` file
2. Ensure you're using the correct Service Role Key for administrative operations
3. Check that your Supabase project is active

### 3. "RPC function not found" error

#### Cause: 
The free tier of Supabase doesn't support the `execute_sql` RPC function used in our scripts.

#### Solution:
1. Manually copy and paste the SQL statements from `supabase-schema.sql` into your Supabase SQL editor
2. Execute each statement individually
3. Run the statements in the correct order to avoid foreign key constraint issues

### 4. "Role 'admin' does not exist" error

#### Cause:
The original schema only allowed 'owner' and 'cashier' roles.

#### Solution:
The updated schema now includes 'admin' in the role constraint:
```sql
role VARCHAR(20) DEFAULT 'owner' CHECK (role IN ('owner', 'cashier', 'admin'))
```

### 5. "Foreign key constraint violation" errors

#### Cause:
Mixed data types between primary keys and foreign keys.

#### Solution:
All tables now use UUID primary keys consistently:
- Users table: UUID primary key
- All other tables: UUID primary keys
- All foreign key references: UUID type

### 6. "Table already exists" errors

#### Solution:
Use the reset script which drops all tables in the correct order:
```bash
npm run supabase:reset-db
```

## Manual Setup Process

If the automated scripts don't work, follow this manual process:

### Step 1: Reset Database
In your Supabase SQL editor, run these statements in order:
```sql
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### Step 2: Create Tables
Copy the contents of `supabase-schema.sql` and run each CREATE TABLE statement.

### Step 3: Insert Developer Account
Copy the contents of `insert-developer.sql` and run the INSERT statement.

## Testing Your Setup

### 1. Test Connection
```bash
npm run supabase:test-connection
```

### 2. Verify Tables
In your Supabase dashboard, check that all tables have been created with the correct structure.

### 3. Test Data Operations
Try inserting a test record in one of the tables to verify write operations work.

## Additional Notes

1. Always backup your data before running reset operations
2. The application is designed to work with UUID primary keys for all tables
3. Row Level Security should be enabled in production environments
4. For production use, implement proper password hashing with bcrypt
5. Monitor your Supabase usage to stay within plan limits

## Getting Help

If you continue to experience issues:

1. Check the Supabase dashboard for error logs
2. Verify your environment variables are set correctly
3. Ensure you're using the latest version of the schema files
4. Contact Supabase support if you believe there's an issue with your project