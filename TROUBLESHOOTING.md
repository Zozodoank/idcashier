# Troubleshooting Common Issues

## Foreign Key Constraint Violations

### Error: `insert or update on table "products" violates foreign key constraint "products_category_id_fkey"`

This error occurs when trying to insert a product with a [category_id](file:///c:/xampp/htdocs/idcashier/src/components/category_id.jsx) that doesn't exist in the categories table.

**Solution:**
1. Ensure categories are inserted before products
2. Check that the category IDs exist in the categories table
3. Use transactions to ensure proper execution order

The updated schema now uses explicit transactions to prevent this issue:
```sql
BEGIN;
-- Create all tables
CREATE TABLE categories (...);
CREATE TABLE suppliers (...);
CREATE TABLE products (...);
COMMIT;

BEGIN;
-- Insert data in correct order
INSERT INTO categories ...;
INSERT INTO suppliers ...;
INSERT INTO products ...;
COMMIT;
```

### Error: `insert or update on table "sales" violates foreign key constraint "sales_customer_id_fkey"`

This error occurs when trying to insert a sale with a customer_id that doesn't exist in the customers table.

**Solution:**
1. The schema now allows NULL values for customer_id to handle the default customer case
2. The API converts customer_id=0 to NULL before insertion
3. A default "Pelanggan Umum" customer is included in the schema

## Schema Push Issues

### Error: "Relation already exists"

This happens when trying to push the schema to a database that already has tables.

**Solution:**
1. Drop existing tables first:
   ```sql
   DROP TABLE IF EXISTS sale_items, sales, products, suppliers, categories, customers, users CASCADE;
   ```
2. Then run the schema creation script

### Error: "Permission denied"

This occurs when using the anon key instead of the service role key.

**Solution:**
1. Use the Supabase Dashboard SQL Editor (recommended)
2. Or use the Supabase CLI with proper authentication

## Data Consistency Issues

### Products stock not updating after sales

This was fixed by ensuring the sales API properly updates product stock:
1. After creating a sale, the API iterates through sale items
2. For each item, it fetches the current product stock
3. It calculates the new stock (current - quantity sold)
4. It updates the product with the new stock value

## Authentication Issues

### "Supabase client not initialized" error

This was resolved by:
1. Simplifying the client initialization in supabaseClient.js
2. Ensuring proper environment variable loading
3. Adding better error handling in AuthContext

## Environment Configuration

### Missing environment variables

Ensure your .env file contains:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Application Issues

### Login Error: "Unexpected end of JSON input"

This error typically occurs during the login process and is related to communication issues between the frontend and backend servers.

**Causes:**
1. Backend server is not running
2. Port conflict (port 3001 is already being used by another application)
3. Proxy configuration is not working properly

**Solutions:**
1. Ensure you're running `npm run dev:full` or running `npm run server` in a separate terminal
2. Verify the backend is running by opening http://localhost:3001/api/health in your browser
3. Check the terminal console for error messages from the backend
4. If port 3001 is already in use, change the PORT in your .env file
5. Restart both servers after making configuration changes

### Cashier accounts defaulting to settings page

This was fixed by modifying the DashboardLayout.jsx to always default cashier accounts to the dashboard:
```javascript
// For cashier accounts, always default to dashboard
if (user && user.role === 'cashier') {
  return 'dashboard';
}
```

### Print receipt showing dummy data

This was resolved by:
1. Loading actual store settings from localStorage
2. Ensuring proper fallback to user-specific settings
3. Removing hardcoded dummy data

### Sales from cashier accounts appearing in all accounts

This issue was fixed by implementing user-specific sales filtering:
1. Added a user_id column to the sales table to link sales to their creators
2. Modified the sales API to filter sales by the current user's ID
3. Updated all sales queries in the frontend to only show sales belonging to the current user
4. Enhanced security by ensuring users can only access their own sales data

## Database Connection Issues

### "Could not find the 'category' column of 'products' in the schema cache"

This error occurs when the Supabase schema cache is out of sync.

**Solution:**
1. Refresh the schema cache in Supabase dashboard
2. Or restart the Supabase project

## Performance Issues

### Slow dashboard and report loading

This was resolved by:
1. Optimizing API calls to fetch only necessary data
2. Implementing proper pagination where needed
3. Reducing frontend data processing

## Security Issues

### Demo accounts showing in production

This was fixed by:
1. Removing demo data from the database schema
2. Keeping demo data only in the demo@idcashier.my.id account
3. Implementing proper role-based access control
4. Ensuring demo data is only loaded through the application interface for demo users

## 401 Unauthorized Login Errors

This is a common issue during development that can have several root causes. Here's how to diagnose and resolve them:

### Common Causes and Solutions

1. **User Doesn't Exist in Database**
   - **Error Message**: "Email atau password salah" in the browser console
   - **Diagnostic Steps**:
     - Check if users exist in the database:
       ```bash
       npm run db:verify
       ```
     - Or check directly in Supabase:
       ```sql
       SELECT id, email, name FROM users;
       ```
   - **Solution**:
     - Run the user creation scripts:
       ```bash
       npm run db:seed
       ```
     - Or create users individually:
       ```bash
       node tools/create-developer-user.js
       node tools/create-demo-user.js
       ```

2. **Wrong Password**
   - **Error Message**: "Email atau password salah" in the browser console
   - **Diagnostic Steps**:
     - Verify you're using the correct password for the user
     - Check the default credentials:
       - Developer: jho.j80@gmail.com / @Se06070786
       - Demo: demo@idcashier.my.id / Demo2025
   - **Solution**:
     - Use the correct default passwords
     - If you've changed passwords, make sure you're using the updated ones

3. **Demo User Email Mismatch**
   - **Error Message**: "Email atau password salah" in the browser console
   - **Diagnostic Steps**:
     - Check that the demo user email matches exactly what's used in LoginPage.jsx
     - The correct email is: demo@idcashier.my.id
   - **Solution**:
     - Ensure the demo user was created with the correct email
     - Recreate the demo user if needed:
       ```bash
       node tools/create-demo-user.js
       ```

### Enhanced Server-Side Logging

The server now provides more actionable information when login failures occur:

- When a user is not found, the server logs:
  ```
  Hint: Make sure you've created users in the database. Run 'npm run db:seed' to create default users.
  ```

- When password validation fails, the server logs:
  ```
  Hint: Check that you're using the correct password for this user.
  ```

### Authentication Flow Overview

Understanding the authentication flow can help diagnose issues:

1. **Frontend (LoginPage.jsx)**:
   - User enters email and password
   - Credentials are sent to `/api/auth/login` endpoint

2. **Backend (server/routes/auth.js)**:
   - Validates email format and non-empty password
   - Queries the users table for the provided email
   - If user not found, returns 401 with generic error
   - If user found, compares provided password with stored hash
   - If password mismatch, returns 401 with generic error
   - If both match, generates JWT token with user data and tenantId

3. **Security Considerations**:
   - All error messages are generic to prevent user enumeration attacks
   - Actual error details are only logged on the server for debugging
   - Passwords are hashed using bcrypt before storage

## Development Issues

### Frontend not updating with latest data

This was resolved by:
1. Ensuring proper state management in React components
2. Implementing useEffect dependencies correctly
3. Adding proper error handling for API calls

## Reset Password Issues

### Understanding the Reset Password Flow

The reset password feature uses Supabase Auth and has two distinct modes:

1. **Request Reset Mode** (accessed via `/reset-password` without parameters):
   - User enters their email address
   - Application sends a password reset request to Supabase
   - Supabase sends an email with a reset link
   - The link contains `token_hash` and `type=recovery` parameters

2. **Reset Password Mode** (accessed via link from email):
   - User clicks the link from their email
   - URL format: `/reset-password?token_hash=xxx&type=recovery`
   - Application detects the parameters and switches to reset mode
   - User enters their new password
   - Application verifies the token and updates the password

### Common Issues

#### Issue: "Page doesn't show the new password form"

**Symptoms**: After requesting a password reset, the page still shows the email input form instead of the password form.

**Cause**: User is accessing `/reset-password` directly instead of clicking the link from the email.

**Solution**:
1. Check your email inbox (and spam folder) for the password reset email from Supabase
2. Click the link in the email - it will redirect you to the correct URL with the token
3. The page should now display the new password form

**How it works**: The reset password page checks for `token_hash` and `type=recovery` parameters in the URL. If these parameters are not present, it assumes you're requesting a new reset link.

#### Issue: "Email reset password not received"

**Symptoms**: User requests a password reset but doesn't receive the email.

**Possible Causes**:
1. SMTP is not configured in Supabase (for production)
2. Email is in spam folder
3. Rate limiting (maximum 2 emails per hour as configured in `supabase/config.toml`)

**Solutions**:

1. **For Local Development**:
   - Open Inbucket at http://localhost:54324
   - All emails sent during local development appear here
   - No SMTP configuration needed

2. **For Production**:
   - Verify SMTP configuration in Supabase Dashboard:
     - Go to Authentication > Email Templates
     - Check SMTP settings under Authentication > Settings
   - Configure SMTP in `supabase/config.toml` (see detailed comments in the file)
   - Supported SMTP providers:
     - Gmail (recommended for small-scale)
     - SendGrid (recommended for large-scale)
     - Mailgun
     - AWS SES
   - Set SMTP credentials in Supabase Dashboard > Settings > Secrets
   - Test email delivery after configuration

3. **Check Spam Folder**:
   - Password reset emails may be flagged as spam
   - Add the sender email to your contacts/whitelist

4. **Rate Limiting**:
   - The system allows 2 password reset emails per hour
   - Wait at least 30 minutes before requesting another reset
   - Check the countdown timer on the reset page

#### Issue: "Token expired or invalid"

**Symptoms**: Error message "Password reset link is invalid or expired" when trying to reset password.

**Cause**: The reset token has a 1-hour expiry time (configurable in `supabase/config.toml` as `otp_expiry = 3600`).

**Solutions**:
1. Request a new password reset link
2. Complete the password reset process within 1 hour of receiving the email
3. Don't refresh or navigate away from the reset password page

**How to request a new link**:
1. Go to `/reset-password`
2. Enter your email address
3. Check your email for the new reset link
4. Click the link and complete the password reset within 1 hour

#### Issue: "Link doesn't work when clicked"

**Symptoms**: Clicking the email link doesn't redirect to the reset password page.

**Possible Causes**:
1. `site_url` or `additional_redirect_urls` not configured correctly in `supabase/config.toml`
2. Email client modifying the URL

**Solutions**:
1. Verify the redirect URLs in `supabase/config.toml`:
   ```toml
   site_url = "https://idcashier.my.id"
   additional_redirect_urls = ["https://idcashier.my.id/reset-password", "http://localhost:3000", "http://127.0.0.1:3000"]
   ```

2. For production deployment:
   - Update `site_url` to your production domain
   - Add your production reset password URL to `additional_redirect_urls`
   - Update these settings in Supabase Dashboard as well

3. Try copying the link and pasting it directly in the browser

### Testing Reset Password Flow

#### Local Development Testing

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Request password reset**:
   - Navigate to http://localhost:3000/reset-password
   - Enter a valid user email (e.g., demo@idcashier.my.id)
   - Click "Send Reset Link"

3. **Check Inbucket for the email**:
   - Open http://localhost:54324
   - Find the password reset email
   - Copy the reset link from the email

4. **Complete the reset**:
   - Paste the link in your browser
   - Enter a new password (minimum 6 characters)
   - Confirm the password
   - Click "Reset Password"

5. **Verify the reset**:
   - Navigate to the login page
   - Try logging in with the new password

#### Production Testing

1. **Verify SMTP configuration**:
   - Check Supabase Dashboard > Authentication > Settings
   - Ensure SMTP is enabled and configured correctly

2. **Test email delivery**:
   - Request a password reset for a test account
   - Verify the email is received (check spam folder)
   - Check email formatting and branding

3. **Test the complete flow**:
   - Click the reset link from the email
   - Verify redirection to the correct URL
   - Complete the password reset
   - Verify login with the new password

4. **Monitor logs**:
   - Check Supabase logs for any errors
   - Monitor email delivery status

### Production Deployment Checklist

Before deploying the password reset feature to production:

- [ ] **SMTP Configuration**:
  - [ ] Choose an SMTP provider (Gmail, SendGrid, Mailgun, or AWS SES)
  - [ ] Set up SMTP credentials in Supabase Dashboard > Settings > Secrets
  - [ ] Update `supabase/config.toml` with SMTP settings
  - [ ] Uncomment and configure `[auth.email.smtp]` section

- [ ] **URL Configuration**:
  - [ ] Update `site_url` in `supabase/config.toml` to production domain
  - [ ] Add production reset password URL to `additional_redirect_urls`
  - [ ] Update URL settings in Supabase Dashboard > Authentication > URL Configuration

- [ ] **Email Template** (Optional but recommended):
  - [ ] Customize password reset email template
  - [ ] Add branding (logo, colors, footer)
  - [ ] Test email rendering in different email clients
  - [ ] Configure `[auth.email.template.recovery]` in `supabase/config.toml`

- [ ] **Testing**:
  - [ ] Test password reset flow with a test account
  - [ ] Verify email delivery (check inbox and spam)
  - [ ] Test on different devices and browsers
  - [ ] Verify token expiration (after 1 hour)
  - [ ] Test rate limiting (2 emails per hour)

- [ ] **Security**:
  - [ ] Verify HTTPS is enabled on production domain
  - [ ] Check that password requirements are enforced (minimum 6 characters)
  - [ ] Ensure tokens are single-use only
  - [ ] Verify redirect URLs are whitelisted

- [ ] **Monitoring**:
  - [ ] Set up email delivery monitoring
  - [ ] Monitor password reset success/failure rates
  - [ ] Set up alerts for high failure rates

### Advanced Configuration

#### Customizing Token Expiry

To change the password reset link expiry time, update `supabase/config.toml`:

```toml
[auth.email]
# Number of seconds before the email OTP expires (defaults to 1 hour)
otp_expiry = 3600  # Change this value (in seconds)
```

#### Customizing Rate Limits

To change email rate limits, update `supabase/config.toml`:

```toml
[auth.rate_limit]
# Number of emails that can be sent per hour
email_sent = 2  # Change this value
```

#### Custom Email Templates

To use custom email templates:

1. Create an HTML template file (e.g., `supabase/templates/recovery.html`)
2. Use Supabase template variables: `{{ .ConfirmationURL }}`, `{{ .Email }}`, etc.
3. Configure in `supabase/config.toml`:
   ```toml
   [auth.email.template.recovery]
   subject = "Reset Your idCashier Password"
   content_path = "./supabase/templates/recovery.html"
   ```

For more information on email templates, see:
https://supabase.com/docs/guides/auth/auth-email-templates

### Troubleshooting Email Delivery

If emails are not being delivered:

1. **Check Supabase Logs**:
   - Go to Supabase Dashboard > Logs
   - Filter by authentication events
   - Look for SMTP errors

2. **Verify SMTP Credentials**:
   - Test SMTP credentials with a tool like Telnet or an SMTP tester
   - Ensure the SMTP password/API key is correct

3. **Check Email Provider Settings**:
   - Verify sender email is verified/authenticated
   - Check SPF, DKIM, and DMARC records for your domain
   - Review email provider's sending limits

4. **Test with Different Email Addresses**:
   - Try with different email providers (Gmail, Outlook, etc.)
   - Some providers may block emails from certain SMTP servers

5. **Check Firewall/Network Settings**:
   - Ensure port 587 (or your SMTP port) is not blocked
   - Verify network allows outbound SMTP connections

### Getting Help

If you continue to experience issues with password reset:

1. Check Supabase documentation: https://supabase.com/docs/guides/auth/auth-password-reset
2. Review Supabase authentication logs in the dashboard
3. Check the browser console for JavaScript errors
4. Verify all configuration steps in this guide
5. Contact Supabase support or check community forums