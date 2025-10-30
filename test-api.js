import supabase from './server/config/supabase.js';

// Test the sales API endpoint logic
async function testSalesEndpoint() {
  try {
    console.log('Testing sales endpoint logic...');
    
    // Simulate a user ID (demo user)
    const userId = 'ddd6bd3d-16bd-4a89-8262-14159b404a03';
    
    // Get all users in the tenant (simulate tenant-based filtering)
    const { data: tenantUsers, error: tenantError } = await supabase
      .from('users')
      .select('id')
      .or(`id.eq.${userId},tenant_id.eq.${userId}`);
    
    if (tenantError) {
      throw tenantError;
    }
    
    console.log('Tenant users:', tenantUsers);
    
    // Extract user IDs
    const userIds = tenantUsers.map(user => user.id);
    console.log('User IDs:', userIds);
    
    // Get sales data
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers(name),
        user:users(name)
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    console.log('Sales data count:', data.length);
    console.log('First sale:', JSON.stringify(data[0], null, 2));
    
    // Get sale IDs for fetching items
    const saleIds = data.map(sale => sale.id);
    console.log('Sale IDs:', saleIds);
    
    // Get all sale items for the sales
    let itemsBySaleId = {};
    if (saleIds.length > 0) {
      const { data: allItems, error: itemsError } = await supabase
        .from('sale_items')
        .select(`
          *,
          product:products(name)
        `)
        .in('sale_id', saleIds);
      
      if (itemsError) {
        console.error('Get sale items error:', itemsError);
        itemsBySaleId = {};
      } else {
        console.log('Sale items count:', allItems.length);
        console.log('First item:', JSON.stringify(allItems[0], null, 2));
        
        // Group items by sale_id
        allItems.forEach(item => {
          const formattedItem = {
            ...item,
            product_name: item.product ? item.product.name : 'Unknown Product',
            product_id: item.product_id || 0
          };
          if (!itemsBySaleId[item.sale_id]) {
            itemsBySaleId[item.sale_id] = [];
          }
          itemsBySaleId[item.sale_id].push(formattedItem);
        });
      }
    }
    
    console.log('Items by sale ID:', Object.keys(itemsBySaleId).length);
    
    // Format the data to match the original structure
    const formattedData = data.map(sale => ({
      ...sale,
      customer_name: sale.customer ? sale.customer.name : 'Unknown Customer',
      user_name: sale.user ? sale.user.name : 'Unknown User',
      customer_id: sale.customer_id || 0,
      items: itemsBySaleId[sale.id] || []
    }));
    
    console.log('Formatted data count:', formattedData.length);
    console.log('First formatted sale with items:', JSON.stringify(formattedData[0], null, 2));
    
    // Check if items are properly attached
    const salesWithItems = formattedData.filter(sale => sale.items && sale.items.length > 0);
    console.log('Sales with items count:', salesWithItems.length);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSalesEndpoint();