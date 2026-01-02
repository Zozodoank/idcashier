# Panduan Backend Testing dengan TestSprite untuk Supabase

## 📋 Overview

Aplikasi idCashier memiliki **60+ Supabase Edge Functions** yang berfungsi sebagai backend API. Untuk melakukan backend testing dengan TestSprite, kita perlu menggunakan pendekatan yang berbeda dari REST API tradisional.

---

## 🏗️ Arsitektur Backend

### Edge Functions yang Ada (60+ functions)

#### **Authentication (8 functions)**
- `auth-login` - User login
- `auth-register` - User registration
- `auth-me` - Get current user
- `auth-request-password-reset` - Request password reset
- `auth-reset-password` - Reset password
- `register-with-payment` - Register with subscription payment
- `renew-subscription-payment` - Renew subscription

#### **Products (5 functions)**
- `products-create` - Create product
- `products-get-all` - Get all products
- `products-get-by-id` - Get product by ID
- `products-update` - Update product
- `products-delete` - Delete product

#### **Sales (4 functions)**
- `sales-create` - Create sale
- `sales-get-all` - Get all sales
- `sales-get-by-id` - Get sale by ID
- `sales-delete` - Delete sale

#### **Customers (5 functions)**
- `customers-create`
- `customers-get-all`
- `customers-get-by-id`
- `customers-update`
- `customers-delete`

#### **Categories (5 functions)**
- `categories-create`
- `categories-get-all`
- `categories-get-by-id`
- `categories-update`
- `categories-delete`

#### **Suppliers (5 functions)**
- `suppliers-create`
- `suppliers-get-all`
- `suppliers-get-by-id`
- `suppliers-update`
- `suppliers-delete`

#### **Users (5 functions)**
- `users-create`
- `users-get-all`
- `users-get-by-id`
- `users-update`
- `users-delete`

#### **Subscriptions (5 functions)**
- `subscriptions-create-update`
- `subscriptions-get-all-users`
- `subscriptions-get-current`
- `subscriptions-get-current-user`
- `subscriptions-update-user`

#### **Dashboard (3 functions)**
- `dashboard-stats` - Get dashboard statistics
- `dashboard-recent-transactions` - Get recent transactions
- `dashboard-top-products` - Get top selling products

#### **Payment (3 functions)**
- `duitku-payment-request` - Create payment request
- `duitku-callback` - Handle payment callback
- `create-renewal-payment` - Create renewal payment

#### **Other (12 functions)**
- `attendance-ingest` - Attendance tracking
- `demo-reset` - Reset demo data
- `developer-operations` - Developer utilities
- Various test functions

---

## 🎯 Cara Melakukan Backend Testing

### **Metode 1: Test Edge Functions Langsung (RECOMMENDED)**

#### Step 1: Dapatkan Supabase URL dan Keys

```bash
# Dari .env file
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Step 2: Test dengan cURL

```bash
# Test auth-login function
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/auth-login \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Test products-get-all function
curl -X GET \
  https://your-project-ref.supabase.co/functions/v1/products-get-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test products-create function
curl -X POST \
  https://your-project-ref.supabase.co/functions/v1/products-create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "price": 10000,
    "stock": 100
  }'
```

#### Step 3: Buat Test Script dengan Node.js

```javascript
// test-edge-functions.js
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const ANON_KEY = 'your-anon-key';

async function testAuthLogin() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })
  });
  
  const data = await response.json();
  console.log('Login test:', response.status === 200 ? 'PASS' : 'FAIL');
  return data.token;
}

async function testProductsGetAll(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-get-all`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('Get products test:', response.status === 200 ? 'PASS' : 'FAIL');
  return data;
}

async function testProductCreate(token) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Product',
      price: 10000,
      stock: 100,
      category_id: 1
    })
  });
  
  const data = await response.json();
  console.log('Create product test:', response.status === 200 ? 'PASS' : 'FAIL');
  return data;
}

// Run all tests
async function runTests() {
  console.log('Starting backend tests...\n');
  
  const token = await testAuthLogin();
  await testProductsGetAll(token);
  await testProductCreate(token);
  
  console.log('\nAll tests completed!');
}

runTests();
```

---

### **Metode 2: Buat REST API Wrapper (Untuk TestSprite)**

Jika Anda ingin menggunakan TestSprite backend tests, buat simple Express server yang meneruskan request ke Edge Functions:

#### Step 1: Install Dependencies

```bash
npm install express cors node-fetch
```

#### Step 2: Buat API Wrapper

```javascript
// api-wrapper.js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});

app.post('/api/auth/register', async (req, res) => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-register`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-get-all`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  res.json(data);
});

app.post('/api/products', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  const data = await response.json();
  res.json(data);
});

app.get('/api/products/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-get-by-id`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: req.params.id })
  });
  const data = await response.json();
  res.json(data);
});

app.put('/api/products/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: req.params.id, ...req.body })
  });
  const data = await response.json();
  res.json(data);
});

app.delete('/api/products/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: req.params.id })
  });
  const data = await response.json();
  res.json(data);
});

// Add more endpoints as needed...

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API Wrapper running on http://localhost:${PORT}`);
});
```

#### Step 3: Jalankan API Wrapper

```bash
node api-wrapper.js
```

#### Step 4: Update TestSprite Config

```json
{
  "type": "backend",
  "localEndpoint": "http://localhost:3001"
}
```

#### Step 5: Run TestSprite Backend Tests

Sekarang TestSprite bisa test endpoints seperti:
- `POST /api/auth/login`
- `GET /api/products`
- `POST /api/products`
- dll.

---

### **Metode 3: Test Langsung dengan Supabase CLI**

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Test function locally
supabase functions serve auth-login

# Test with curl
curl -X POST http://localhost:54321/functions/v1/auth-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

## 📊 Test Plan untuk Edge Functions

### Priority 1: Authentication Functions
- ✅ `auth-login` - Test login with valid/invalid credentials
- ✅ `auth-register` - Test registration flow
- ✅ `auth-me` - Test get current user
- ✅ `auth-reset-password` - Test password reset

### Priority 2: CRUD Functions
- ✅ `products-*` - Test product CRUD operations
- ✅ `sales-*` - Test sales CRUD operations
- ✅ `customers-*` - Test customer CRUD operations

### Priority 3: Business Logic
- ✅ `dashboard-stats` - Test dashboard data
- ✅ `duitku-payment-request` - Test payment integration
- ✅ `register-with-payment` - Test registration with payment

---

## 🎯 Recommended Approach

**Untuk aplikasi Supabase seperti ini, saya rekomendasikan:**

### **Opsi A: Test Edge Functions Langsung (BEST)**
- Paling akurat
- Test real backend
- Tidak perlu wrapper
- Gunakan script Node.js atau Postman

### **Opsi B: Buat API Wrapper (Untuk TestSprite)**
- Kompatibel dengan TestSprite backend tests
- Butuh maintenance
- Adds complexity

### **Opsi C: Fokus pada Frontend Tests (CURRENT)**
- Sudah implemented
- 80% coverage
- Test end-to-end user experience
- Paling praktis

---

## 💡 Kesimpulan

**Backend testing untuk Supabase Edge Functions:**

1. **Tidak perlu TestSprite backend tests** - Karena designed untuk REST API tradisional
2. **Gunakan direct testing** - Test Edge Functions langsung dengan cURL atau Node.js
3. **Frontend tests sudah cukup** - Karena test end-to-end flow termasuk Edge Functions
4. **Jika perlu backend tests** - Buat simple API wrapper

**Rekomendasi:** Tetap gunakan frontend tests (sudah 80% coverage) dan tambahkan manual testing untuk Edge Functions kritis jika diperlukan.

---

## 📝 Next Steps

Jika Anda ingin melanjutkan backend testing:

1. **Pilih metode** (Direct testing atau API wrapper)
2. **Buat test scripts** untuk Edge Functions kritis
3. **Setup CI/CD** untuk automated testing
4. **Monitor production** Edge Functions

Atau, **tetap dengan frontend tests** yang sudah working well (80% coverage).

---

*Panduan ini dibuat berdasarkan arsitektur Supabase Edge Functions yang ada di project idCashier.*
