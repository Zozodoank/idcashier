# Multi-Tenancy Implementation Testing Instructions

This document provides step-by-step instructions for testing the multi-tenancy implementation in the idCashier POS system.

## Prerequisites

1. Ensure all the changes from the multi-tenancy implementation have been applied
2. Make sure the backend server is running (`npm run server` or `npm run dev:full`)
3. Make sure the frontend is running (`npm run dev` or `npm run dev:full`)

## Testing Steps

### 1. Database Schema Update

1. Apply the updated schema to your database:
   ```bash
   npm run supabase:apply-schema
   ```
   
   Or manually run the updated schema SQL against your database.

### 2. Owner Account Creation

1. Register a new owner account through the registration page
2. Verify that the owner can log in successfully
3. Check that the owner's `tenant_id` in the database is set to their own `id`

### 3. Cashier Account Creation

1. Log in as an owner
2. Navigate to Settings > Account Management
3. Click "Add Cashier"
4. Fill in the cashier's email and password
5. Save the cashier account
6. Verify that the cashier appears in the list
7. Check the database to confirm:
   - The cashier has `role` = 'cashier'
   - The cashier's `tenant_id` is set to the owner's `id`

### 4. Cashier Login

1. Log out as the owner
2. Log in using the cashier's credentials
3. Verify that the cashier can access the system
4. Verify that the cashier sees the owner's store settings (name, address, etc.)

### 5. Data Access Testing

#### Products
1. As owner: Create some products
2. As cashier: Verify you can see the owner's products
3. As cashier: Try to create a product and verify it's associated with your user_id
4. As owner: Verify you can see products created by the cashier

#### Sales
1. As cashier: Create a sale
2. As owner: Navigate to Reports and verify you can see the cashier's sales
3. As cashier: Verify you can only see your own sales in Reports

#### Categories
1. As owner: Create some categories
2. As cashier: Verify you can see the owner's categories
3. As cashier: Try to create a category and verify it's associated with your user_id
4. As owner: Verify you can see categories created by the cashier

#### Suppliers
1. As owner: Create some suppliers
2. As cashier: Verify you can see the owner's suppliers
3. As cashier: Try to create a supplier and verify it's associated with your user_id
4. As owner: Verify you can see suppliers created by the cashier

#### Customers
1. As owner: Create some customers
2. As cashier: Verify you can see the owner's customers
3. As cashier: Try to create a customer and verify it's associated with your user_id
4. As owner: Verify you can see customers created by the cashier

### 6. Data Isolation Testing

1. Create a second owner account
2. Create a cashier for the second owner
3. Verify that:
   - First owner cannot see second owner's data
   - Second owner cannot see first owner's data
   - First cashier cannot see second owner's data
   - Second cashier cannot see first owner's data

### 7. Customer Management Testing

1. As owner: Navigate to Settings > Customer Management
2. Add, edit, and delete customers
3. As cashier: Try to access customer management (should be restricted)
4. Verify all operations work correctly and are properly filtered by tenant

### 8. Receipt Settings Testing

1. As owner: Update receipt settings
2. As cashier: Verify you see the owner's receipt settings
3. Make a sale as cashier and verify the receipt uses owner's settings

## Expected Results

- Owners can create cashier accounts that are properly stored in the database
- Cashiers can log in with their credentials
- Cashiers can access and modify owner's data based on permissions
- Data remains isolated between different tenants
- All CRUD operations work correctly with tenant-based filtering
- No data leakage between tenants

## Troubleshooting

### If cashiers cannot log in:
1. Check that the cashier record exists in the `users` table
2. Verify that the cashier's `tenant_id` is correctly set to the owner's `id`
3. Check the backend logs for authentication errors

### If data is not properly filtered:
1. Verify that all API routes are using tenant-based filtering instead of user-based filtering
2. Check that the frontend is sending the JWT token with requests
3. Verify that the JWT token contains the `tenantId` field

### If database errors occur:
1. Ensure the schema has been properly updated with the `tenant_id` column
2. Verify that the foreign key constraint is correctly set up
3. Check that the index on `tenant_id` has been created

## Rollback Plan

If issues are encountered, you can rollback the changes by:

1. Restoring the previous database schema (without the `tenant_id` column)
2. Reverting the backend code changes in:
   - `server/routes/auth.js`
   - `server/routes/users.js`
   - `server/routes/products.js`
   - `server/routes/sales.js`
   - `server/routes/categories.js`
   - `server/routes/suppliers.js`
   - `server/routes/customers.js` (delete this file)
   - `server/server.js` (remove customers route)
3. Reverting the frontend code changes in:
   - `src/pages/SettingsPage.jsx`
   - `src/pages/SalesPage.jsx`
   - `src/lib/api.js` (remove customersAPI)

## Conclusion

After completing these tests, the multi-tenancy implementation should be fully functional, allowing owners to create cashier accounts that can actually log in and access the owner's data while maintaining proper data isolation between different tenants.