# Frontend-Backend Connection Analysis

## 🔍 Current Architecture

### **Data Flow:**
```
Frontend (React)
    ↓
API Layer (src/lib/api.js)
    ↓
Supabase REST API
    ↓
PostgreSQL Database (with RLS)
```

---

## ✅ What's Working

### 1. **API Implementation**
- ✅ Using direct REST API calls (good for stability)
- ✅ Proper authentication headers
- ✅ Error handling in place
- ✅ Logging for debugging

### 2. **Authentication Flow**
```javascript
// Login successful
🔐 Attempting login for: jho.j80@gmail.com
📡 Calling edge function: https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-login-final
📥 Response received: 200
✅ Login successful, setting user and token
```

### 3. **Data Fetching**
```javascript
// Products fetched successfully
Fetching products with direct fetch...
Products fetched: 1 items
```

---

## ⚠️ Potential Issues

### **Issue 1: Limited Data Returned**

**Symptom:**
```
Products fetched: 1 items  ← Too few!
Company settings: null
```

**Possible Causes:**

#### A. **RLS Policies Too Restrictive**
```sql
-- Check current RLS policy
SELECT * FROM products WHERE tenant_id = 'user-tenant-id';
-- Might be filtering too aggressively
```

**Solution:**
```sql
-- Verify RLS policy allows SELECT
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'products';
```

#### B. **Data Actually Missing**
```sql
-- Check total products in database
SELECT COUNT(*) FROM products;

-- Check products by tenant
SELECT tenant_id, COUNT(*) 
FROM products 
GROUP BY tenant_id;
```

#### C. **Tenant ID Mismatch**
```javascript
// User's tenant_id might not match products' tenant_id
console.log('User tenant:', user.tenant_id);
console.log('Products tenant:', products[0]?.tenant_id);
```

---

### **Issue 2: Session Timeout Warning**

**Current:**
```
⚠️ setSession timed out (10s), proceeding anyway
```

**Impact:**
- Session might not be properly set
- Subsequent API calls might fail
- User might need to re-login

**Fix:** Already applied, needs deployment

---

### **Issue 3: Company Settings Null**

**Symptom:**
```
Found user-specific store settings: null
Found user-specific receipt settings: null
```

**Cause:**
- `store_settings` table empty for this user
- `receipt_settings` table empty for this user

**Solution:**
```sql
-- Insert default settings
INSERT INTO store_settings (owner_id, name, address, phone)
VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Toko Saya', 'Alamat Toko', '08123456789')
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO receipt_settings (owner_id, header_text, footer_text)
VALUES ('21da4acf-6008-4b4c-9bde-4dc2efaef287', 'Terima Kasih', 'Barang yang sudah dibeli tidak dapat dikembalikan')
ON CONFLICT (owner_id) DO NOTHING;
```

---

## 🔧 Diagnostic Steps

### **Step 1: Check Database Connection**

Run this in browser console on `idcashier.my.id`:

```javascript
// Test Supabase connection
const testConnection = async () => {
  const url = 'https://eypfeiqtvfxxiimhtycc.supabase.co/rest/v1/products?select=count';
  const token = localStorage.getItem('idcashier_token');
  const anonKey = 'YOUR_ANON_KEY';
  
  const response = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Connection test:', response.status);
  console.log('Data:', await response.json());
};

testConnection();
```

---

### **Step 2: Check RLS Policies**

```sql
-- Login to Supabase SQL Editor
-- https://supabase.com/dashboard/project/eypfeiqtvfxxiimhtycc

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'sales', 'customers', 'categories', 'suppliers');

-- 2. Check RLS policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Test as authenticated user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"21da4acf-6008-4b4c-9bde-4dc2efaef287","tenant_id":"YOUR_TENANT_ID"}';

SELECT * FROM products;
-- Should return products for this tenant
```

---

### **Step 3: Check Data Exists**

```sql
-- Count records
SELECT 
  'products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'users', COUNT(*) FROM users;

-- Check user's tenant
SELECT id, email, tenant_id, role 
FROM users 
WHERE email = 'jho.j80@gmail.com';

-- Check products for user's tenant
SELECT p.*, u.email, u.tenant_id
FROM products p
JOIN users u ON p.tenant_id = u.tenant_id
WHERE u.email = 'jho.j80@gmail.com';
```

---

### **Step 4: Check CORS Configuration**

Supabase Dashboard > Settings > API:

**Allowed Origins should include:**
- `https://idcashier.my.id`
- `http://localhost:3000` (for development)
- `*` (for testing, not recommended for production)

---

## 🛠️ Fixes to Apply

### **Fix 1: Add Better Error Logging**

Update `src/lib/api.js`:

```javascript
export const productsAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching products with direct fetch...');
      console.log('Token:', token ? 'Present' : 'Missing');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('Supabase URL:', supabaseUrl);
      console.log('Anon Key:', supabaseAnonKey ? 'Present' : 'Missing');

      const response = await fetch(
        `${supabaseUrl}/rest/v1/products?select=*,category:categories!products_category_id_fkey(name),supplier:suppliers!products_supplier_id_fkey(name,phone,address)`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Products fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`Products fetched: ${rawData.length} items`);
      console.log('First product:', rawData[0]);

      // ... rest of code
    } catch (error) {
      console.error('Products API Error:', error);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }
};
```

---

### **Fix 2: Add Retry Logic**

```javascript
// Add retry helper
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (i < retries - 1) {
        console.log(`Retry ${i + 1}/${retries - 1}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries - 1} after error...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
};

// Use in productsAPI
const response = await fetchWithRetry(
  `${supabaseUrl}/rest/v1/products?select=*`,
  { headers: {...} }
);
```

---

### **Fix 3: Add Fallback for Empty Data**

```javascript
// In DashboardPage.jsx
useEffect(() => {
  const fetchData = async () => {
    if (!user || !token) {
      console.warn('No user or token, skipping data fetch');
      return;
    }
    
    try {
      setLoading(true);
      
      const [products, sales, customers, categories, suppliers] = await Promise.all([
        productsAPI.getAll(token).catch(err => {
          console.error('Products fetch error:', err);
          toast.error('Gagal memuat produk');
          return [];
        }),
        salesAPI.getAll(token).catch(err => {
          console.error('Sales fetch error:', err);
          toast.error('Gagal memuat penjualan');
          return [];
        }),
        // ... other API calls
      ]);
      
      // Log results
      console.log('Data fetched:', {
        products: products.length,
        sales: sales.length,
        customers: customers.length,
        categories: categories.length,
        suppliers: suppliers.length
      });
      
      // If all empty, show warning
      if (products.length === 0 && sales.length === 0 && customers.length === 0) {
        toast.info('Belum ada data. Silakan tambahkan produk dan transaksi.');
      }
      
      // ... update stats
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, [user, token]);
```

---

## 📊 Expected vs Actual

### **Expected Behavior:**
```
Products fetched: 50+ items
Sales fetched: 100+ items
Customers fetched: 20+ items
Company settings: {name: "Toko Saya", ...}
```

### **Actual Behavior (Production):**
```
Products fetched: 1 items  ← Issue!
Sales fetched: 0 items     ← Issue!
Company settings: null     ← Issue!
```

---

## 🎯 Action Plan

### **Immediate (Do Now):**

1. **Check Database Data**
   ```sql
   SELECT COUNT(*) FROM products;
   SELECT COUNT(*) FROM sales;
   ```

2. **Verify RLS Policies**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'products';
   ```

3. **Test API Directly**
   ```bash
   curl -X GET \
     'https://eypfeiqtvfxxiimhtycc.supabase.co/rest/v1/products?select=*' \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### **Short Term (After Diagnosis):**

1. **Add Missing Data** (if database is empty)
2. **Fix RLS Policies** (if too restrictive)
3. **Add Default Settings** (for company info)

### **Long Term:**

1. **Add Data Seeding** (for new users)
2. **Improve Error Messages** (user-friendly)
3. **Add Loading States** (better UX)

---

## 🔍 Debugging Checklist

- [ ] Check browser console for errors
- [ ] Verify token is present in localStorage
- [ ] Test API calls in Network tab
- [ ] Check Supabase dashboard for data
- [ ] Verify RLS policies
- [ ] Test with different users
- [ ] Check CORS configuration
- [ ] Verify environment variables

---

*Run diagnostics and report findings to determine next steps.*
