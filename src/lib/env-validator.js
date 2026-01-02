const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SITE_URL'
];

export const validateEnv = () => {
  const missingVars = [];

  requiredEnvVars.forEach((key) => {
    if (!import.meta.env[key]) {
      missingVars.push(key);
    }
  });

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables:\n${missingVars.join('\n')}\n\nPlease check your .env file.`;
    console.error(errorMessage);
    
    // In development, alert the developer
    if (import.meta.env.DEV) {
      alert(errorMessage);
    }
  }
};
