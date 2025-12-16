// Script to create testing user
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Creating testing user via Edge Function...');

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables.');
  process.exit(1);
}

// User credentials
const testUser = {
  email: 'testing@idcashier.my.id',
  password: 'Tesajakalobisa',
  name: 'testing',
  role: 'owner'
};

async function createTestingUser() {
  try {
    console.log('Step 1: Creating user via auth-register edge function...');
    console.log(`Email: ${testUser.email}`);
    
    // Call auth-register edge function to create user
    const registerResponse = await fetch(`${supabaseUrl}/functions/v1/auth-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        name: testUser.name,
        email: testUser.email,
        password: testUser.password,
        role: testUser.role,
        paymentCompleted: false,
        trialDays: 7
      })
    });

    const registerData = await registerResponse.json();
    
    if (!registerResponse.ok) {
      if (registerData.error?.includes('already registered') || registerData.error?.includes('exists')) {
        console.log('User already exists, proceeding to update subscription...');
      } else {
        console.error('Error creating user:', registerData.error || registerData.message);
        process.exit(1);
      }
    } else {
      console.log('✅ User created successfully');
      console.log('User ID:', registerData.user?.id);
    }

    // Step 2: Get user ID by querying the database
    console.log('\nStep 2: Getting user ID from database...');
    const getUserResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(testUser.email)}&select=id`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    const users = await getUserResponse.json();
    if (!users || users.length === 0) {
      console.error('User not found in database after creation');
      process.exit(1);
    }

    const userId = users[0].id;
    console.log('✅ Found user ID:', userId);

    // Step 3: Create active subscription (for testing purposes)
    console.log('\nStep 3: Creating active subscription...');
    
    // Calculate dates (active for 6 months)
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 6); // 6 months from now
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 1); // Started 1 month ago

    // Check if subscription exists
    const checkSubResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=id`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      }
    );

    const existingSubs = await checkSubResponse.json();
    
    if (existingSubs && existingSubs.length > 0) {
      // Update existing subscription
      console.log('Updating existing subscription...');
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/subscriptions?id=eq.${existingSubs[0].id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error('Error updating subscription:', errorData);
        process.exit(1);
      }

      console.log('✅ Updated subscription');
    } else {
      // Create new subscription
      console.log('Creating new subscription...');
      const createSubResponse = await fetch(
        `${supabaseUrl}/rest/v1/subscriptions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            user_id: userId,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
          })
        }
      );

      if (!createSubResponse.ok) {
        const errorData = await createSubResponse.json();
        console.error('Error creating subscription:', errorData);
        process.exit(1);
      }

      console.log('✅ Created subscription');
    }

    console.log('\n✅ Successfully created testing user!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User Details:');
    console.log(`  Email: ${testUser.email}`);
    console.log(`  Password: ${testUser.password}`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Subscription Status: ACTIVE`);
    console.log(`  Subscription End Date: ${endDate.toISOString().split('T')[0]}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestingUser();

