// Test environment variables
console.log('🔍 ENVIRONMENT VARIABLES CHECK');
console.log('================================');

const vars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SITE_URL'
];

vars.forEach(varName => {
  const value = import.meta.env[varName];
  console.log(`${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
  if (value && varName.includes('KEY')) {
    console.log(`  → ${value.substring(0, 20)}...`);
  } else if (value) {
    console.log(`  → ${value}`);
  }
});

export default vars;