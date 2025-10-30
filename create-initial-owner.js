// Script to create an initial owner user with proper tenant_id
// This script is for testing the new multi-tenancy schema

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test owner user credentials
const testOwner = {
  email: 'test-owner@idcashier.my.id',
  password: 'TestOwner2025',
  name: 'Test Owner',
  role: 'owner'
};

async function createInitialOwner() {
  try {
    console.log('=== Creating Initial Owner User ===\n');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(testOwner.password, 10);
    
    // Generate user ID
    const userId = randomUUID();
    
    console.log('Creating owner user with proper tenant_id...');
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${testOwner.email}`);
    console.log(`Name: ${testOwner.name}`);
    console.log(`Role: ${testOwner.role}`);
    console.log(`Tenant ID: ${userId} (same as user ID for owners)\n`);
    
    // Insert the user with tenant_id set to their own ID (owners own their tenant)
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          name: testOwner.name,
          email: testOwner.email,
          password: hashedPassword,
          role: testOwner.role,
          tenant_id: userId  // For owners, tenant_id equals their own ID
        }
      ])
      .select('id, name, email, role, tenant_id');
    
    if (error) {
      console.error('Error creating owner user:', error.message);
      process.exit(1);
    }
    
    console.log('✓ Owner user created successfully!');
    console.log('User details:');
    console.log(`  ID: ${data[0].id}`);
    console.log(`  Name: ${data[0].name}`);
    console.log(`  Email: ${data[0].email}`);
    console.log(`  Role: ${data[0].role}`);
    console.log(`  Tenant ID: ${data[0].tenant_id}`);
    
    console.log('\n=== Test Credentials ===');
    console.log(`Email: ${testOwner.email}`);
    console.log(`Password: ${testOwner.password}`);
    console.log('\nYou can now test the multi-tenancy functionality with these credentials.');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

createInitialOwner();