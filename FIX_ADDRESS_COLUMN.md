# Fix for Missing Address Column in Customers Table

## Problem Description

When trying to create or update customers in the application, you may encounter a `PGRST204` error indicating that the `address` column is missing from the `customers` table in your Supabase database.

This error occurs because the database schema file used to create your database (`supabase-schema.sql`) is missing the `address` column in the `customers` table definition, while the application code (both frontend and backend) expects this column to exist.

## Root Cause

There are two schema files in the project:
1. `supabase-schema.sql` - Missing the address column (used for initial setup)
2. `supabase-schema-with-tenant.sql` - Includes the address column

This inconsistency causes the application code to reference a column that doesn't exist in the database.

## Solution

Apply a database migration to add the missing `address` column to the `customers` table, then standardize on a single schema file.

## Step-by-Step Fix

### 1. Apply the Migration

Run the migration to add the address column to your existing database:

**On Windows:**
```
apply-address-migration.bat
```

**On Mac/Linux or if the batch file doesn't work:**
```
node apply-address-migration.js
```

This script will:
1. Attempt to automatically apply the migration using the Supabase API
2. If automatic application fails (which is expected in many cases), provide detailed instructions for manual application

The SQL command that will be executed is:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
```

### 2. Manual Application (if automatic fails)

If the automatic application doesn't work, follow these steps:

1. Open your Supabase Dashboard:
   - Go to https://app.supabase.com
   - Sign in to your account
   - Select your project

2. Navigate to the SQL Editor:
   - In the left sidebar, click on "SQL Editor"
   - Click on "New query"

3. Copy and paste the following SQL into the editor:
```sql
-- Migration to add address column to customers table
-- This fixes the PGRST204 error when creating/updating customers

-- Add address column to customers table (idempotent - safe to run multiple times)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
```

4. Execute the query:
   - Click the "Run" button

5. Verify the migration was successful:
   - You should see a message indicating the query was executed successfully
   - The customers table now has an address column

### 3. Verify the Fix

Run the verification script to confirm the column was added successfully:

**On Windows:**
```
verify-address-column.bat
```

**On Mac/Linux or if the batch file doesn't work:**
```
node verify-address-column.js
```

You should see output similar to:
```
Verifying address column in customers table...
✅ Address column exists and is accessible
Testing insert with address column...
✅ Address column can be used in INSERT operations
✅ Verification completed successfully!
The address column has been successfully added to the customers table.
```

**Note:** If you encounter connection errors when running the verification script, it may be due to network issues or invalid credentials in your .env file. In this case, you can manually verify the fix by:

1. Going to your Supabase Dashboard
2. Navigating to the Table Editor
3. Opening the "customers" table
4. Checking if the "address" column exists

### 4. Test the Application

1. Start your application
2. Navigate to the Settings page
3. Try to create or update a customer
4. Confirm that the operation completes successfully without errors

## Troubleshooting

### If you still get PGRST204 errors:

1. Make sure you've run the migration script or manually applied the SQL
2. Check that your Supabase connection details in `server/config/supabase.js` are correct
3. Verify that your database URL, service key, and JWT secret are properly configured

### If the verification script fails:

1. Check the error message for details
2. Ensure your Supabase credentials are correct in `server/config/supabase.js`
3. Make sure your database is accessible and the customers table exists
4. Try manually verifying through the Supabase dashboard as described above

### If you encounter connection errors:

1. Verify your internet connection
2. Check that the Supabase credentials in your .env file are correct
3. Ensure that your Supabase project is active and accessible
4. Try manually applying the migration through the Supabase dashboard

## Schema Files

The `supabase-schema.sql` file has been updated to include the address column to match the structure in `supabase-schema-with-tenant.sql`. Going forward, this will be the source of truth for the database schema.

## Additional Notes

- The migration is idempotent (safe to run multiple times)
- No existing data will be lost or modified
- The address column will be added with a TEXT data type to match the frontend implementation
- The column is optional and defaults to NULL, so it won't affect existing customers