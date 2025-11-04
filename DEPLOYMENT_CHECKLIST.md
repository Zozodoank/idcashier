# Deployment Checklist

This document provides a comprehensive checklist to ensure smooth and error-free deployments for the idCashier application. Follow these steps meticulously to prevent common issues related to Edge Functions, environment variables, and database migrations.

---

## 1. Pre-Deployment Checklist

- [ ] **Verify Supabase CLI:** Ensure the Supabase CLI is installed, up-to-date, and you are logged in.
  ```bash
  supabase --version
  supabase login
  ```
- [ ] **Backup Database:** Always create a backup of the production database before deploying any changes, especially migrations.
  ```bash
  supabase db dump -f backup-$(date +%Y%m%d%H%M%S).sql --project-ref eypfeiqtvfxxiimhtycc
  ```
- [ ] **Verify Project Credentials:** Double-check that you are targeting the correct Supabase project ID (`eypfeiqtvfxxiimhtycc`).

---

## 2. Edge Functions Deployment

Deploy Edge Functions using the appropriate flags. Auth-related functions require `--no-verify-jwt`.

- **Deploy All Auth Functions (Recommended):**
  ```bash
  npm run deploy:auth-functions
  ```

- **Individual Auth Function Deployment:**
  - `auth-login`:
    ```bash
    npx supabase functions deploy auth-login --no-verify-jwt --project-ref eypfeiqtvfxxiimhtycc
    ```
  - `auth-register`:
    ```bash
    npx supabase functions deploy auth-register --no-verify-jwt --project-ref eypfeiqtvfxxiimhtycc
    ```
  - `auth-request-password-reset`:
    ```bash
    npx supabase functions deploy auth-request-password-reset --no-verify-jwt --project-ref eypfeiqtvfxxiimhtycc
    ```

- **Deploy All Other Functions:**
  ```bash
  npm run deploy:all-functions
  ```

- **Verify Deployment:** After deployment, list all functions to ensure they are active.
  ```bash
  supabase functions list --project-ref eypfeiqtvfxxiimhtycc
  ```

---

## 3. Environment Variables & Secrets Setup

Production secrets must be set in the Supabase Dashboard, not in `.env` files.

- **Required Secrets:**
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_ORIGINS` (e.g., `https://idcashier.my.id,http://localhost:3000`)
  - `FRONTEND_URL`
  - `JWT_SECRET`
  - `CRONJOB_SECRET`
  - `DUITKU_MERCHANT_CODE`
  - `DUITKU_API_KEY`
  - `DUITKU_CALLBACK_URL`
  - `EMAIL_PASSWORD`

- **Setup Guide:**
  1. Navigate to **Project Settings > Environment Variables** in the Supabase Dashboard.
  2. Add each secret with its correct name and value.
  3. For a detailed guide, refer to `SUPABASE_SECRETS_SETUP.md`.

- **Verification:**
  - Run the verification script: `node tools/verify-deployment.js`
  - Manually check the "Secrets" section in the dashboard to ensure all required variables are present.

---

## 4. Testing & Verification

- **Test Endpoints with `curl`:**
  - **auth-login:**
    ```bash
    curl -X POST https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <ANON_KEY>" \
    -d '{"email":"demo@idcashier.my.id","password":"password"}'
    ```
- **Check Logs:** Monitor logs in the Supabase Dashboard under **Edge Functions > Logs**.
- **Browser Verification:**
  - Open the browser's Developer Tools (F12).
  - Go to the Network tab.
  - Attempt to log in and check the `auth-login` request for CORS headers and response status.
- **Run Automated Verification Script:**
  ```bash
  node tools/verify-deployment.js
  ```

---

## 5. Rollback Plan

- **Rollback Function Deployment:** If a function is faulty, you can deploy a previous stable version from Git history.
- **Restore Database:** If migrations cause issues, restore the database from the backup created in the pre-deployment step.
  ```bash
  psql -h <db_host> -p <db_port> -U postgres -f <backup_file>.sql
  ```
- **Emergency Contact:** In case of critical failure, contact the project lead immediately.

---

## 6. Post-Deployment Monitoring

- **Monitor Metrics:** Keep an eye on the **Edge Functions** dashboard for error rates, response times, and invocation counts.
- **Real-time Logs:** Use the `supabase functions logs` command to stream logs in real-time.
- **Alerts:** Set up alerts for critical errors (e.g., >5% error rate in 5 minutes) using Supabase's monitoring integrations.

---
*For more detailed troubleshooting, refer to `TROUBLESHOOTING.md` and `EMERGENCY_FIX_LOGIN_ISSUE.md`.*
