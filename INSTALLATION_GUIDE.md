# Installation Guide

## System Requirements
- Node.js v22 or higher
- MySQL v5.7 or higher
- npm v8 or higher

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

Edit the `.env` file with your configuration:
```env
# Server configuration
PORT=3001

# Database configuration
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=idcashier

# Security
JWT_SECRET=generate_a_secure_random_string_here
CRONJOB_SECRET=generate_another_secure_random_string_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## Step 4: Set Up Database
1. Create a MySQL database:
```sql
CREATE DATABASE idcw9344_pos;
```

2. The application will automatically create all necessary tables on first run.

## Step 5: Create Initial Users
After setting up the database, you need to create initial users:

```bash
npm run db:seed
```

This will create:
- Developer user: jho.j80@gmail.com / @Se06070786
- Demo user: demo@idcashier.my.id / Demo2025

## Step 6: Generate Secure Secrets
Generate secure JWT and CRONJOB secrets using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this command twice and use the outputs for your JWT_SECRET and CRONJOB_SECRET.

## Step 6: Run the Application
For development:
```bash
npm run dev:full
```

This will start both the frontend (port 3000) and backend (port 3001) servers.

## Step 7: Access the Application
Open your browser and navigate to:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Troubleshooting
1. **Database connection failed**: Check your database credentials in the `.env` file
2. **Port already in use**: Change the PORT in `.env` to an available port
3. **Missing dependencies**: Run `npm install` again to ensure all dependencies are installed
4. **401 Unauthorized Login Errors**: 
   - Verify users exist by running `npm run db:verify`
   - Check environment variables are properly set
   - Ensure the server is running
   - Verify Supabase connection with `npm run supabase:test-connection`
   - See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed steps

## Production Deployment
1. Build the frontend:
```bash
npm run build
```

2. Set up your production environment variables

3. Start the server:
```bash
npm run server
```

4. Configure your web server (Apache/Nginx) to serve the static files from the `dist` directory