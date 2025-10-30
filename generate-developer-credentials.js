// Script to generate developer credentials
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

console.log('Generating developer credentials...');
console.log('');

// Generate a UUID
const userId = randomUUID();
console.log('Generated UUID for developer user:');
console.log(userId);
console.log('');

// Generate a simple password hash (in a real application, use bcrypt)
const password = 'Developer123!'; // Default password - change this in production
const hashedPassword = createHash('sha256').update(password).digest('hex');

console.log('Generated password hash (SHA256 - for demonstration only):');
console.log(hashedPassword);
console.log('');

console.log('Instructions:');
console.log('1. Update the insert-developer.sql file with these credentials');
console.log('2. Replace the UUID and password hash in the SQL statement');
console.log('3. Run the SQL statement in your Supabase SQL editor');
console.log('');
console.log('For production use, you should:');
console.log('- Use a stronger password');
console.log('- Use bcrypt for password hashing');
console.log('- Store credentials securely');