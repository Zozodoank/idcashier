# API Documentation

The backend API consists of Supabase Edge Functions.

## Edge Functions List

For a comprehensive list of Edge Functions and how to test them, please refer to [Backend Testing Guide](../testing/BACKEND_TESTING_GUIDE.md).

## Authentication

Authentication is handled via Supabase Auth.
Most endpoints require `Authorization: Bearer <token>` header.

## Endpoint Groups

- **Authentication**: `auth-login`, `auth-register`, `auth-me`
- **Products**: `products-create`, `products-get-all`, `products-update`, `products-delete`
- **Sales**: `sales-create`, `sales-get-all`
- **Customers**: `customers-create`, `customers-get-all`
- **Payment**: `duitku-payment-request`, `duitku-callback`
- **Dashboard**: `dashboard-stats`

See the testing guide for detailed usage examples.
