// Script to help locate PostgreSQL tools on Windows systems
// This script provides guidance for finding pg_dump and psql executables

console.log('=== PostgreSQL Tools Locator ===\n');

console.log('This script helps you find PostgreSQL tools (pg_dump, psql) on your system.');
console.log('These tools are required for database backup and migration.\n');

console.log('Common PostgreSQL installation locations on Windows:\n');

const commonPaths = [
  'C:\\Program Files\\PostgreSQL\\',
  'C:\\Program Files (x86)\\PostgreSQL\\',
  'C:\\xampp\\pgsql\\bin\\',
  'C:\\ProgramData\\chocolatey\\lib\\postgresql\\tools\\postgresql\\bin\\'
];

console.log('1. Check these common locations for PostgreSQL binaries:');
commonPaths.forEach((path, index) => {
  console.log(`   ${index + 1}. ${path}`);
});

console.log('\n2. To find PostgreSQL tools on your system, try these commands in Command Prompt:');

console.log('\n   # Search for pg_dump in Program Files:');
console.log('   dir "C:\\Program Files" /s /b | findstr pg_dump.exe');

console.log('\n   # Search for psql in Program Files:');
console.log('   dir "C:\\Program Files" /s /b | findstr psql.exe');

console.log('\n   # List PostgreSQL directories:');
console.log('   dir "C:\\Program Files\\PostgreSQL" /ad');

console.log('\n3. Once you find the tools, use the full path, for example:');
console.log('   "C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe" -h localhost -p 5432 -U username database > backup.sql');
console.log('   "C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe" -h localhost -p 5432 -U username database < migration.sql');

console.log('\n4. Alternative approaches if tools are not available:');
console.log('   - Use pgAdmin: Right-click database > Backup/Restore');
console.log('   - Use database management tools like DBeaver, DataGrip');
console.log('   - Copy-paste SQL migration content directly to SQL editor');

console.log('\n5. If you are using Supabase:');
console.log('   - Use Supabase Dashboard SQL Editor');
console.log('   - Paste migration SQL content directly in the web interface');

console.log('\nFor more detailed instructions, check the MIGRATION_GUIDE.md file.');