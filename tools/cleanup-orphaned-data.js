// Script to clean up orphaned data in Supabase
// This script removes sales data that belongs to deleted users
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Cleaning up orphaned data in Supabase...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

// Note: For cleanup operations, you'll need the service role key which has admin privileges
// You can find this in your Supabase project dashboard under Settings > API > Service Role Key
console.log('\nIMPORTANT: To clean up orphaned data, you need the Service Role Key.');
console.log('1. Go to your Supabase project dashboard');
console.log('2. Navigate to Settings > API');
console.log('3. Copy the Service Role Key (not the anon key)');
console.log('4. Add it to your .env file as SUPABASE_SERVICE_ROLE_KEY');
console.log('5. Run this script again');

// If you have the service role key, you can uncomment the following code:
/*
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('Service Role Key not found in environment variables.');
  console.error('Please add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanupOrphanedData() {
  try {
    console.log('Starting cleanup process...');
    
    // First, get all user IDs that currently exist
    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('id');
    
    if (usersError) {
      throw new Error(`Error fetching users: ${usersError.message}`);
    }
    
    const existingUserIds = existingUsers.map(user => user.id);
    console.log(`Found ${existingUserIds.length} existing users.`);
    
    // Get all sales and their user_ids
    const { data: allSales, error: salesError } = await supabase
      .from('sales')
      .select('id, user_id');
    
    if (salesError) {
      throw new Error(`Error fetching sales: ${salesError.message}`);
    }
    
    console.log(`Found ${allSales.length} total sales.`);
    
    // Find sales with orphaned user_ids (user_id not in existingUserIds)
    const orphanedSales = allSales.filter(sale => !existingUserIds.includes(sale.user_id));
    console.log(`Found ${orphanedSales.length} orphaned sales.`);
    
    if (orphanedSales.length > 0) {
      // Delete orphaned sales (this will cascade to sale_items due to foreign key constraints)
      const orphanedSaleIds = orphanedSales.map(sale => sale.id);
      
      console.log('Deleting orphaned sales...');
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .in('id', orphanedSaleIds);
      
      if (deleteError) {
        throw new Error(`Error deleting orphaned sales: ${deleteError.message}`);
      }
      
      console.log(`Successfully deleted ${orphanedSales.length} orphaned sales.`);
    } else {
      console.log('No orphaned sales found.');
    }
    
    // Also clean up any orphaned customers, categories, suppliers, products
    // that might not be referenced anymore
    
    // Clean up orphaned customers
    const { data: allCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id');
    
    if (!customersError) {
      const customerIds = allCustomers.map(customer => customer.id);
      if (customerIds.length > 0) {
        // Check if any sales still reference these customers
        const { data: salesWithCustomers, error: salesCustomersError } = await supabase
          .from('sales')
          .select('customer_id')
          .not('customer_id', 'is', null)
          .in('customer_id', customerIds);
        
        if (!salesCustomersError) {
          const referencedCustomerIds = salesWithCustomers.map(sale => sale.customer_id);
          const orphanedCustomerIds = customerIds.filter(id => !referencedCustomerIds.includes(id));
          
          if (orphanedCustomerIds.length > 0) {
            console.log(`Deleting ${orphanedCustomerIds.length} orphaned customers...`);
            await supabase
              .from('customers')
              .delete()
              .in('id', orphanedCustomerIds);
          }
        }
      }
    }
    
    console.log('Cleanup process completed successfully.');
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedData().catch(console.error);
*/

console.log('\nThis script will clean up orphaned data in Supabase.');
console.log('Orphaned data includes sales that belong to deleted users.');
console.log('The cleanup process will:');
console.log('1. Find all existing users');
console.log('2. Find all sales and identify those with non-existent user_ids');
console.log('3. Delete orphaned sales (which will cascade to sale_items)');
console.log('4. Clean up other orphaned data (customers, categories, etc.)');

console.log('\nTo execute this script:');
console.log('1. Add your Supabase Service Role Key to the .env file');
console.log('2. Uncomment the code section in this file');
console.log('3. Run: node tools/cleanup-orphaned-data.js');