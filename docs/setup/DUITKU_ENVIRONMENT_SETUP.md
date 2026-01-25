# Duitku Environment Variable Setup

## Required Environment Variables

The following environment variables need to be configured in your Supabase project for the Duitku integration to work properly:

### Sandbox Environment (for testing)

1. `DUITKU_ENVIRONMENT` = "production"
2. `DUITKU_MERCHANT_CODE` = "<your_production_merchant_code>"
3. `DUITKU_API_KEY` = "<your_production_api_key>"
4. `DUITKU_BASE_URL` = "https://passport.duitku.com"
5. `DUITKU_WEBAPI_BASE_URL` = "https://passport.duitku.com/webapi"

### Production Environment (for live transactions)

1. `DUITKU_ENVIRONMENT` = "production"
2. `DUITKU_PRODUCTION_MERCHANT_CODE` = "your_production_merchant_code"
3. `DUITKU_PRODUCTION_API_KEY` = "your_production_api_key"
4. `DUITKU_PRODUCTION_BASE_URL` = "https://passport.duitku.com"

## How to Set Environment Variables in Supabase Dashboard

1. Log in to your Supabase account
2. Navigate to your project
3. Go to "Settings" in the left sidebar
4. Click on "Secrets" under the Configuration section
5. Click "Add new secret" button
6. Add each of the required environment variables listed above
7. Click "Save" for each secret

## Testing the Configuration

After setting the environment variables, you can test the configuration by:

1. Running the test script: `node test-register-with-payment.js`
2. Checking the function logs in the Supabase Dashboard under "Functions" > "register-with-payment" > "Logs"

## Security Notes

- Never commit sensitive information like API keys to version control
- Rotate your API keys regularly for security
- Gunakan sandbox hanya untuk testing terpisah. Untuk go-live, pastikan environment ini production.
- Monitor your Duitku dashboard for transaction status