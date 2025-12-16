# Supabase Secrets Setup Guide

## 1. Introduction

This guide provides a step-by-step process for configuring the necessary secrets (environment variables) in your Supabase project dashboard.

**Why are secrets necessary?**
Secrets are used to store sensitive information like API keys, service role keys, and database credentials. They are essential for the proper functioning of Edge Functions and integrations.

**Local vs. Production:**
- **Local Development:** Use the `.env` file for local development. This file is ignored by Git and should not be committed.
- **Production:** Secrets must be set in the **Supabase Dashboard** under **Project Settings > Environment Variables**. This is the secure way to manage production credentials.

---

## 2. Required Secrets List

| Secret Name                 | Purpose                                           | Where to Get Value                                     | Required For                  |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Allows Edge Functions to bypass RLS policies.     | Supabase Dashboard > Project Settings > API            | All internal auth functions   |
| `ALLOWED_ORIGINS`           | Configures CORS for Edge Functions.               | Your frontend domain(s) (e.g., `https://idcashier.my.id`) | All public-facing functions |
| `FRONTEND_URL`              | Backward compatibility for certain functions.     | Your primary frontend URL                              | Legacy functions              |
| `JWT_SECRET`                | Used for signing JWTs.                            | Supabase Dashboard > Project Settings > API            | Auth operations               |
| `CRONJOB_SECRET`            | Secures scheduled cron job functions.             | Generate a secure random string                        | Scheduled functions           |
| `DUITKU_MERCHANT_CODE`      | Duitku payment gateway merchant code.             | Your Duitku merchant dashboard                         | Duitku payment integration    |
| `DUITKU_API_KEY`            | Duitku payment gateway API key.                   | Your Duitku merchant dashboard                         | Duitku payment integration    |
| `DUITKU_CALLBACK_URL`       | Duitku payment gateway callback URL.              | Your deployed `duitku-callback` function URL           | Duitku payment integration    |
| `EMAIL_PASSWORD`            | Password for the SMTP email server.               | Your email provider                                    | Sending transactional emails  |

---

## 3. Step-by-Step Setup Guide

1.  **Login to Supabase Dashboard:**
    Access your project at [https://supabase.com/dashboard](https://supabase.com/dashboard).

2.  **Navigate to Environment Variables:**
    Go to **Project Settings** (the gear icon) and then select **Environment Variables**.
    *(Placeholder for screenshot: Supabase dashboard with "Environment Variables" highlighted)*

3.  **Add Each Secret:**
    Click **"Add new variable"**. Enter the **Secret Name** exactly as listed in the table above and paste its corresponding **Value**.
    *(Placeholder for screenshot: "Add new variable" modal with name and value fields)*

4.  **Verify Secrets:**
    After adding all secrets, double-check that they are all listed correctly.

5.  **Restart Edge Functions:**
    It's good practice to restart the Edge Functions after updating secrets to ensure they pick up the new values. You can do this by making a new deployment.

---

## 4. Verification

- **Automated Check:** Run the verification script from your local terminal.
  ```bash
  node tools/verify-deployment.js
  ```
- **Manual Test:** Invoke an Edge Function that relies on a secret (e.g., `auth-login`) and check the logs for any "secret not found" errors.

---

## 5. Security Considerations

- **NEVER commit secrets to Git.** The `.gitignore` file should include `.env`.
- **Rotate secrets periodically,** especially the `SUPABASE_SERVICE_ROLE_KEY`.
- **Use different secrets** for staging and production environments.
- **Enable audit logs** in your Supabase project to track changes to secrets.

---

## 6. Troubleshooting

- **"Secret not found" error:** Ensure the secret name in the dashboard is an exact match to the name used in the function code (e.g., `Deno.env.get('SECRET_NAME')`).
- **"Invalid secret value" error:** Check for any extra spaces or characters that may have been copied by mistake.
- **"CORS error":** Verify that your `ALLOWED_ORIGINS` secret includes the correct frontend URL, without a trailing slash.
