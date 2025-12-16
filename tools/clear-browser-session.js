const fs = require('fs');
const path = require('path');

// HTML content to clear browser session
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clear Browser Session</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            text-align: center;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .success {
            color: #28a745;
            font-size: 18px;
            margin: 20px 0;
        }
        .instructions {
            text-align: left;
            background: #e9ecef;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Clear Browser Session</h1>
        <div id="status" class="success">🔄 Clearing session data...</div>
        
        <div class="instructions">
            <h3>Manual Instructions:</h3>
            <ol>
                <li>Open your browser's Developer Tools (F12 or Ctrl+Shift+I)</li>
                <li>Go to the "Application" tab</li>
                <li>In the left sidebar, expand "Local Storage"</li>
                <li>Click on your domain</li>
                <li>Delete all items that start with "idcashier_" or "sb-"</li>
                <li>Refresh the page</li>
            </ol>
        </div>
        
        <button onclick="clearSession()">Clear Session Again</button>
        <button onclick="redirectToLogin()">Go to Login</button>
    </div>

    <script>
        async function clearSession() {
            try {
                // Clear localStorage items
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('idcashier_') || key.startsWith('sb-')) {
                        localStorage.removeItem(key);
                    }
                });
                
                // Clear all localStorage (optional)
                // localStorage.clear();
                
                document.getElementById('status').innerHTML = '✅ Session data cleared successfully!';
                document.getElementById('status').className = 'success';
                
                // Auto redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } catch (error) {
                console.error('Error clearing session:', error);
                document.getElementById('status').innerHTML = '❌ Error clearing session: ' + error.message;
                document.getElementById('status').className = 'error';
            }
        }
        
        function redirectToLogin() {
            window.location.href = '/login';
        }
        
        // Run on page load
        document.addEventListener('DOMContentLoaded', clearSession);
    </script>
</body>
</html>
`;

// Write HTML file to public directory
const filePath = path.join(__dirname, '..', 'public', 'clear-session.html');

fs.writeFile(filePath, htmlContent, (err) => {
  if (err) {
    console.error('Error writing clear-session.html:', err);
    process.exit(1);
  }
  
  console.log('✅ Created clear-session.html');
  console.log('');
  console.log('📝 To clear your browser session:');
  console.log('1. Open your browser and navigate to:');
  console.log('   http://localhost:3000/clear-session.html (for development)');
  console.log('   OR');
  console.log('   https://your-domain.com/clear-session.html (for production)');
  console.log('');
  console.log('2. Alternatively, manually clear your browser storage:');
  console.log('   - Open DevTools (F12)');
  console.log('   - Go to Application tab');
  console.log('   - Expand Local Storage in the left sidebar');
  console.log('   - Delete all items that start with "idcashier_" or "sb-"');
});