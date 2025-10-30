const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Supabase credentials from .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Supabase Schema Push Instructions ===');
console.log('Supabase URL:', supabaseUrl);
console.log('');

console.log('Due to security restrictions, schema changes cannot be pushed directly using the anon key.');
console.log('Please follow these steps to push your schema to Supabase:');
console.log('');

console.log('1. Open your Supabase Dashboard:');
console.log('   - Go to https://app.supabase.com');
console.log('   - Sign in to your account');
console.log('   - Select your project');
console.log('');

console.log('2. Navigate to the SQL Editor:');
console.log('   - In the left sidebar, click on "SQL Editor"');
console.log('   - Click on "New query"');
console.log('');

console.log('3. Copy and paste the schema:');
console.log('   - Open the file: supabase-schema.sql');
console.log('   - Copy its entire contents');
console.log('   - Paste it into the SQL editor');
console.log('');

console.log('4. Execute the schema:');
console.log('   - Click the "Run" button');
console.log('   - Wait for the execution to complete');
console.log('');

console.log('Important: The schema has been updated to use UUID type for user IDs to match Supabase Auth.');
console.log('If you already have data in your database, you may need to reset it first using reset-database.sql');
console.log('');

console.log('Alternatively, you can use the Supabase CLI:');
console.log('');
console.log('1. Install the Supabase CLI if you haven\'t already:');
console.log('   - Visit: https://supabase.com/docs/guides/cli');
console.log('');
console.log('2. Link your project:');
console.log('   supabase link --project-ref YOUR_PROJECT_ID');
console.log('');
console.log('3. Push the schema:');
console.log('   supabase db push');
console.log('');

console.log('For Windows users, you can also use a PostgreSQL client like pgAdmin:');
console.log('1. Install pgAdmin: https://www.pgadmin.org/');
console.log('2. Connect to your Supabase database using the connection details from your Supabase dashboard');
console.log('3. Open and execute the supabase-schema.sql file');
console.log('');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function pushSchema() {
  try {
    // Read the schema file
    const schemaPath = path.resolve(__dirname, 'supabase-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Schema file loaded successfully');
    console.log('Please follow the instructions above to manually push the schema to Supabase.');
    console.log('The schema has been updated to use proper PostgreSQL syntax and UUID user IDs.');
    
  } catch (error) {
    console.error('Error reading schema:', error.message);
    process.exit(1);
  }
}

// Run the schema push
console.log('Starting Supabase schema push...');
pushSchema().then(() => {
  console.log('Schema push process completed');
}).catch(error => {
  console.error('Schema push failed:', error.message);
  process.exit(1);
});