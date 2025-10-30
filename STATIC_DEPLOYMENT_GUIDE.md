# Static Hosting Deployment Guide for idCashier

This guide explains how to deploy idCashier as a static application with Supabase backend.

## Prerequisites

1. Node.js version 22 or higher
2. A Supabase account (free tier available at https://supabase.com/)
3. A Supabase project created

## Setup Instructions

### 1. Configure Supabase

1. Go to your Supabase project dashboard
2. Click on the "Settings" icon in the left sidebar
3. Go to "API" section
4. Copy your "Project URL" and "Project API keys" (use the `anon` key)

### 2. Configure Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Create Database Tables in Supabase

In your Supabase SQL editor, run the queries from `supabase-schema.sql` to create the required tables.

### 4. Insert Developer Account

After creating the tables, insert your developer account using the Supabase SQL editor:

```sql
-- Replace 'your-generated-uuid-here' with an actual UUID
-- You can generate a UUID at https://www.uuidgenerator.net/
INSERT INTO users (id, name, email, password, role)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- Replace with actual UUID
  'Developer',
  'jho.j80@gmail.com',
  '$2a$10$example_hashed_password',  -- Replace with actual hashed password
  'admin'
);
```

### 5. Build the Application

Run the build command to generate the static files:

```bash
npm run build
```

This will create a `dist/` directory with all the static files needed for deployment.

### 6. Deploy to Static Hosting

You can deploy the contents of the `dist/` directory to any static hosting provider such as:
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting
- Amazon S3

## Running the Application Locally

To run the application locally in development mode:

```bash
npm run dev
```

This will start the frontend development server on port 3000.

## Notes

- The application no longer requires a backend server as all API calls are made directly to Supabase
- All data is stored in Supabase database
- Authentication is handled by Supabase Auth
- The application is designed to work with the idcashier.my.id domain
- Make sure to configure CORS settings in Supabase to allow requests from your domain

## Troubleshooting

1. If you see "Supabase credentials not found" error, make sure your `.env` file is properly configured
2. If database queries fail, check that you've run the schema SQL script in Supabase
3. If authentication fails, verify that you've inserted the developer account in the users table