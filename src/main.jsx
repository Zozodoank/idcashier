
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from '@/App';
import '@/index.css';
import { Toaster } from '@/components/ui/toaster';

// Import API monitor for debugging authentication issues
import '@/lib/api-monitor.js';

// Check environment variables
console.log('=== Environment Variables Check ===');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not set');
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set (length: ' + import.meta.env.VITE_SUPABASE_ANON_KEY?.length + ')' : '❌ Not set');
console.log('VITE_SITE_URL:', import.meta.env.VITE_SITE_URL ? '✅ Set' : '❌ Not set');
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ CRITICAL: Missing required environment variables!');
  console.error('Please check your .env file and restart the dev server.');
}
console.log('=================================');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
      <Toaster />
    </HelmetProvider>
  </React.StrictMode>
);
