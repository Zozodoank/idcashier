# Frontend Migration Guide: From Express.js to Supabase Edge Functions

This guide explains how to update the frontend services to call Supabase Edge Functions instead of Express endpoints.

## 1. Update Supabase Client Configuration

First, ensure your Supabase client is properly configured in `src/lib/supabaseClient.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

// These will be set in your .env file and processed by Vite
// Vite exposes env variables with VITE_ prefix to the client
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

console.log('Supabase config check:')
console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Not set')
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Not set')

// Create a single supabase client for the entire application
// Only create client if credentials are provided
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase client initialized successfully')
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message)
  }
} else {
  console.warn('Supabase credentials not found. Skipping Supabase client creation.')
}

export { supabase }
```

## 2. Update Service Files

### Auth Service (`src/services/authService.js`)

**Before (Express):**
```javascript
import api from './api';

const login = (email, password) => {
  return api.post('/auth/login', { email, password });
};

const getCurrentUser = (token) => {
  return api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
};
```

**After (Edge Functions):**
```javascript
import { supabase } from '../lib/supabaseClient';

const login = async (email, password) => {
  const { data, error } = await supabase.functions.invoke('auth-login', {
    body: { email, password }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};

const getCurrentUser = async (token) => {
  const { data, error } = await supabase.functions.invoke('auth-me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};
```

### Products Service (`src/services/productService.js`)

**Before (Express):**
```javascript
import api from './api';

const getAll = (token) => {
  return api.get('/products', {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const getById = (id, token) => {
  return api.get(`/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const create = (productData, token) => {
  return api.post('/products', productData, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const update = (id, productData, token) => {
  return api.put(`/products/${id}`, productData, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const remove = (id, token) => {
  return api.delete(`/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};
```

**After (Edge Functions):**
```javascript
import { supabase } from '../lib/supabaseClient';

const getAll = async (token) => {
  const { data, error } = await supabase.functions.invoke('products-get-all', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};

const getById = async (id, token) => {
  const { data, error } = await supabase.functions.invoke(`products-get-by-id/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};

const create = async (productData, token) => {
  const { data, error } = await supabase.functions.invoke('products-create', {
    body: productData,
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};

const update = async (id, productData, token) => {
  const { data, error } = await supabase.functions.invoke(`products-update/${id}`, {
    body: productData,
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};

const remove = async (id, token) => {
  const { data, error } = await supabase.functions.invoke(`products-delete/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (error) throw new Error(error.message);
  return { data: data };
};
```

## 3. Update All Service Files

Follow the same pattern for all service files:

1. Replace axios/api imports with supabase client imports
2. Replace api.get/post/put/delete calls with supabase.functions.invoke calls
3. Handle the response format (Edge Functions return `{ data, error }`)

## 4. Update Environment Variables

Update your `.env` file to use Supabase variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 5. Remove Unused Dependencies

After migrating all services, you can remove axios from your dependencies:

```bash
npm uninstall axios
```

## 6. Test the Migration

1. Run the development server: `npm run dev`
2. Test all functionality:
   - User authentication (login, registration, password reset)
   - Product management (create, read, update, delete)
   - Other CRUD operations for categories, customers, sales, etc.

## 7. Deploy to Production

1. Build the frontend: `npm run build`
2. Deploy the contents of the `dist/` directory to your static hosting provider
3. Ensure environment variables are set in your hosting provider
4. Test all functionality in production

## Benefits of the Migration

1. **No Backend Server Required:** The application can be deployed as a static site
2. **Reduced Hosting Costs:** Eliminate the need for backend server hosting
3. **Improved Performance:** Edge Functions are distributed globally
4. **Simplified Deployment:** Single deployment target (static files)
5. **Better Scalability:** Supabase automatically scales Edge Functions