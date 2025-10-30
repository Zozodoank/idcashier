// Script to generate bcrypt hash for password update
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

// Password provided by user
const plainPassword = '@Se06070786';
const saltRounds = 10;

console.log('Generating bcrypt hash for password update...');
console.log('Email: jho.j80@gmail.com');
console.log('Plain password:', plainPassword);
console.log('');

// Generate bcrypt hash
bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  
  console.log('Bcrypt hash for password:');
  console.log(hash);
  console.log('');
  
  console.log('SQL Update Statement:');
  console.log(`UPDATE users SET password = '${hash}' WHERE email = 'jho.j80@gmail.com';`);
  console.log('');
  
  console.log('Instructions:');
  console.log('1. Copy the bcrypt hash above');
  console.log('2. Run the SQL update statement in your Supabase SQL editor');
  console.log('3. The developer account password will be updated to: @Se06070786');
});