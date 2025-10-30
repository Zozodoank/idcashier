# Deployment Guide for idCashier

## Prerequisites
1. Node.js installed on your server
2. MySQL database with the following credentials:
   - Host: localhost
   - User: idcw9344_pos
   - Password: @Se06070786
   - Database: idcw9344_pos

## Deployment Steps

### 1. Upload Files
Upload the following files/directories to your server:
- `dist/` directory (contains the built frontend)
- `server/` directory (contains the backend)
- `package.json`
- `.env` file (already configured with your database credentials)

### 2. Install Dependencies
Navigate to the project root directory and run:
```bash
npm install
```

### 3. Database Setup
The application will automatically create the necessary tables when it starts. Make sure your MySQL database is accessible with the credentials in the `.env` file.

### 4. Start the Application
You can start the application in production mode using:
```bash
node server/server.js
```

Or use a process manager like PM2:
```bash
pm2 start server/server.js --name idcashier
```

### 5. Configure Your Web Server
If you're using Apache or Nginx, configure it to:
1. Serve static files from the `dist/` directory
2. Proxy API requests to port 3001

For Apache, you can use the provided `.htaccess` file in the `dist/` directory.

For Nginx, add the following configuration:
```nginx
server {
    listen 80;
    server_name idcashier.my.id;

    location / {
        root /path/to/your/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. Domain Configuration
Make sure your domain `idcashier.my.id` points to your server's IP address.

## Environment Variables
Your `.env` file should contain:
```
PORT=3001
DB_HOST=localhost
DB_USER=idcw9344_pos
DB_PASSWORD=@Se06070786
DB_NAME=idcw9344_pos
JWT_SECRET=5a1b3c4d2e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b
CRONJOB_SECRET=7f9e8d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8
```

## Testing
After deployment, you can test your application by:
1. Visiting `http://idcashier.my.id` in your browser
2. Logging in with the developer account:
   - Email: jho.j80@gmail.com
   - Password: @Se06070786

## Troubleshooting
1. If you see a "Database connection failed" error, check your database credentials in the `.env` file
2. If the application doesn't start, check that port 3001 is not blocked by your firewall
3. If you see CORS errors, make sure the CORS configuration in `server/server.js` includes your domain