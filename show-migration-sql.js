import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== Permissions Migration SQL ===\n');

// Read the migration file
const migrationPath = join(__dirname, 'migration-add-permissions.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

console.log('Please run the following SQL in your Supabase SQL Editor:\n');

console.log('```sql');
console.log(migrationSQL);
console.log('```\n');

console.log('This will add the permissions column to your users table.');