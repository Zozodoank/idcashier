# How to Deploy Updated Schema to Supabase

## Important Notice

The schema has been updated to fix a critical data type mismatch:
- Changed `user_id` columns from `INTEGER` to `UUID` to match Supabase Auth
- Changed `users.id` from `SERIAL` to `UUID` to match Supabase Auth

## Before Deploying - Choose Your Approach

### Option 1: Reset Database First (Recommended if you have test data only)
If you only have test data and want a clean start:

1. Use the reset script: `reset-database.sql`
2. Then deploy the updated schema

### Option 2: Manual Migration (If you have important data)
If you have important data you want to keep, you'll need to:
1. Export your data
2. Reset the database
3. Deploy the new schema
4. Import your data with proper UUIDs

## Deployment Steps

### Step 1: Access Supabase Dashboard
1. Go to https://app.supabase.com
2. Sign in to your account
3. Select your project

### Step 2: Navigate to SQL Editor
1. In the left sidebar, click on "SQL Editor"
2. Click on "New query"

### Step 3: Deploy the Schema
1. Open the file: `supabase-schema.sql`
2. Copy its entire contents
3. Paste it into the SQL editor
4. Click the "Run" button

### Step 4: Verify Deployment
After running the schema, you can verify it worked by running this query in the SQL editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sales' AND column_name = 'user_id';
```

The result should show `uuid` as the data_type, not `integer`.

## Troubleshooting

### If you get errors about existing tables:
You may need to drop existing tables first. Run this in the SQL editor:

```sql
DROP TABLE IF EXISTS sale_items, sales, products, customers, categories, suppliers, subscriptions, users CASCADE;
```

Then deploy the new schema.

### If you continue to get the same error:
The schema hasn't been deployed yet. Double-check that you've:
1. Copied the entire contents of `supabase-schema.sql`
2. Clicked "Run" in the Supabase SQL Editor
3. Waited for the execution to complete successfully

## After Deployment

Once the schema is deployed successfully:
1. Refresh your application
2. The error should be resolved
3. You should be able to fetch sales data properly