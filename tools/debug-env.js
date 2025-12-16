import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

function decodeToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 'Invalid format';
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return 'Error decoding';
  }
}

console.log('Debug Env:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SERVICE_ROLE_KEY present:', !!process.env.SERVICE_ROLE_KEY);

if (serviceKey) {
  const decoded = decodeToken(serviceKey);
  console.log('Service Key Role:', decoded.role);
} else {
  console.log('Service Key NOT FOUND');
}

if (anonKey) {
  const decoded = decodeToken(anonKey);
  console.log('Anon Key Role:', decoded.role);
}
