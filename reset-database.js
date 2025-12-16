// Script to reset the Supabase database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

console.log('Resetting Supabase database...');

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

// Read the reset database script
const resetScriptPath = join(__dirname, 'reset-database.sql');
try {
  const resetSql = readFileSync(resetScriptPath, 'utf8');
  console.log('Reset script loaded successfully.');
  
  // Split the SQL into individual statements
  const statements = resetSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'BEGIN' && stmt !== 'COMMIT');

  console.log(`Found ${statements.length} SQL statements to execute.`);
  
  // Execute each statement
  async function executeReset() {
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
    
    console.log('Database reset completed.');
    
    // Now insert the developer account
    console.log('Inserting developer account...');
    const insertDeveloperPath = join(__dirname, 'insert-developer.sql');
    try {
      const insertSql = readFileSync(insertDeveloperPath, 'utf8');
      const insertStatements = insertSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
      for (let i = 0; i < insertStatements.length; i++) {
        const statement = insertStatements[i];
        
        if (statement.length === 0) {
          continue;
        }
        
        console.log(`Executing insert statement ${i + 1}/${insertStatements.length}...`);
        const { data, error } = await supabase.rpc('execute_sql', { sql: statement });
        
        if (error) {
          console.error(`Error executing insert statement ${i + 1}:`, error.message);
        } else {
          console.log(`Insert statement ${i + 1} executed successfully.`);
        }
      }
      
      console.log('Developer account insertion completed.');
    } catch (error) {
      console.error('Error reading insert developer script:', error.message);
    }
  }
  
  // Run the reset execution
  executeReset().catch(console.error);
  
} catch (error) {
  console.error('Error reading reset script:', error.message);
  process.exit(1);
}