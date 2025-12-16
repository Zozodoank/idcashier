#!/usr/bin/env node

/**
 * Products Cleanup Cronjob Script
 * Removes orphaned products (products that belong to deleted users)
 * Can be scheduled via pg_cron in Supabase or run manually
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Try multiple paths for .env file
const envPaths = [
  join(__dirname, '../.env'),
  join(__dirname, '.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    console.log(`📄 Loaded environment from: ${envPath}`);
    envLoaded = true;
    break;
  } catch (error) {
    // Continue trying other paths
  }
}

if (!envLoaded) {
  console.log('⚠️ No .env file found, using existing process.env');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const tenantIdArg = args.find(arg => arg.startsWith('--tenant-id='));
const tenantId = tenantIdArg ? tenantIdArg.split('=')[1] : null;

console.log('🧹 Products Cleanup Cronjob Starting...');
console.log('=========================================');
console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
console.log('Force:', force ? 'YES' : 'NO');
if (tenantId) console.log('Tenant Filter:', tenantId);
console.log('Timestamp:', new Date().toISOString());
console.log('=========================================\n');

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('✅ Supabase credentials loaded');
console.log('🌐 URL:', supabaseUrl);

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function cleanupOrphanedProducts() {
  const startTime = Date.now();
  let totalCleaned = 0;
  let errors = [];

  try {
    console.log('🔍 Step 1: Validating database connection...');
    
    // Test connection
    const { error: connError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (connError) {
      throw new Error(`Database connection failed: ${connError.message}`);
    }
    console.log('✅ Database connection validated\n');

    console.log('🔍 Step 2: Fetching existing users...');
    
    // Get all existing users
    let userQuery = supabase.from('users').select('id, email');
    
    if (tenantId) {
      userQuery = userQuery.or(`id.eq.${tenantId},tenant_id.eq.${tenantId}`);
    }
    
    const { data: existingUsers, error: usersError } = await userQuery;
    
    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }
    
    const validUserIds = existingUsers.map(user => user.id);
    console.log(`✅ Found ${existingUsers.length} valid users`);
    
    if (tenantId) {
      console.log(`📊 Filtering by tenant: ${tenantId}`);
    }

    console.log('\n🔍 Step 3: Analyzing products...');
    
    // Get all products
    let productsQuery = supabase
      .from('products')
      .select('id, name, user_id, barcode, price, cost, stock, created_at');
    
    if (tenantId) {
      productsQuery = productsQuery.eq('user_id', tenantId);
    }
    
    const { data: allProducts, error: productsError } = await productsQuery;
    
    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }
    
    console.log(`📊 Total products found: ${allProducts.length}`);
    
    if (allProducts.length === 0) {
      console.log('ℹ️ No products found. Cleanup not needed.');
      return { cleaned: 0, errors: [] };
    }
    
    // Find orphaned products (products with invalid user_id)
    const orphanedProducts = allProducts.filter(product => 
      !validUserIds.includes(product.user_id)
    );
    
    console.log(`🗑️ Orphaned products found: ${orphanedProducts.length}`);
    
    if (orphanedProducts.length === 0) {
      console.log('✅ No orphaned products to clean up.');
      return { cleaned: 0, errors: [] };
    }
    
    // Display orphaned products details
    console.log('\n📋 Orphaned Products Details:');
    console.log('ID\t\t\tName\t\t\tUser ID\t\t\tCreated');
    console.log('-'.repeat(100));
    
    orphanedProducts.forEach(product => {
      console.log(`${product.id.substring(0, 8)}\t${product.name.substring(0, 15)}\t${product.user_id.substring(0, 8)}\t${product.created_at.split('T')[0]}`);
    });
    
    console.log('\n🧹 Step 4: Cleanup Decision...');
    
    // Confirmation for live mode
    if (!dryRun && !force) {
      console.log(`⚠️ About to delete ${orphanedProducts.length} orphaned products.`);
      console.log('This action cannot be undone!');
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Do you want to proceed? (yes/no): ', resolve);
      });
      readline.close();
      
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Cleanup cancelled by user.');
        return { cleaned: 0, errors: ['Cancelled by user'] };
      }
    }
    
    console.log('\n🧹 Step 5: Executing cleanup...');
    
    if (dryRun) {
      console.log(`[DRY RUN] Would delete ${orphanedProducts.length} orphaned products`);
      orphanedProducts.forEach(product => {
        console.log(`  - ${product.name} (${product.id})`);
      });
    } else {
      // Execute actual cleanup
      const orphanedIds = orphanedProducts.map(p => p.id);
      
      console.log('🗑️ Deleting orphaned products...');
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', orphanedIds);
      
      if (deleteError) {
        throw new Error(`Failed to delete products: ${deleteError.message}`);
      }
      
      console.log(`✅ Successfully deleted ${orphanedProducts.length} orphaned products`);
      totalCleaned = orphanedProducts.length;
    }
    
    // Final cleanup check
    console.log('\n🔍 Step 6: Verification...');
    const { data: remainingProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' });
    
    if (remainingProducts) {
      console.log(`📊 Remaining products in database: ${remainingProducts.length}`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ Cleanup completed in ${duration}ms`);
    
    return { cleaned: totalCleaned, errors };
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    errors.push(error.message);
    return { cleaned: 0, errors };
  }
}

// Main execution
async function main() {
  try {
    const result = await cleanupOrphanedProducts();
    
    console.log('\n📊 CRONJOB SUMMARY:');
    console.log('==================');
    console.log(`Products cleaned: ${result.cleaned}`);
    console.log(`Errors encountered: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`\n${result.cleaned > 0 ? '✅' : 'ℹ️'} Products cleanup cronjob completed at ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    if (result.errors.length > 0 && !dryRun) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { cleanupOrphanedProducts };