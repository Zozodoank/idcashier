# Deployment Checklist: Multi-Tenancy Implementation

## Pre-Deployment

### Email Configuration
- [ ] Set EMAIL_HOST in Supabase Secrets (Supabase Dashboard > Settings > Secrets)
- [ ] Set EMAIL_PORT in Supabase Secrets (use 465 for SSL/TLS)
- [ ] Set EMAIL_USER in Supabase Secrets (support@idcashier.my.id)
- [ ] Set EMAIL_PASSWORD in Supabase Secrets
- [ ] Verify SMTP configuration in `supabase/config.toml` (should be enabled)
- [ ] Test email sending with password reset functionality
- [ ] Verify emails are received (check spam folder if necessary)

### Supabase Auth Setup
- [ ] Verify `auth.email.enable_confirmations` setting in `supabase/config.toml`
  - Set to `false` if users should be able to login immediately after registration
  - Set to `true` if users must verify email before logging in
- [ ] Test user registration flow through DeveloperPage
- [ ] Test email verification (if enable_confirmations is true)
- [ ] Test password reset flow end-to-end
- [ ] Verify users can login after registration with Supabase Auth
- [ ] Confirm user IDs match between auth.users and public.users tables
- [ ] Test that hardcoded password fallback has been removed

### Database Preparation
Since your database is currently empty, you have two options:

#### Option A: Fresh Schema (Recommended for Empty Databases)
- [ ] Use `supabase-schema-with-tenant.sql` for new database setup
- [ ] No migration needed for empty database
- [ ] Skip backup step as database is empty

#### Option B: Migration Approach (If you prefer to use existing schema)
- [ ] Backup database (even if empty, for consistency): `pg_dump your_database > backup_before_tenant_migration.sql`
- [ ] Review migration script `migration-add-tenant-id.sql`
- [ ] Test migration script on staging database (if available)

### Code Review
- [ ] Verify all backend changes:
  - [ ] `server/routes/auth.js`
  - [ ] `server/routes/users.js`
  - [ ] `server/routes/products.js`
  - [ ] `server/routes/sales.js`
  - [ ] `server/routes/categories.js`
  - [ ] `server/routes/suppliers.js`
  - [ ] `server/routes/customers.js`
  - [ ] `server/routes/subscriptions.js`
- [ ] Verify all frontend changes:
  - [ ] `src/pages/SettingsPage.jsx`
  - [ ] `src/contexts/AuthContext.jsx`
  - [ ] `src/lib/api.js`
- [ ] Verify infrastructure scripts:
  - [ ] `tools/fix-demo-user.js`
  - [ ] `tools/create-developer-user.js`
  - [ ] `tools/create-demo-user.js`
  - [ ] `create-user.js`

## Deployment Steps

### 1. Database Setup (Choose One Approach)

#### Option A: Fresh Schema (Recommended)
- [ ] Apply new schema: `psql your_database < supabase-schema-with-tenant.sql`
- [ ] If `psql` not recognized, use full path:
  - [ ] Windows PostgreSQL: `"C:\Program Files\PostgreSQL\14\bin\psql.exe" your_database < supabase-schema-with-tenant.sql`
  - [ ] XAMPP PostgreSQL: `"C:\xampp\pgsql\bin\psql.exe" your_database < supabase-schema-with-tenant.sql`
- [ ] If tools not available, copy-paste SQL content to database management tool
- [ ] Verify schema was applied successfully

#### Option B: Migration Approach
- [ ] Execute migration: `psql your_database < migration-add-tenant-id.sql`
- [ ] If `psql` not recognized, use full path:
  - [ ] Windows PostgreSQL: `"C:\Program Files\PostgreSQL\14\bin\psql.exe" your_database < migration-add-tenant-id.sql`
  - [ ] XAMPP PostgreSQL: `"C:\xampp\pgsql\bin\psql.exe" your_database < migration-add-tenant-id.sql`
- [ ] If tools not available, copy-paste SQL content to database management tool
- [ ] Verify migration success:
  - [ ] Check that `tenant_id` column exists
  - [ ] Check that index `idx_users_tenant_id` exists

### 2. Backend Deployment
- [ ] Deploy updated backend code to server
- [ ] Install/update dependencies: `npm install`
- [ ] Restart backend service:
  ```bash
  # If using pm2
  pm2 restart idcashier
  
  # If using systemd
  sudo systemctl restart idcashier
  
  # If running directly
  npm run server
  ```
- [ ] Verify backend is running: Check logs and health endpoint

### 3. Frontend Deployment
- [ ] Build frontend: `npm run build`
- [ ] Deploy built files to web server
- [ ] Clear CDN cache (if applicable)
- [ ] Verify frontend is accessible

### 4. Data Initialization (If Needed)
- [ ] Create initial users using provided scripts:
  - [ ] `node create-initial-owner.js` (for testing with new schema)
  - [ ] `node create-test-cashier.js` (for testing cashier functionality)
  - [ ] `node create-user.js` (for general users)
  - [ ] `node tools/create-demo-user.js` (for demo user)
  - [ ] `node tools/create-developer-user.js` (for developer user)
- [ ] No need to clear localStorage as database is empty

## Post-Deployment Verification

### System Verification
- [ ] Login as owner account
- [ ] Navigate to Settings > Account Management
- [ ] Create a new cashier account
- [ ] Logout and login as cashier
- [ ] Verify cashier can see owner's data (products, sales, etc.)
- [ ] Verify cashier cannot access admin functions

### Data Verification
- [ ] Check that new data is properly associated with users
- [ ] Verify tenant-based filtering works correctly
- [ ] Test all CRUD operations

### Performance Verification
- [ ] Check application load times
- [ ] Verify database query performance
- [ ] Monitor for any errors in logs

## Troubleshooting Common Issues

### Email and SMTP Issues
1. **Emails not being sent**:
   - Check SMTP credentials in Supabase Secrets
   - Verify SMTP configuration in `supabase/config.toml`
   - Check that port 465 is not blocked by firewall
   - Try port 587 with STARTTLS if port 465 doesn't work
   - Check Supabase logs for SMTP errors

2. **Emails going to spam**:
   - Configure SPF, DKIM, and DMARC records for your domain
   - Use a reputable SMTP provider
   - Avoid spam trigger words in email content

3. **Password reset not working**:
   - Verify Supabase Auth resetPasswordForEmail is being called
   - Check that SITE_URL environment variable is set correctly
   - Verify email is registered in both auth.users and public.users
   - Check email delivery logs

### Supabase Auth Issues
1. **User cannot login after registration**:
   - Check if user exists in auth.users table
   - Verify user exists in public.users table with same ID
   - Check if email confirmation is required (enable_confirmations setting)
   - Verify password meets minimum requirements (6 characters)

2. **Email verification not working**:
   - Check enable_confirmations setting in config.toml
   - Verify SMTP is configured correctly
   - Check that verification email was sent and received

3. **User IDs don't match between auth.users and public.users**:
   - This should not happen with the new implementation
   - Auth user is created first, then ID is used for public.users
   - If mismatch occurs, manually sync the IDs or recreate the user

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
1. **Check connection parameters**:
   - Host: localhost or server IP
   - Port: 5432 (default PostgreSQL port)
   - Username and password
   - Database name

2. **Verify PostgreSQL service is running**:
   ```bash
   # Windows - check services
   sc query postgresql
   
   # Or check in Services.msc
   ```

3. **Check firewall settings** if connecting to remote database

### Schema/Application Errors
1. **Check backend logs** for any errors
2. **Verify environment variables** are correctly set
3. **Ensure all dependencies** are installed
4. **Check database connection** from application

## Rollback Plan

If issues are encountered:

### For Fresh Schema Approach:
1. Drop and recreate database with original schema
2. Restore from any existing backup if needed (though not necessary for empty database)
3. Revert code changes

### For Migration Approach:
1. Restore database from backup: `psql your_database < backup_before_tenant_migration.sql`
2. If `psql` not available, use full path or database management tool
3. Verify database is restored to previous state
4. Revert code changes to commit before migration
5. Restart services

## Monitoring

### During Deployment
- [ ] Monitor application logs
- [ ] Monitor database performance
- [ ] Watch for error rates
- [ ] Check user feedback

### After Deployment
- [ ] Monitor for 24-48 hours
- [ ] Watch for any issues reported by users
- [ ] Check database performance metrics
- [ ] Verify all functionality works as expected

## Support

### Contact Information
- [ ] Database administrator contact
- [ ] Backend developer contact
- [ ] Frontend developer contact
- [ ] System administrator contact

### Common Issues
- [ ] Login issues
- [ ] Data access problems
- [ ] Performance degradation
- [ ] Missing data

### Troubleshooting Steps
1. Check application logs
2. Verify database connection
3. Test database queries directly
4. Check user permissions
5. Verify tenant_id values