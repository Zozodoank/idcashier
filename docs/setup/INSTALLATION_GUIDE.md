# Installation Guide

## System Requirements
- Node.js v16 or higher
- npm v7 or higher

## Step 1: Clone the Repository
```bash
git clone https://github.com/projectmandiri10-lang/idcashier.git
cd idcashier
```

## Step 2: Install Dependencies
```bash
npm install
```

## Step 3: Configure Environment Variables
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration. See `DUITKU_SECRETS_CONFIGURED.md` and `SUPABASE_SETUP.md` for details.

## Step 4: Run the Application
For development:
```bash
npm run dev
```

This will start the frontend development server on port 3000 (or available port).
The application uses Supabase Edge Functions for backend logic.

## Step 5: Access the Application
Open your browser and navigate to:
http://localhost:3000

## Production Deployment
1. Build the frontend:
```bash
npm run build
```

2. The build output will be in `dist/` directory.

3. Deploy the `dist` folder to any static hosting provider (Vercel, Netlify, Cloudflare Pages, etc.).
