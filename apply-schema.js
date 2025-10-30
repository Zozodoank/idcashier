// Script to apply database schema to Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('Applying schema to Supabase...');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials in environment variables.');
  console.error('Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Read the schema file
const schemaPath = join(__dirname, 'supabase-schema.sql');
try {
  const schemaSql = readFileSync(schemaPath, 'utf8');
  console.log('Schema file loaded successfully.');
  
  // Split the SQL into individual statements
  const statements = schemaSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('BEGIN') && !stmt.startsWith('COMMIT'));

  console.log(`Found ${statements.length} SQL statements to execute.`);
  
  // Execute each statement
  async function executeSchema() {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (statement.length === 0) {
        continue;
      }
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      console.log('Statement:', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      try {
        // Execute the statement using RPC
        const { data, error } = await supabase.rpc('execute_sql', { sql: statement });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error.message);
          // Don't stop on error, continue with other statements
        } else {
          console.log(`Statement ${i + 1} executed successfully.`);
        }
      } catch (error) {
        console.error(`Error executing statement ${i + 1}:`, error.message);
        // Don't stop on error, continue with other statements
      }
    }
    
    console.log('Schema application completed.');
  }
  
  // Run the schema execution
  executeSchema().catch(console.error);
  
} catch (error) {
  console.error('Error reading schema file:', error.message);
  process.exit(1);
}