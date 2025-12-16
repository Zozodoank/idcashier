
# MANUAL MIGRATION INSTRUCTIONS

Since Supabase MCP tools are not available, please execute the RLS fix manually:

## Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of fix-cronjob-rls-policies.sql
4. Execute the script
5. Verify the policies were created

## Option 2: Command Line (if you have Supabase CLI)
```bash
supabase db reset --linked
supabase db push --linked
```

## Option 3: Individual Statements
Execute each numbered statement from statement_000.sql to statement_xxx.sql

## After applying migration:
1. Run the test: `node create-and-test-demo-data.js`
2. Check if cronjob now sees the created products
3. Verify data deletion works
