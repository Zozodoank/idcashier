#!/usr/bin/env node

// Script to clean up orphaned sales data in Supabase
// This script removes sales data that belongs to deleted users
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const tenantIdArg = args.find(arg => arg.startsWith('--tenant-id='));
const tenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;

console.log('Cleaning up orphaned sales data in Supabase...');
console.log('Dry-run mode:', dryRun ? 'ON' : 'OFF');
console.log('Force mode:', force ? 'ON' : 'OFF');
if (tenantId) {
  console.log('Tenant ID filter:', tenantId);
}

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanupOrphanedSales() {
  try {
    console.log('Starting cleanup process...');
    
    // Validate Supabase connection
    console.log('Validating Supabase connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (healthError) {
      throw new Error(`Supabase connection failed: ${healthError.message}`);
    }
    console.log('Supabase connection validated successfully.');
    
    // First, get all user IDs that currently exist
    console.log('Fetching existing users...');
    let userQuery = supabase.from('users').select('id');
    
    // If tenantId is specified, filter users by tenant
    if (tenantId) {
      userQuery = userQuery.or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`);
    }
    
    const { data: existingUsers, error: usersError } = await userQuery;
    
    if (usersError) {
      throw new Error(`Error fetching users: ${usersError.message}`);
    }
    
    const existingUserIds = existingUsers.map(user => user.id);
    console.log(`Found ${existingUserIds.length} existing users.`);
    
    // Get all sales and their user_ids
    console.log('Fetching all sales...');
    let salesQuery = supabase.from('sales').select('id, user_id, total_amount, created_at');
    
    // If tenantId is specified, filter sales by tenant
    if (tenantId) {
      salesQuery = salesQuery.eq('user_id', tenantId);
    }
    
    const { data: allSales, error: salesError } = await salesQuery;
    
    if (salesError) {
      throw new Error(`Error fetching sales: ${salesError.message}`);
    }
    
    console.log(`Found ${allSales.length} total sales.`);
    
    // Find sales with orphaned user_ids (user_id not in existingUserIds)
    const orphanedSales = allSales.filter(sale => !existingUserIds.includes(sale.user_id));
    console.log(`Found ${orphanedSales.length} orphaned sales.`);
    
    // Display orphaned sales details
    if (orphanedSales.length > 0) {
      console.log('\nOrphaned Sales Details:');
      console.log('ID\t\t\t\tUser ID\t\t\t\tTotal Amount\tCreated At');
      console.log('-'.repeat(100));
      orphanedSales.forEach(sale => {
        console.log(`${sale.id}\t${sale.user_id}\t${sale.total_amount}\t\t${sale.created_at}`);
      });
      
      // If not in force mode, ask for confirmation
      if (!force && !dryRun) {
        console.log(`\nAbout to delete ${orphanedSales.length} orphaned sales.`);
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('Do you want to proceed with deletion? (yes/no): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
          console.log('Operation cancelled by user.');
          return;
        }
      }
      
      if (dryRun) {
        console.log(`[DRY RUN] Would delete ${orphanedSales.length} orphaned sales.`);
        console.log('No actual deletions were performed.');
      } else {
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
        console.log('This operation also removed associated sale_items due to foreign key constraints.');
      }
    } else {
      console.log('No orphaned sales found.');
    }
    
    console.log('\nCleanup process completed successfully.');
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrphanedSales().catch(console.error);