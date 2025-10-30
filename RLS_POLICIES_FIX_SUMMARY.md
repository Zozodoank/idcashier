# RLS Policies Fix Summary

## Problem
Terjadi error 403, 406, dan 400 saat mengakses HPP-related tables:
- `app_settings` - Error 406 (Not Acceptable)
- `employee_product_shares` - Error 403 (Forbidden)
- `sale_custom_costs` - Error 403 (Forbidden)
- `employees` (with users join) - Error 400 (Bad Request)

**Root Cause:** 
RLS policies menggunakan `auth.uid()` yang merupakan Supabase Auth user ID, sedangkan `user_id` di tabel-tabel database adalah `public.users.id`. Kedua ID ini BERBEDA karena:
- `auth.uid()` = UUID dari `auth.users` table (Supabase Auth)
- `public.users.id` = UUID dari `public.users` table (application data)

User yang sama memiliki 2 UUID berbeda di kedua tabel, dengan link melalui email address.

## Solution

### 1. Created Helper Function
Created `auth_user_id()` function yang mengkonversi Supabase Auth user ID ke database user ID:

```sql
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT id FROM users
  WHERE email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
  LIMIT 1;
$$;
```

### 2. Updated RLS Policies

#### app_settings Table
**Before:**
```sql
USING (user_id = auth.uid())  -- ❌ Wrong UUID
```

**After:**
```sql
USING (user_id = auth_user_id())  -- ✅ Correct UUID
```

**Policies:**
- `Users can view own settings` - SELECT
- `Users can insert own settings` - INSERT
- `Users can update own settings` - UPDATE
- `Users can delete own settings` - DELETE

---

#### employees Table
**Before:**
```sql
USING (tenant_id = auth.uid())  -- ❌ Wrong UUID
```

**After:**
```sql
USING (
  tenant_id = auth_user_id()
  OR tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth_user_id()
  )
  OR user_id = auth_user_id()
)  -- ✅ Correct UUID with tenant support
```

**Policies:**
- `Users can view their own tenant employees` - SELECT (includes join to users table)
- `Owners can insert employees` - INSERT
- `Owners can update employees` - UPDATE
- `Owners can delete employees` - DELETE

---

#### sale_custom_costs Table
**Before:**
```sql
USING (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth.uid() OR u.tenant_id = auth.uid())  -- ❌ Wrong UUID
  )
)
```

**After:**
```sql
USING (
  EXISTS (
    SELECT 1 FROM sales s
    INNER JOIN users u ON s.user_id = u.id
    WHERE s.id = sale_custom_costs.sale_id
    AND (u.id = auth_user_id() OR u.tenant_id = auth_user_id())  -- ✅ Correct UUID
  )
)
```

**Policies:**
- `Users can view tenant custom costs` - SELECT
- `Users can insert tenant custom costs` - INSERT
- `Users can update tenant custom costs` - UPDATE
- `Users can delete tenant custom costs` - DELETE

---

#### employee_product_shares Table
**Before:**
```sql
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_product_shares.employee_id
    AND e.tenant_id IN (
      SELECT id FROM users WHERE id = auth.uid()  -- ❌ Wrong UUID
      UNION
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
)
```

**After:**
```sql
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_product_shares.employee_id
    AND (e.tenant_id = auth_user_id() OR e.tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth_user_id()  -- ✅ Correct UUID
    ))
  )
)
```

**Policies:**
- `Users can view tenant employee shares` - SELECT
- `Users can insert tenant employee shares` - INSERT
- `Users can update tenant employee shares` - UPDATE
- `Users can delete tenant employee shares` - DELETE

## Migrations Applied

1. **`add_rls_policies_for_hpp`** - Initial RLS policies (had bugs)
2. **`fix_rls_policies_for_hpp_v2`** - Fixed app_settings policies
3. **`fix_employees_rls_policies`** - Added auth_user_id() helper & fixed employees policies
4. **`fix_all_hpp_rls_policies_consistent`** - Fixed all remaining HPP tables

## Testing

### Before Fix
```
❌ app_settings: 406 (Not Acceptable)
❌ employee_product_shares: 403 (Forbidden)
❌ sale_custom_costs: 403 (Forbidden)
❌ employees (with join): 400 (Bad Request)
```

### After Fix
```
✅ app_settings: 200 OK
✅ employee_product_shares: 200 OK
✅ sale_custom_costs: 200 OK
✅ employees (with join): 200 OK
```

## Key Learnings

1. **Dual User IDs:** Supabase Auth users have different UUIDs than application users
2. **Email as Link:** Email address is the common identifier between auth.users and public.users
3. **Helper Functions:** Using SECURITY DEFINER functions for RLS makes policies cleaner
4. **Tenant Support:** Policies must account for both owner (tenant_id = user_id) and cashier (tenant_id = owner's user_id)

## Files Modified

- `migrations/006_add_rls_policies_for_hpp.sql`
- `migrations/fix_rls_policies_for_hpp_v2.sql`
- `migrations/fix_employees_rls_policies.sql`
- `migrations/fix_all_hpp_rls_policies_consistent.sql`

## Status

✅ **ALL ERRORS FIXED**
- HPP features now fully functional
- No more 403/406/400 errors
- Data access works correctly for owners and cashiers

