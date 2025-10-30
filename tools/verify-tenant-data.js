#!/usr/bin/env node

// Verification script for tenant data integrity in idCashier
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const userEmail = args[0];

if (!userEmail) {
  console.log('Usage: node tools/verify-tenant-data.js <user-email>');
  console.log('Example: node tools/verify-tenant-data.js owner@example.com');
  process.exit(1);
}

console.log(`Verifying tenant data integrity for user: ${userEmail}`);

// Check if required environment variables are set
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\n❌ Missing required environment variables');
  console.log('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyTenantData() {
  try {
    console.log('\nStarting tenant data verification...\n');
    
    // Query user based on email
    console.log('Fetching user information...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id')
      .eq('email', userEmail)
      .single();
    
    if (userError || !user) {
      console.log(`❌ User with email ${userEmail} not found`);
      process.exit(1);
    }
    
    console.log('✅ User found');
    console.log(`- ID: ${user.id}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Name: ${user.name || 'N/A'}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Tenant ID: ${user.tenant_id}`);
    
    // Get all users in the tenant using the same logic as dashboard.js
    console.log('\nFetching all users in the tenant...');
    const { data: tenantUsers, error: tenantError } = await supabase
      .from('users')
      .select('id, email, name, role, tenant_id')
      .or(`id.eq.${user.tenant_id},tenant_id.eq.${user.tenant_id}`);
    
    if (tenantError) {
      throw new Error(`Error fetching tenant users: ${tenantError.message}`);
    }
    
    console.log(`✅ Found ${tenantUsers.length} users in the tenant`);
    
    // Initialize aggregate counters
    let totalSales = 0;
    let totalProducts = 0;
    let totalCustomers = 0;
    
    // Initialize anomalies array
    const anomalies = [];
    
    // Check for users with null tenant_id
    const usersWithNullTenantId = tenantUsers.filter(u => u.tenant_id === null);
    if (usersWithNullTenantId.length > 0) {
      usersWithNullTenantId.forEach(u => {
        anomalies.push(`User ${u.email} has null tenant_id`);
      });
    }
    
    // Check for users with invalid tenant_id (tenant_id not in users table)
    const allUserIds = (await supabase.from('users').select('id')).data.map(u => u.id);
    const usersWithInvalidTenantId = tenantUsers.filter(u => u.tenant_id && !allUserIds.includes(u.tenant_id));
    if (usersWithInvalidTenantId.length > 0) {
      usersWithInvalidTenantId.forEach(u => {
        anomalies.push(`User ${u.email} has invalid tenant_id: ${u.tenant_id}`);
      });
    }
    
    console.log('\n=== Tenant Information ===');
    console.log(`- Tenant ID: ${user.tenant_id}`);
    console.log(`- Owner: ${user.email}`);
    console.log(`- Total Users: ${tenantUsers.length}`);
    
    console.log('\n=== Users in Tenant ===');
    for (let i = 0; i < tenantUsers.length; i++) {
      const tenantUser = tenantUsers[i];
      
      // Get sales count for this user
      const { count: salesCount, error: salesError } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', tenantUser.id);
      
      if (salesError) {
        console.log(`⚠️  Error fetching sales for user ${tenantUser.email}: ${salesError.message}`);
        continue;
      }
      
      // Get products count for this user
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', tenantUser.id);
      
      if (productsError) {
        console.log(`⚠️  Error fetching products for user ${tenantUser.email}: ${productsError.message}`);
        continue;
      }
      
      // Get customers count for this user
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', tenantUser.id);
      
      if (customersError) {
        console.log(`⚠️  Error fetching customers for user ${tenantUser.email}: ${customersError.message}`);
        continue;
      }
      
      // Add to aggregate totals
      totalSales += salesCount || 0;
      totalProducts += productsCount || 0;
      totalCustomers += customersCount || 0;
      
      console.log(`${i + 1}. ${tenantUser.role === 'owner' ? 'Owner' : 'Cashier'} (${tenantUser.email})`);
      console.log(`   - Sales: ${salesCount || 0}`);
      console.log(`   - Products: ${productsCount || 0}`);
      console.log(`   - Customers: ${customersCount || 0}`);
    }
    
    console.log('\n=== Total Tenant Stats ===');
    console.log(`- Total Sales: ${totalSales}`);
    console.log(`- Total Products: ${totalProducts}`);
    console.log(`- Total Customers: ${totalCustomers}`);
    
    // Check for sales with user_id not in tenant
    console.log('\nChecking for orphaned sales...');
    const tenantUserIds = tenantUsers.map(u => u.id);
    const { data: allSales, error: allSalesError } = await supabase
      .from('sales')
      .select('id, user_id');
    
    if (allSalesError) {
      console.log(`⚠️  Error fetching all sales: ${allSalesError.message}`);
    } else {
      const orphanedSales = allSales.filter(sale => !tenantUserIds.includes(sale.user_id));
      if (orphanedSales.length > 0) {
        orphanedSales.forEach(sale => {
          anomalies.push(`Sale ${sale.id} has user_id ${sale.user_id} not in tenant`);
        });
      }
    }
    
    console.log('\n=== Anomalies Found ===');
    if (anomalies.length === 0) {
      console.log('- None');
    } else {
      anomalies.forEach(anomaly => {
        console.log(`- ${anomaly}`);
      });
    }
    
    console.log('\n✅ Tenant data verification completed successfully');
    
  } catch (error) {
    console.error('❌ Error during tenant data verification:', error.message);
    process.exit(1);
  }
}

// Run the verification
verifyTenantData().catch(console.error);