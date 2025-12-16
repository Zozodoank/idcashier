# Authentication Troubleshooting Guide

This document provides solutions for common authentication issues in the ID Cashier application.

## 1. Problem: Login Failed with Error "Invalid login credentials"

### Symptoms
- User enters correct email and password
- Application shows "Invalid login credentials" error
- Login timeout after 10 seconds

### Root Causes
1. User exists in `public.users` table but not in Supabase Auth (`auth.users`)
2. Email mismatch between application and database
3. Browser session cache conflicts
4. Password hash inconsistencies

### Solution Steps

#### Phase 1: Fix Auth Users
Run the fix auth users script to ensure users exist in both `auth.users` and `public.users`:

```bash
npm run fix:auth-users
```

This script will:
- Check if users exist in Supabase Auth
- Create or update users as needed
- Sync user data between `auth.users` and `public.users`
- Ensure proper tenant_id assignments

#### Phase 2: Clear Browser Session
Clear cached session data from the browser:

```bash
npm run clear:session
```

Then open your browser and navigate to:
- Development: http://localhost:3000/clear-session.html
- Production: https://your-domain.com/clear-session.html

Alternatively, manually clear browser storage:
1. Open Developer Tools (F12)
2. Go to Application tab
3. Expand Local Storage in the left sidebar
4. Delete all items that start with "idcashier_" or "sb-"

#### Phase 3: Test Login
1. Navigate to the login page
2. Enter credentials:
   - Demo User: demo@gmail.com / Demo2025
   - Developer: jho.j80@gmail.com / @Se06070786
3. Successful login should redirect to dashboard

## 2. Problem: User Already Registered Error

### Symptoms
- Script fails with "User already registered" message
- Cannot create new user through normal signup

### Solution
Use the fix script instead of creation script:

```bash
npm run fix:auth-users
```

This will update existing users' passwords rather than trying to create duplicates.

## 3. Problem: Database Migration Issues

### Symptoms
- Users not properly synchronized between tables
- Missing tenant_id values
- Permission errors when accessing user data

### Solution
Apply the database migration to fix user authentication:

```bash
npm run migration:fix-auth
```

This will:
- Create or update users in `auth.users` with proper password hashes
- Ensure users exist in `public.users` with correct IDs
- Set proper tenant_id values for owner/admin users

## 4. Problem: Environment Configuration Issues

### Symptoms
- Scripts fail with missing environment variables
- Cannot connect to Supabase
- Authentication API calls fail

### Solution
Verify your `.env` file contains the required variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Ensure the service role key is present for admin operations.

## 5. Problem: Manual Verification

### Check Auth Users
Verify users exist in Supabase Auth:

```sql
SELECT id, email, created_at FROM auth.users;
```

### Check Public Users
Verify users exist in public.users table:

```sql
SELECT id, email, name, role, tenant_id FROM public.users;
```

### Verify User Synchronization
Ensure user IDs match between tables:

```sql
SELECT 
    a.id as auth_id, 
    p.id as public_id, 
    a.email,
    p.tenant_id
FROM auth.users a
FULL OUTER JOIN public.users p ON a.email = p.email;
```

## Emergency Procedures

### Complete Reset
If all else fails, perform a complete reset:

1. Run the database reset script:
   ```bash
   npm run supabase:reset-db
   ```

2. Re-seed the database:
   ```bash
   npm run db:seed
   ```

3. Clear browser session:
   ```bash
   npm run clear:session
   ```

4. Test login with new credentials

## Prevention Tips

1. Always use consistent email addresses across scripts and application
2. Regularly verify user synchronization between auth and public tables
3. Clear browser cache when switching between development and production
4. Use the fix scripts rather than creation scripts for existing users
5. Keep environment variables up to date

## Contact Support

If issues persist after following these steps:
1. Check Supabase function logs:
   ```bash
   npm run logs:auth-login
   ```

2. Verify deployment status:
   ```bash
   npm run verify:deployment
   ```

3. Contact system administrator with detailed error messages