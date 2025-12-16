# How to Push Schema to Supabase

Due to security restrictions, schema changes cannot be pushed directly using the anon key from the frontend. Here are the recommended methods:

## Method 1: Using Supabase Dashboard (Easiest)

1. **Open your Supabase Dashboard:**
   - Go to https://app.supabase.com
   - Sign in to your account
   - Select your project

2. **Navigate to the SQL Editor:**
   - In the left sidebar, click on "SQL Editor"
   - Click on "New query"

3. **Copy and paste the schema:**
   - Open the file: `supabase-schema.sql`
   - Copy its entire contents
   - Paste it into the SQL editor

4. **Execute the schema:**
   - Click the "Run" button
   - Wait for the execution to complete

## Method 2: Using Supabase CLI (Recommended for Development)

1. **Install the Supabase CLI:**
   ```bash
   # For Windows (using PowerShell)
   iwr https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.tar.gz -OutFile supabase.tar.gz
   tar -xzf supabase.tar.gz
   ./supabase.exe --version
   
   # For macOS (using Homebrew)
   brew install supabase/tap/supabase
   
   # For Linux
   curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64
   chmod +x supabase
   ./supabase --version
   ```

2. **Initialize Supabase project (if not already done):**
   ```bash
   supabase init
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```
   You can find your project ID in the Supabase dashboard URL: `https://app.supabase.com/project/YOUR_PROJECT_ID`

4. **Push the schema:**
   ```bash
   supabase db push
   ```

## Method 3: Using psql (PostgreSQL Client)

1. **Install psql:**
   - Download PostgreSQL from https://www.postgresql.org/download/
   - During installation, make sure to include psql in your PATH

2. **Get your database connection details:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > Database
   - Copy the connection string (it should look like):
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_ID].supabase.co:5432/postgres
     ```

3. **Connect and execute the schema:**
   ```bash
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_ID].supabase.co:5432/postgres" -f supabase-schema.sql
   ```

## Important Notes

- The schema file `supabase-schema.sql` contains all the necessary table definitions and sample data
- Make sure to replace placeholder values with actual values where needed
- Always backup your database before making schema changes
- Test schema changes in a development environment first

## Troubleshooting

If you encounter any errors:

1. **Check for existing tables:** The schema uses `IF NOT EXISTS` clauses, but conflicts may still occur
2. **Foreign key constraints:** Make sure tables are created in the correct order
3. **Permissions:** Ensure you're using a user with sufficient privileges (preferably the database owner)

For any issues, refer to the Supabase documentation: https://supabase.com/docs