# How to Push Schema to Supabase

Since we can't easily install the Supabase CLI on your system, here's how to manually push your database schema to Supabase:

## Method 1: Using Supabase Dashboard (Recommended)

1. **Log in to your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Log in with your account credentials

2. **Navigate to your project**
   - Select the project that corresponds to your URL: `https://eypfeiqtvfxxiimhtycc.supabase.co`

3. **Go to the SQL Editor**
   - In the left sidebar, click on "SQL Editor"

4. **Copy and Paste the Schema**
   - Open the `supabase-schema.sql` file from your project
   - Copy the entire contents
   - Paste it into the SQL editor in Supabase

5. **Run the Queries**
   - Click the "Run" button to execute all queries
   - The tables will be created in your Supabase database

## Method 2: Using Supabase CLI (If you can install it)

If you're able to install the Supabase CLI through other means:

1. **Install Supabase CLI**
   ```bash
   # On Windows with Scoop
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase

   # On macOS with Homebrew
   brew install supabase/tap/supabase

   # On Linux
   curl -fsSL https://supabase.com/cli/install.sh | sh
   ```

2. **Link your project**
   ```bash
   supabase link --project-ref eypfeiqtvfxxiimhtycc
   ```

3. **Push the schema**
   ```bash
   supabase db push
   ```

## Method 3: Manual Table Creation

If you prefer to create tables one by one:

1. **Go to Table Editor**
   - In your Supabase dashboard, click on "Table Editor" in the left sidebar

2. **Create tables manually**
   - Click "Create a new table"
   - Use the schema definitions from `supabase-schema.sql` to create each table with the correct columns and relationships

## Troubleshooting

- **If you get permission errors**: Make sure you're using the Service Role Key for administrative operations
- **If tables already exist**: The `IF NOT EXISTS` clause in the schema will prevent errors
- **If you need to reset**: You can drop tables in the Table Editor and recreate them

## Next Steps

After pushing the schema:
1. Verify that all tables were created correctly
2. Test your application to ensure it can connect to Supabase
3. Add sample data if needed