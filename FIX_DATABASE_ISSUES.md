# How to Fix Your Database Issues

Based on your message "supabase-schema.sql sudah saya run di query supabase dan masih error", here's exactly what you need to do to fix the database issues:

## Step 1: Get Your Service Role Key

1. Go to your Supabase project dashboard
2. Click on the "Settings" icon in the left sidebar
3. Go to "API" section
4. Copy your "Service Role Key" (not the anon key)
5. Update your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

## Step 2: Reset Your Database

The issue is likely caused by existing tables with conflicting structures. You need to completely reset your database first.

### Option A: Use the Reset Script (if RPC is available)
```bash
npm run supabase:reset-db
```

### Option B: Manual Reset (recommended if Option A fails)
1. Open your Supabase SQL editor
2. Run these statements in order:
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

## Step 3: Apply the Updated Schema

### Option A: Use the Apply Script (if RPC is available)
```bash
npm run supabase:apply-schema
```

### Option B: Manual Application (recommended)
1. Open your Supabase SQL editor
2. Copy the entire contents of `supabase-schema.sql`
3. Paste it into the SQL editor
4. Run it

## Step 4: Insert Your Developer Account

1. Open your Supabase SQL editor
2. Copy the contents of `insert-developer.sql`
3. Paste it into the SQL editor
4. Run it

## Why This Fixes Your Issues

1. **Consistent Primary Keys**: All tables now use UUID primary keys instead of mixed SERIAL and UUID types
2. **Fixed Foreign Key References**: All foreign keys now reference UUID columns
3. **Added 'admin' Role**: The schema now includes 'admin' in the role constraint
4. **Clean Start**: Resetting the database eliminates any conflicting existing data

## Verification

After completing these steps, test your application:
1. Run `npm run dev:full`
2. Access the developer page
3. Try creating a new admin user
4. Verify that data saving works for categories, customers, products, suppliers, and users

## If You Still Have Issues

1. Check `SUPABASE_TROUBLESHOOTING.md` for specific error solutions
2. Ensure your `.env` file has the correct service role key
3. Make sure you've reset the database before applying the schema
4. Verify all foreign key relationships in the schema match

## Important Notes

- **Data Loss**: These steps will completely wipe your existing database
- **Backup**: If you have important data, back it up before proceeding
- **Order Matters**: Always reset before applying the schema
- **Consistency**: The new schema ensures all tables use UUID primary keys

This should resolve the database connectivity and data saving issues you've been experiencing.