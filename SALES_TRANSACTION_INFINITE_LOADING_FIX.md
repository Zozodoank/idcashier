# Sales Transaction Infinite Loading - ROOT CAUSE FIX

## 🔴 ROOT CAUSE ANALYSIS

Setelah analisis mendalam terhadap kode, ditemukan beberapa root cause utama:

### 1. **API CONFLICT - Frontend vs Backend Mismatch**
- **Problem**: Frontend menggunakan `salesAPI.create()` yang call direct REST API
- **Backend**: Ada `sales-create` edge function yang lebih robust TIDAK DIGUNAKAN
- **Impact**: Inconsistent error handling dan timeout handling

### 2. **MISSING TIMEOUT HANDLING**
- **Problem**: Tidak ada timeout di fetch calls - jika server lambat, infinite loading
- **Location**: `src/lib/api.js` lines 1163-1325
- **Impact**: Request bisa hang forever tanpa response

### 3. **COMPLEX ASYNC TRANSACTION FLOW**
- **Problem**: `handlePayment` di SalesPage melakukan 6+ operasi async berurutan:
  1. `validateStockLevels()` 
  2. `salesAPI.create()`
  3. Deduct raw materials stock (loop async)
  4. Track profit shares (complex async)
  5. `fetchData()` (refresh products)
  6. `loadTransactionsData()` (if on history tab)
- **Impact**: Jika operasi #3-6 hang, transaksi never completes

### 4. **SILENT FAILURE POINTS**
- **Problem**: Error handling tidak robust di beberapa puntos
- **Location**: Profit share tracking, raw material deduction
- **Impact**: Silent failures menyebabkan UI hang

## 🛠️ IMMEDIATE FIXES REQUIRED

### Fix 1: Update Frontend to Use Edge Function
```javascript
// ANTES (di src/pages/SalesPage.jsx line 771)
const result = await salesAPI.create(saleData, token);

// DESPUES (use edge function directly)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const response = await fetch(`${supabaseUrl}/functions/v1/sales-create`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': supabaseAnonKey
  },
  body: JSON.stringify(saleData)
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Transaction failed');
}

const result = await response.json();
```

### Fix 2: Add Timeout to Sales API Create
```javascript
// TAMBAHKAN di src/lib/api.js salesAPI.create()
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  controller.abort();
}, 30000); // 30 seconds timeout

try {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/sales`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(saleWithUser),
      signal: controller.signal
    }
  );
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Sale creation failed:', response.status, errorText);
    
    if (response.status === 401) {
      throw new Error('Authentication expired. Please log in again.');
    } else if (response.status === 403) {
      throw new Error('Access denied. You may not have permission to create sales.');
    } else {
      throw new Error(`Failed to create sale: ${response.statusText}`);
    }
  }
  
  const saleResult = await response.json();
  console.log('Sale created:', saleResult);
  
  // Create sale items
  console.log('Creating sale items:', saleItems.length);
  
  const itemsResponse = await fetch(
    `${supabaseUrl}/rest/v1/sale_items`,
    {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(saleItems)
    }
  );
  
  if (!itemsResponse.ok) {
    const errorText = await itemsResponse.text();
    console.error('Sale items creation failed:', itemsResponse.status, errorText);
    throw new Error(`Failed to create sale items: ${itemsResponse.statusText}`);
  }
  
  const itemsResult = await itemsResponse.json();
  console.log('Sale items created:', itemsResult);
  
  // Create custom costs if any
  if (customCosts.length > 0) {
    console.log('Creating custom costs:', customCosts.length);
    
    const customCostRecords = customCosts.map(cost => ({
      id: crypto.randomUUID(),
      sale_id: saleId,
      label: cost.label,
      amount: cost.amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const costsResponse = await fetch(
      `${supabaseUrl}/rest/v1/sale_custom_costs`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(customCostRecords)
      }
    );

    if (!costsResponse.ok) {
      const errorText = await costsResponse.text();
      console.error('Custom costs creation failed:', costsResponse.status, errorText);
    } else {
      console.log('Custom costs created successfully');
    }
  }
  
  // Return the complete sale with items
  const completeSale = {
    ...saleResult,
    sale_items: itemsResult
  };
  
  console.log('Sale creation completed successfully');
  return Array.isArray(completeSale) ? completeSale[0] : completeSale;
  
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Transaction timeout. Please try again.');
  }
  throw error;
}
```

### Fix 3: Add Loading States for Each Step
```javascript
// TAMBAHKAN di handlePayment function
const [paymentStep, setPaymentStep] = useState('validating');

// Update steps
setPaymentStep('creating');
const result = await salesAPI.create(saleData, token);

setPaymentStep('updating-stock');
try {
  // Deduct raw materials stock for each product in cart
  for (const cartItem of cart) {
    // Get recipe for this product
    const recipes = await productRecipesAPI.getByProduct(cartItem.id, token);
    
    // Deduct each raw material in the recipe
    if (recipes && recipes.length > 0) {
      for (const recipe of recipes) {
        // Calculate total quantity needed: recipe quantity × cart quantity
        const totalQuantityNeeded = parseFloat(recipe.quantity) * cartItem.quantity;
        
        // Deduct stock
        await rawMaterialsAPI.deductStock(
          recipe.raw_material_id, 
          totalQuantityNeeded, 
          token
        );
      }
    }
  }
} catch (stockError) {
  console.warn('Warning: Could not deduct raw material stock:', stockError);
}

setPaymentStep('tracking-profits');
// Track profit shares if HPP enabled and sale was successful
if (hppEnabled && result?.id) {
  try {
    // 1. Resolve Employee ID
    const { data: employeeRecord } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (employeeRecord) {
      const currentEmployeeId = employeeRecord.id;
      
      // 2. Check Attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('employee_attendance')
        .select('status')
        .eq('employee_id', currentEmployeeId)
        .eq('attendance_date', today)
        .maybeSingle();
      
      // Only apply profit share if present (or late/half_day)
      // If no attendance record, assume absent
      const isPresent = attendance && ['present', 'late', 'half_day'].includes(attendance.status);

      if (isPresent) {
        // 3. Fetch all shares for this employee (optimization)
        const { data: employeeShares } = await supabase
          .from('employee_product_shares')
          .select('product_id, share_type, share_value')
          .eq('employee_id', currentEmployeeId);

        for (const item of cart) {
          // Check for employee-specific profit share
          // Priority: Specific Product > All Products (product_id is null) > Product Default
          
          const specificShare = employeeShares?.find(s => s.product_id === item.id);
          const globalShare = employeeShares?.find(s => s.product_id === null);
          const employeeShare = specificShare || globalShare;

          let shareConfig = null;

          if (employeeShare) {
            // Use employee-specific share (prioritized)
            shareConfig = {
              enabled: true,
              type: employeeShare.share_type,
              value: employeeShare.share_value
            };
          } else if (item.profit_share_enabled) {
            // Fallback to product default share
            shareConfig = {
              enabled: true,
              type: item.profit_share_type,
              value: item.profit_share_value
            };
          }

          // Calculate and save profit share if configured
          if (shareConfig && shareConfig.enabled) {
            let shareAmount = 0;
            
            if (shareConfig.type === 'percentage') {
              // Percentage: calculate from selling price
              shareAmount = (item.price * item.quantity * shareConfig.value) / 100;
            } else if (shareConfig.type === 'fixed') {
              // Fixed amount: multiply by quantity
              shareAmount = shareConfig.value * item.quantity;
            }
            
            // Save profit share to database
            if (shareAmount > 0) {
              const { error: profitShareError } = await supabase
                .from('profit_shares')
                .insert({
                  sale_id: result.id,
                  employee_id: currentEmployeeId,
                  product_id: item.id,
                  quantity: item.quantity,
                  share_amount: shareAmount
                });
              
              if (profitShareError) {
                console.error('Error saving profit share:', profitShareError);
              }
            }
          }
        }
      }
    }
  } catch (profitShareError) {
    console.error('Error tracking profit shares:', profitShareError);
  }
}

setPaymentStep('refreshing');
// Refresh products to show updated stock
fetchData();

// Refresh transactions data if on history tab
if (activeTab === 'history') {
  loadTransactionsData();
}

// UI enhancement
{isProcessingPayment && (
  <div className="loading-indicator">
    <span>{t('processing')}: {t(paymentStep)}</span>
  </div>
)}
```

### Fix 4: Simplify Transaction Flow
```javascript
// Buat function terpisah untuk non-critical operations
const handlePostSaleOperations = async (result, cart) => {
  // Run in background, don't block UI
  setTimeout(async () => {
    try {
      await Promise.allSettled([
        deductRawMaterials(cart),
        trackProfitShares(result, cart),
        refreshData()
      ]);
    } catch (error) {
      console.warn('Background operations failed:', error);
    }
  }, 0);
};

// Di handlePayment, panggil setelah sale created
const result = await salesAPI.create(saleData, token);

// Store completed sale data for print receipt
setCompletedSaleData({
  cart,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paymentAmount,
  change,
  customer: customerForReceipt
});

// Open receipt dialog
setIsReceiptDialogOpen(true);

// Show success confirmation
toast({ 
  title: t('success'), 
  description: t('transactionSaved'), 
  variant: "success" 
});

// Run background operations (non-blocking)
handlePostSaleOperations(result, cart);
```

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (15 menit)
1. ✅ Update frontend to use sales-create edge function
2. ✅ Add timeout handling di API calls
3. ✅ Add loading states untuk transparency

### Phase 2: Performance Optimizations (30 menit)
1. ✅ Simplify transaction flow
2. ✅ Move non-critical operations to background
3. ✅ Add proper error boundaries

### Phase 3: UX Improvements (15 menit)
1. ✅ Add progress indicator
2. ✅ Better error messages
3. ✅ Retry mechanism

## 🧪 TESTING CHECKLIST

### Test Scenarios:
- [ ] Normal transaction (1-3 items)
- [ ] Large transaction (10+ items)
- [ ] Transaction dengan raw materials
- [ ] Transaction dengan HPP enabled
- [ ] Network slow simulation
- [ ] Edge function timeout
- [ ] Database timeout

### Success Criteria:
- [ ] Transaction completes dalam < 30 detik
- [ ] Error messages jelas dan actionable
- [ ] Loading state informative
- [ ] No infinite loading scenarios

## 🔧 DEBUGGING STEPS

Jika masih ada issues:

1. **Open Browser Console**
   ```
   F12 → Console tab
   ```

2. **Check Network Tab**
   ```
   F12 → Network tab → Filter: "sales-create"
   ```

3. **Look for Errors**
   ```
   - "Creating sale with data:" (should appear)
   - "Sale created successfully" (should appear)
   - "Failed" or timeout errors
   ```

4. **Check Edge Function Logs**
   ```bash
   supabase functions logs sales-create
   ```

## ⚠️ IMMEDIATE ACTION REQUIRED

**Priority 1 (Urgente):**
1. Update frontend untuk use edge function
2. Add timeout handling

**Priority 2 (Soon):**
1. Simplify transaction flow
2. Add better loading states

**Priority 3 (Later):**
1. Performance optimizations
2. UX improvements

---

**Status**: Ready for implementation
**Estimated Fix Time**: 60 minutes
**Risk Level**: Low (isolated changes)
**Impact**: High (fixes infinite loading)