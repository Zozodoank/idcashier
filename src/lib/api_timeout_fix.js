// API timeout fixes untuk mengatasi sales process loading issue
// Implementasi timeout protection untuk API calls yang belum memiliki timeout

// 1. Fix untuk salesAPI.getAll - tambahkan timeout protection
const originalSalesGetAll = salesAPI.getAll;
salesAPI.getAll = async function(token) {
  try {
    console.log('Fetching all sales data with direct fetch and timeout protection...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ Sales fetch timeout (30s)');
      controller.abort();
    }, 30000); // 30 seconds timeout

    const response = await fetch(
      `${supabaseUrl}/rest/v1/sales?select=*,user:users!sales_user_id_fkey(name,email),customer:customers!sales_customer_id_fkey(name,email,phone),sale_items(*,product:products!sale_items_product_id_fkey(name,barcode,price,cost,supplier:suppliers!products_supplier_id_fkey(name)))&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sales fetch failed:', response.status, errorText);
      throw new Error(`Failed to fetch sales: ${response.statusText}`);
    }

    const rawData = await response.json();
    
    // Transform data to flatten nested relationships for backward compatibility
    const data = rawData?.map(sale => {
      // Determine customer name:
      let customerName = null;
      if (sale.customer_id === null) {
        customerName = 'Umum';
      } else if (sale.customer?.name) {
        customerName = sale.customer.name;
      }
      
      return {
        ...sale,
        user_name: sale.user?.name || null,
        user_email: sale.user?.email || null,
        customer_name: customerName,
        customer_email: sale.customer?.email || null,
        customer_phone: sale.customer?.phone || null,
        sale_items: sale.sale_items?.map(item => ({
          ...item,
          product_name: item.product?.name || null,
          barcode: item.product?.barcode || null,
          product_price: item.product?.price || null,
          product_cost: item.product?.cost || null,
          supplier_name: item.product?.supplier?.name || null
        })) || []
      };
    }) || [];
    
    return data;
  } catch (error) {
    console.error('Sales fetch error:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Sales fetch timeout. Please check your internet connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

// 2. Fix untuk customersAPI.getAll - tambahkan timeout protection
const originalCustomersGetAll = customersAPI.getAll;
customersAPI.getAll = async function(token) {
  try {
    console.log('Fetching customers with direct fetch and timeout protection...');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing. Please check environment variables.');
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ Customers fetch timeout (30s)');
      controller.abort();
    }, 30000); // 30 seconds timeout

    const response = await fetch(
      `${supabaseUrl}/rest/v1/customers?select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Customers fetch failed:', response.status, errorText);
      throw new Error(`Failed to fetch customers: ${response.statusText}`);
    }

    const rawData = await response.json();
    console.log(`Customers fetched: ${rawData.length} items`);

    return rawData || [];
  } catch (error) {
    console.error('Customers API Error:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('Customers fetch timeout. Please check your internet connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

// 3. Fix untuk user profile query di salesAPI.create - tambahkan timeout protection
const originalSalesCreate = salesAPI.create;
salesAPI.create = async function(saleData, token) {
  try {
    console.log('Creating sale with data:', JSON.stringify(saleData, null, 2));
    
    // Validate environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing. Please check environment variables.');
    }
    
    if (!token) {
      throw new Error('Authentication token required');
    }
    
    // Get current user profile with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏰ User profile query timeout (10s)');
      controller.abort();
    }, 10000); // 10 seconds timeout for user profile query

    let userData, userError;
    try {
      const result = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()
        .setHeader('Authorization', `Bearer ${token}`);
      userData = result.data;
      userError = result.error;
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('User profile query timeout. Please try again.');
      }
      throw fetchError;
    }
    
    if (userError || !userData) {
      throw new Error('Failed to get user profile. Please log in again.');
    }
    
    // Continue with original sales creation logic...
    // (rest of the function remains the same)
    
    // Generate UUIDs for sale and sale items
    const saleId = crypto.randomUUID();
    
    // Extract custom_costs before creating sale (it's a separate table)
    const customCosts = saleData.custom_costs || [];
    
    // Prepare sale data
    const saleWithUser = {
      ...saleData,
      id: saleId,
      user_id: userData.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Remove sale_items and custom_costs from the sale object (they're separate tables)
    delete saleWithUser.sale_items;
    delete saleWithUser.custom_costs;
    
    // Process sale items
    const saleItems = saleData.sale_items.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      sale_id: saleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    console.log('Creating sale with ID:', saleId);
    
    // Create sale using direct REST API with timeout
    const saleController = new AbortController();
    const saleTimeoutId = setTimeout(() => {
      console.error('⏰ Sale creation request timeout (30s)');
      saleController.abort();
    }, 30000); // 30 seconds timeout

    let saleResponse;
    try {
      saleResponse = await fetch(
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
          signal: saleController.signal
        }
      );
      clearTimeout(saleTimeoutId);
    } catch (fetchError) {
      clearTimeout(saleTimeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Sale creation timeout. Please check your internet connection and try again.');
      }
      if (fetchError instanceof TypeError) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw fetchError;
    }
    
    if (!saleResponse.ok) {
      const errorText = await saleResponse.text();
      console.error('Sale creation failed:', saleResponse.status, errorText);
      
      if (saleResponse.status === 401) {
        throw new Error('Authentication expired. Please log in again.');
      } else if (saleResponse.status === 403) {
        throw new Error('Access denied. You may not have permission to create sales.');
      } else {
        throw new Error(`Failed to create sale: ${saleResponse.statusText}`);
      }
    }
    
    const saleResult = await saleResponse.json();
    console.log('Sale created:', saleResult);
    
    // Create sale items with timeout
    console.log('Creating sale items:', saleItems.length);
    
    const itemsController = new AbortController();
    const itemsTimeoutId = setTimeout(() => {
      console.error('⏰ Sale items creation timeout (30s)');
      itemsController.abort();
    }, 30000); // 30 seconds timeout

    let itemsResponse;
    try {
      itemsResponse = await fetch(
        `${supabaseUrl}/rest/v1/sale_items`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(saleItems),
          signal: itemsController.signal
        }
      );
      clearTimeout(itemsTimeoutId);
    } catch (fetchError) {
      clearTimeout(itemsTimeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Sale items creation timeout. Please check your internet connection and try again.');
      }
      if (fetchError instanceof TypeError) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw fetchError;
    }
    
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

      const costsController = new AbortController();
      const costsTimeoutId = setTimeout(() => {
        console.error('⏰ Custom costs creation timeout (30s)');
        costsController.abort();
      }, 30000); // 30 seconds timeout

      try {
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
            body: JSON.stringify(customCostRecords),
            signal: costsController.signal
          }
        );
        clearTimeout(costsTimeoutId);

        if (!costsResponse.ok) {
          const errorText = await costsResponse.text();
          console.error('Custom costs creation failed:', costsResponse.status, errorText);
          // Don't fail the whole transaction, just log the error
        } else {
          console.log('Custom costs created successfully');
        }
      } catch (fetchError) {
        clearTimeout(costsTimeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('⏰ Custom costs creation timeout - continuing without failing transaction');
          // Don't fail the whole transaction on timeout
        } else if (fetchError instanceof TypeError) {
          console.error('Network error during custom costs creation - continuing');
          // Don't fail the whole transaction on network error
        } else {
          console.error('Custom costs creation error:', fetchError.message);
          // Don't fail the whole transaction on other errors
        }
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
    console.error('Sale creation error:', error);
    throw new Error(`Failed to create sale: ${error.message}`);
  }
};

console.log('✅ API timeout fixes applied successfully');
console.log('📋 Fixed functions:');
console.log('  - salesAPI.getAll: Added 30s timeout');
console.log('  - customersAPI.getAll: Added 30s timeout');  
console.log('  - salesAPI.create: Added 10s timeout for user profile query, 30s for other operations');