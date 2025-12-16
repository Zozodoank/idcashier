
// Alternative approach: Modify cronjob to use edge function pattern
// Instead of direct Supabase client, use edge functions

// Current problematic code in demo-reset/index.ts:
// const { data: products } = await supabase.from('products').select('id').in('user_id', userIds)

// Alternative fix:
async function getProductsViaEdgeFunction(userToken) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/products-get-all`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.ok) {
    const result = await response.json();
    return result.data || [];
  }
  return [];
}

// Modified products counting logic:
const products = await getProductsViaEdgeFunction(userToken);
const productIds = products.map(p => p.id);
console.log('Products found via edge function:', productIds.length);
