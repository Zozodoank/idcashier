// Check environment variables
console.log('=== Environment Variables Check ===');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not set');
console.log('VITE_SITE_URL:', import.meta.env.VITE_SITE_URL ? '✅ Set' : '❌ Not set');

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL is not set!');
}

if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY is not set!');
}

console.log('=================================');
