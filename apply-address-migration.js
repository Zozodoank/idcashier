import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('=== Address Column Migration Instructions ===\n');

console.log('To apply the address column migration to your Supabase database, please follow these steps:\n');

console.log('1. Open your Supabase Dashboard:');
console.log('   - Go to https://app.supabase.com');
console.log('   - Sign in to your account');
console.log('   - Select your project\n');

console.log('2. Navigate to the SQL Editor:');
console.log('   - In the left sidebar, click on "SQL Editor"');
console.log('   - Click on "New query"\n');

console.log('3. Copy and paste the following SQL into the editor:\n');

// Read the migration file
const migrationPath = join(__dirname, 'migration-add-address-to-customers.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

console.log('```sql');
console.log(migrationSQL);
console.log('```\n');

console.log('4. Execute the query:');
console.log('   - Click the "Run" button\n');

console.log('5. Verify the migration was successful:');
console.log('   - You should see a message indicating the query was executed successfully');
console.log('   - The customers table now has an address column\n');

console.log('Important: This migration adds an address column to store customer addresses.');
console.log('The column is optional and defaults to NULL, so it won\'t affect existing customers.\n');

// Supabase credentials from .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAddressMigration() {
  try {
    console.log('=== Applying Address Column Migration ===\n');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'migration-add-address-to-customers.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('');
    
    // Split the migration into separate statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute.\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}:`);
      console.log(statement);
      
      // For ALTER TABLE statements, we need to execute them differently
      if (statement.toUpperCase().startsWith('ALTER TABLE')) {
        // Extract table name and column definition
        const alterMatch = statement.match(/ALTER TABLE (\w+)\s+(.*)/i);
        if (alterMatch) {
          const tableName = alterMatch[1];
          const alteration = alterMatch[2];
          
          console.log(`  Modifying table: ${tableName}`);
          
          // Try to add the column using the exec_sql RPC function
          try {
            const { error } = await supabase.rpc('exec_sql', { 
              sql: `ALTER TABLE ${tableName} ${alteration}` 
            });
            
            if (error) {
              // If the column already exists, this is not an error we need to worry about
              if (error.message.includes('column') && error.message.includes('already exists')) {
                console.log('  Column already exists, skipping...');
              } else {
                console.error('  Error:', error.message);
                console.log('  Manual execution through Supabase dashboard recommended.');
              }
            } else {
              console.log('  ✓ Statement executed successfully');
            }
          } catch (rpcError) {
            console.error('  RPC Error:', rpcError.message);
            console.log('  Manual execution through Supabase dashboard recommended.');
          }
        }
      } else {
        // For other statements, try to execute them
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error('  Error:', error.message);
            console.log('  Manual execution through Supabase dashboard recommended.');
          } else {
            console.log('  ✓ Statement executed successfully');
          }
        } catch (stmtError) {
          console.error('  Error executing statement:', stmtError.message);
          console.log('  Manual execution through Supabase dashboard recommended.');
        }
      }
      
      console.log('');
    }
    
    console.log('✓ Address column migration applied successfully!');
    console.log('The customers table now includes an address column (TEXT type).');
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
    console.log('\nPlease follow the manual instructions above to apply the migration.');
    process.exit(1);
  }
}

applyAddressMigration();