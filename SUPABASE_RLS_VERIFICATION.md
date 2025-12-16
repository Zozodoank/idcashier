Error: Cannot coerce the result to a single JSON object
    at Object.single (supabase-js/src/SupabaseClient.ts:xxx)
    at authAPI.login (src/lib/api.js:92)
POST https://your-project.supabase.co/rest/v1/users?select=*&email=eq.demo%40idcashier.my.id 406
```

## Quick Diagnosis

### 1. Check if RLS is Enabled
Run this SQL query in Supabase SQL Editor to check RLS status on all tables:

```sql
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class 
WHERE relname IN ('users', 'customers', 'categories', 'suppliers', 'products', 'sales', 'sale_items', 'subscriptions')
AND relkind = 'r';
```

**Expected Result for Disabled RLS**:
```
table_name  | rls_enabled
------------|-------------
users       | f
customers   | f
...         | f
```

**Problem Indication**: If `rls_enabled` is `t` (true) for any table, RLS is active.

### 2. Check Existing Policies
Run this query to see all RLS policies:

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Result**: Empty result set (no policies) if following the original schema design.

**Problem Indication**: If policies exist but don't allow SELECT for authenticated users, queries will fail.

### 3. Test Query with and without RLS
**Test with Anon Key (RLS Applied)**:
```sql
-- This should fail if RLS blocks access
SELECT * FROM users WHERE email = 'demo@idcashier.my.id';
```

**Test with Service Role Key (RLS Bypassed)**:
```sql
-- This should succeed if data exists
SELECT * FROM users WHERE email = 'demo@idcashier.my.id';
```

**Diagnosis**:
- If anon query fails but service role succeeds: RLS is blocking access
- If both fail: Data issue (user doesn't exist)
- If both succeed: RLS is disabled or policies allow access

## Solution Options

### Option A (Quick Fix): Disable RLS Completely

**Pros**:
- Fast resolution (immediate fix)
- Aligns with original design in `supabase-schema.sql`
- No complex policy configuration needed

**Cons**:
- Less secure (relies on application-level security)
- Not recommended for production environments
- May expose data if application security is compromised

**Steps**:
1. Run the SQL commands from `SUPABASE_RLS_FIX.sql` section 2
2. Execute in Supabase SQL Editor:
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
   ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
   ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
   ALTER TABLE products DISABLE ROW LEVEL SECURITY;
   ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
   ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
   ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
   ```

### Option B (Recommended): Enable RLS with Proper Policies

**Pros**:
- Follows Supabase security best practices
- Provides data isolation and protection
- Recommended for production deployments

**Cons**:
- Requires more testing and validation
- May need adjustments based on application logic

**Steps**:
1. Run the SQL commands from `SUPABASE_RLS_FIX.sql` section 3
2. Execute in Supabase SQL Editor:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
   ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
   ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

   -- Drop any existing policies (clean slate)
   DROP POLICY IF EXISTS "Users can view own profile" ON users;
   DROP POLICY IF EXISTS "Users can update own profile" ON users;
   DROP POLICY IF EXISTS "Service role full access" ON users;
   -- ... drop policies for other tables as needed

   -- Create new policies for users table
   CREATE POLICY "Users can view own profile" ON users 
       FOR SELECT TO authenticated 
       USING (auth.uid() = id);

   CREATE POLICY "Users can update own profile" ON users 
       FOR UPDATE TO authenticated 
       USING (auth.uid() = id);

   CREATE POLICY "Service role full access" ON users 
       FOR ALL TO service_role 
       USING (true);

   CREATE POLICY "Anon can select for login" ON users 
       FOR SELECT TO anon 
       USING (true);

   -- Apply similar policies to other tables based on user_id
   CREATE POLICY "Users can access own customers" ON customers 
       FOR ALL TO authenticated 
       USING (user_id = auth.uid());

   -- ... repeat for categories, suppliers, products, sales, sale_items, subscriptions
   ```

## Verification Steps

1. **Test Login with Demo Account**:
   - Attempt login with `demo@idcashier.my.id`
   - Check browser console for 406 errors
   - Verify successful authentication and redirect to dashboard

2. **Verify User Profile Fetch**:
   - After login, check if user profile loads correctly
   - Inspect network tab for successful API calls to `/rest/v1/users`
   - Confirm no 406 errors in console

3. **Test CRUD Operations**:
   - Create a new customer/product/category
   - Update existing records
   - Delete test records
   - Verify all operations complete without RLS-related errors

4. **Run Verification Script**:
   - Execute `npm run verify:rls` to check RLS status programmatically
   - Review output for any remaining issues

## Rollback Plan

If issues persist after applying fixes:

### 1. Revert Policies
```sql
-- Drop all policies to return to clean state
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Service role full access" ON users;
DROP POLICY IF EXISTS "Anon can select for login" ON users;
-- ... drop policies for all other tables

-- Disable RLS if needed
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ... disable for all tables