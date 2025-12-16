// Script to create an expired trial user for testing
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('Creating expired trial user in Supabase...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key (admin access)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// User credentials
const testUser = {
  email: 'zozoproject@hotmail.com',
  password: '@Testing312',
  name: 'Zozo Project Test',
  role: 'owner'
};

async function createExpiredTrialUser() {
  try {
    console.log('Creating expired trial user...');
    console.log(`Email: ${testUser.email}`);
    
    // Check if user already exists in public.users
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', testUser.email)
      .maybeSingle();

    let userId;

    if (existingUser) {
      console.log('User already exists in public.users, using existing ID:', existingUser.id);
      userId = existingUser.id;
      
      // Update password in auth
      try {
        const { data: authData, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password: testUser.password,
          email_confirm: true,
          user_metadata: {
            name: testUser.name,
            role: testUser.role,
            is_trial_user: true
          }
        });
        
        if (updateError) {
          console.error('Error updating auth user:', updateError.message);
          // Continue anyway, might be auth user doesn't exist
        } else {
          console.log('✅ Updated auth user password and metadata');
        }
      } catch (authError) {
        console.warn('Warning: Could not update auth user:', authError.message);
        // Try to create auth user instead
        try {
          const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
            email: testUser.email,
            password: testUser.password,
            email_confirm: true,
            user_metadata: {
              name: testUser.name,
              role: testUser.role,
              is_trial_user: true
            }
          });
          
          if (createAuthError) {
            console.error('Error creating auth user:', createAuthError.message);
          } else {
            console.log('✅ Created auth user');
            userId = authData.user.id;
          }
        } catch (createError) {
          console.error('Error creating auth user:', createError.message);
        }
      }
    } else {
      // Create new user in auth first
      console.log('Creating new auth user...');
      const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: {
          name: testUser.name,
          role: testUser.role,
          is_trial_user: true
        }
      });

      if (createAuthError) {
        console.error('Error creating auth user:', createAuthError.message);
        process.exit(1);
      }

      userId = authData.user.id;
      console.log('✅ Created auth user with ID:', userId);

      // Create user in public.users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            name: testUser.name,
            email: testUser.email,
            role: testUser.role,
            tenant_id: userId // For owner, tenant_id should be the same as user id
          }
        ]);

      if (insertError) {
        console.error('Error inserting user into public.users:', insertError.message);
        process.exit(1);
      }

      console.log('✅ Created user in public.users table');
    }

    // Create expired subscription (7 days ago)
    const today = new Date();
    const expiredDate = new Date(today);
    expiredDate.setDate(expiredDate.getDate() - 7); // 7 days ago
    const startDate = new Date(expiredDate);
    startDate.setDate(startDate.getDate() - 30); // Trial was 30 days, started 37 days ago

    // Check if subscription already exists
    const { data: existingSub, error: subCheckError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingSub) {
      console.log('Subscription already exists, updating to expired...');
      const { error: updateSubError } = await supabase
        .from('subscriptions')
        .update({
          start_date: startDate.toISOString().split('T')[0],
          end_date: expiredDate.toISOString().split('T')[0],
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id);

      if (updateSubError) {
        console.error('Error updating subscription:', updateSubError.message);
        process.exit(1);
      }

      console.log('✅ Updated subscription to expired');
    } else {
      // Create new expired subscription
      const { error: insertSubError } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: userId,
            start_date: startDate.toISOString().split('T')[0],
            end_date: expiredDate.toISOString().split('T')[0],
            status: 'expired'
          }
        ]);

      if (insertSubError) {
        console.error('Error creating subscription:', insertSubError.message);
        process.exit(1);
      }

      console.log('✅ Created expired subscription');
    }

    console.log('\n✅ Successfully created expired trial user!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User Details:');
    console.log(`  Email: ${testUser.email}`);
    console.log(`  Password: ${testUser.password}`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Subscription Status: EXPIRED`);
    console.log(`  Subscription End Date: ${expiredDate.toISOString().split('T')[0]} (7 days ago)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now use these credentials to test the expired subscription flow.');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createExpiredTrialUser();

