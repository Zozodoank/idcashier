# Supabase Instructions for idCashier

This document provides step-by-step instructions for setting up and using Supabase with the idCashier application.

## Prerequisites

1. Ensure you have Node.js installed
2. Have your Supabase project URL and API keys ready

## Setup Steps

### 1. Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Click on the "Settings" icon in the left sidebar
3. Go to "API" section
4. Copy your "Service Role Key" (not the anon key)

### 2. Update Your Environment Variables

Update your `.env` file with your Supabase Service Role Key:

```env
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
```

### 3. Test the Connection

Run the connection test script to verify your setup:

```bash
npm run supabase:test-connection
```

### 4. Apply the Database Schema

To apply the database schema to your Supabase project:

```bash
npm run supabase:apply-schema
```

### 5. Reset the Database (If Needed)

To completely reset your database (WARNING: This will delete all data):

```bash
npm run supabase:reset-db
```

## Troubleshooting

### Common Issues

1. **"Missing Supabase credentials" error**
   - Make sure you've added the SUPABASE_SERVICE_ROLE_KEY to your .env file

2. **"Connection refused" error**
   - Verify your Supabase URL is correct
   - Check your internet connection

3. **"RPC function not found" error**
   - This is expected if you're using the free tier of Supabase which doesn't support the execute_sql RPC function
   - In this case, you'll need to manually copy and paste the SQL statements from the supabase-schema.sql file into your Supabase SQL editor

### Manual Schema Application

If the automated scripts don't work due to RPC limitations:

1. Open your Supabase dashboard
2. Go to the SQL editor
3. Copy the contents of `supabase-schema.sql`
4. Paste it into the SQL editor and run it

### Inserting the Developer Account

After applying the schema, you'll need to insert your developer account:

1. Generate a UUID at https://www.uuidgenerator.net/
2. Replace the placeholder UUID in `insert-developer.sql` with your generated UUID
3. Run the SQL statement in your Supabase SQL editor

## Next Steps

Once your database is set up:

1. Run the application with `npm run dev:full`
2. Access the developer page to create admin accounts
3. Use the admin accounts to create cashier accounts

## Notes

- The application uses UUID primary keys for all tables to ensure consistency
- Row Level Security should be enabled in production
- Always backup your data before running reset operations