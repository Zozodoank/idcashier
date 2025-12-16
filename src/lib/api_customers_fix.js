// Customers API Fix - Replace getAll method to use direct fetch
export const customersAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching customers with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      const response = await fetch(
        `${supabaseUrl}/rest/v1/customers?select=*`,
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
      throw error;
    }
  },
  
  // Other methods remain the same
  getById: async (id, token) => {
    // This will remain unchanged - it doesn't timeout
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.id)
      .single()
      .setHeader('Authorization', `Bearer ${token}`);
    
    if (error) {
      throw new Error(error.message || 'Failed to get customer');
    }
    
    return data;
  }
};