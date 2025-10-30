# Registration with Duitku Payment Integration

## Overview

This document explains how to use the `register-with-payment` edge function that handles user registration combined with Duitku payment processing for IDCashier.

## Function Endpoint

```
POST https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/register-with-payment
```

## Request Format

```json
{
  "userData": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "password": "string",
    "role": "string" // Optional, defaults to 'owner'
  },
  "paymentData": {
    "paymentAmount": "number",
    "productDetails": "string",
    "merchantOrderId": "string",
    "customerVaName": "string",
    "customerEmail": "string",
    "customerPhone": "string",
    "paymentMethod": "string" // Optional, defaults to 'ALL'
  }
}
```

## Response Format

```json
{
  "success": true,
  "message": "Registration initiated successfully. Please complete the payment to activate your account.",
  "paymentUrl": "string",
  "userId": "string",
  "paymentId": "string"
}
```

## Features

1. **User Registration Processing**
   - Validates user input data (name, email, phone, password)
   - Creates user accounts in both Supabase Auth and public.users tables
   - Implements proper error handling and rollback mechanisms

2. **Duitku Payment Integration**
   - Integrates with Duitku.com payment gateway
   - Supports multiple payment methods
   - Generates secure signatures for API communication
   - Handles both sandbox and production environments

3. **Data Validation**
   - Comprehensive validation for user registration data
   - Validation for payment information
   - Secure handling of sensitive data

4. **Transaction Management**
   - Creates payment records in the database
   - Updates payment status based on Duitku callbacks
   - Maintains data consistency through rollback mechanisms

5. **Security Features**
   - Strong authentication using Supabase service roles
   - Signature verification for Duitku callbacks
   - PCI DSS compliant data handling
   - Secure storage of transaction data

6. **Logging and Monitoring**
   - Detailed logging for transaction tracking
   - Error reporting and monitoring
   - Audit trail for compliance purposes

## Environment Variables

The function requires the following environment variables to be set in Supabase:

- `DUITKU_ENVIRONMENT` - Either 'sandbox' or 'production'
- `DUITKU_SANDBOX_MERCHANT_CODE` - Merchant code for sandbox environment
- `DUITKU_SANDBOX_API_KEY` - API key for sandbox environment
- `DUITKU_SANDBOX_BASE_URL` - Base URL for sandbox environment (https://sandbox.duitku.com)
- `DUITKU_PRODUCTION_MERCHANT_CODE` - Merchant code for production environment
- `DUITKU_PRODUCTION_API_KEY` - API key for production environment
- `DUITKU_PRODUCTION_BASE_URL` - Base URL for production environment (https://passport.duitku.com)

For detailed instructions on how to set these environment variables, see [DUITKU_ENVIRONMENT_SETUP.md](DUITKU_ENVIRONMENT_SETUP.md).

## Testing

### Unit Testing

Run the test script to verify functionality:
```bash
node test-register-with-payment.js
```

### Load Testing

Run the load test to verify performance under high load:
```bash
node load-test-register-with-payment.js
```

## Error Handling

The function implements comprehensive error handling:

1. **Input Validation Errors**
   - Returns 400 Bad Request for invalid input data
   - Provides detailed error messages for validation failures

2. **Authentication Errors**
   - Returns 401 Unauthorized for authentication failures
   - Returns 403 Forbidden for authorization failures

3. **Processing Errors**
   - Returns 500 Internal Server Error for unexpected failures
   - Implements rollback mechanisms to maintain data consistency

4. **Duitku API Errors**
   - Handles Duitku API errors gracefully
   - Logs errors for troubleshooting