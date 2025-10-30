# Migration Guide: Multi-Tenancy Implementation

## Overview
Migrasi ini menambahkan sistem multi-tenancy untuk mendukung akun kasir yang dapat login dan mengakses data owner mereka.

## Important Note for Empty Databases
Since your database is currently empty, you have two options:

1. **Fresh Start (Recommended)**: Use the new `supabase-schema-with-tenant.sql` file which already includes multi-tenancy support
2. **Migration Approach**: Apply the migration to add tenant_id to the existing schema

For a new/empty database, we recommend using the fresh schema approach as it's simpler and cleaner.

## Option 1: Fresh Start with New Schema (Recommended for Empty Databases)

### 1. Apply the New Schema
```bash
# If psql is available
psql -h your_host -p 5432 -U your_username your_database < supabase-schema-with-tenant.sql

# If psql is not recognized, use full path:
# "C:\Program Files\PostgreSQL\14\bin\psql.exe" -h your_host -p 5432 -U your_username your_database < supabase-schema-with-tenant.sql
```

### 2. Verify Schema
- Check that all tables are created with proper foreign key relationships
- Verify that the `users` table has the `tenant_id` column with proper constraints
- Confirm that the index `idx_users_tenant_id` exists

### 3. Proceed with Code Deployment
- Deploy backend code changes
- Deploy frontend code changes
- No need to clear localStorage as database is empty

## Option 2: Migration Approach (For Databases with Existing Data)

### 1. Backup Database
```bash
# Backup database sebelum migration
pg_dump -h your_host -p 5432 -U your_username your_database > backup_before_tenant_migration.sql
```

#### If `pg_dump` is not recognized:
1. **Find PostgreSQL installation**:
   - Usually in `C:\Program Files\PostgreSQL\[version]\bin\`
   - Or in XAMPP directory if using XAMPP

2. **Use full path**:
```bash
# Example for Windows with PostgreSQL in Program Files
"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" -h your_host -p 5432 -U your_username your_database > backup_before_tenant_migration.sql

# Example for Windows with XAMPP
"C:\xampp\pgsql\bin\pg_dump.exe" -h your_host -p 5432 -U your_username your_database > backup_before_tenant_migration.sql
```

3. **Alternative: Use pgAdmin**:
   - Open pgAdmin
   - Right-click on database
   - Select "Backup..."
   - Save as file .sql

### 2. Run Migration SQL
```bash
# Run migration script
psql -h your_host -p 5432 -U your_username your_database < migration-add-tenant-id.sql
```

#### If `psql` is not recognized:
1. **Use full path**:
```bash
# Example for Windows with PostgreSQL in Program Files
"C:\Program Files\PostgreSQL\14\bin\psql.exe" -h your_host -p 5432 -U your_username your_database < migration-add-tenant-id.sql

# Example for Windows with XAMPP
"C:\xampp\pgsql\bin\psql.exe" -h your_host -p 5432 -U your_username your_database < migration-add-tenant-id.sql
```

2. **Alternative: Copy-paste content**:
   - Open `migration-add-tenant-id.sql` in text editor
   - Copy all content
   - Paste to SQL editor in pgAdmin or other database management tools
   - Execute query

3. **Alternative: Use Supabase Dashboard**:
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Paste content of `migration-add-tenant-id.sql`
   - Run query

### 3. Verify Migration
- Check that `tenant_id` column exists in `users` table
- Check that all existing users have `tenant_id` equal to their `id`
- Check that index `idx_users_tenant_id` exists

**Verification queries**:
```sql
-- Check table structure
\d users;

-- Check that all users have tenant_id = id (for existing data)
SELECT id, tenant_id FROM users WHERE id != tenant_id;

-- Check index
SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_tenant_id';

-- Alternative verification for Supabase/PostgreSQL
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'tenant_id';

SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'users' AND indexname = 'idx_users_tenant_id';
```

## Deployment Steps (Common for Both Approaches)

### 4. Update Backend Code
- Deploy changes in `server/routes/auth.js`, `users.js`, `products.js`, etc.
- Restart backend server

**Backend deployment steps**:
1. Commit and push code changes to repository
2. Deploy to production server
3. Restart application backend:
```bash
# In project directory
npm run server
# or if using process manager like pm2
pm2 restart idcashier
```

### 5. Update Frontend Code
- Deploy changes in `src/pages/SettingsPage.jsx` and `src/contexts/AuthContext.jsx`
- No need to clear localStorage for empty database

**Frontend deployment steps**:
1. Build frontend application:
```bash
npm run build
```
2. Deploy built files to web server
3. Clear CDN cache (if applicable)

### 6. Testing
- Login as owner account
- Create a new cashier account via Settings > Account Management
- Logout and login as cashier
- Verify that cashier can see owner's data (products, sales, etc.)

## Troubleshooting

### PostgreSQL Tools Not Found
1. **Locate PostgreSQL installation**:
   ```bash
   # Windows - search for pg_dump
   dir "C:\Program Files" /s /b | findstr pg_dump.exe
   
   # Or check common locations
   ls "C:\Program Files\PostgreSQL\*" 
   ls "C:\xampp\pgsql\bin\"
   ```

2. **Use full path to tools**:
   ```bash
   # Example paths (adjust version number as needed)
   "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" -h localhost -p 5432 -U username database > backup.sql
   "C:\Program Files\PostgreSQL\14\bin\psql.exe" -h localhost -p 5432 -U username database < migration.sql
   ```

3. **Alternative: Use database management tools**:
   - Copy SQL content from migration files
   - Paste and execute in pgAdmin, DBeaver, or other tools

### Database Connection Issues
- Check host, port, username, and password
- Ensure PostgreSQL service is running
- Check firewall settings

### Migration Script Errors
1. **Column already exists**:
   - The migration may have been partially run
   - Check current table structure: `\d users` in psql
   - Modify migration script to skip existing elements

2. **Foreign key constraint errors**:
   - Ensure users table exists and has proper primary key
   - Check for any data that might violate constraints

3. **Permission denied**:
   - Ensure connecting user has ALTER TABLE permissions
   - Consider using superuser account for migration

### Application Errors After Deployment
1. Check backend logs for any errors
2. Verify environment variables are correctly set
3. Ensure all dependencies are installed
4. Check database connection from application

## Rollback Plan
If issues are encountered:

### For Fresh Schema Approach:
1. Drop and recreate database with original schema
2. Restore from any existing backup if needed
3. Revert code changes

### For Migration Approach:
1. Restore database from backup: 
   ```bash
   # If psql is available
   psql -h your_host -p 5432 -U your_username your_database < backup_before_tenant_migration.sql
   
   # If using full path
   "C:\Program Files\PostgreSQL\14\bin\psql.exe" -h your_host -p 5432 -U your_username your_database < backup_before_tenant_migration.sql
   ```
2. Revert code changes to commit before migration
3. Restart services

## Breaking Changes
- Cashiers stored in localStorage will not work anymore
- Users must recreate cashier accounts through UI after migration
- Since your database is empty, this is not an issue