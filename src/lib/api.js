// API utility functions for idCashier
import { supabase } from '@/lib/supabaseClient';

// Helper function to handle API responses
const handleResponse = async (response) => {
  // Log response details for debugging
  console.log('API Response:', {
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    headers: Object.fromEntries(response.headers.entries())
  });
  
  // Check if response has content
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');
  
  // If no content or content-length is 0, throw descriptive error
  if (contentLength === '0' || !contentLength) {
    throw new Error('Server tidak merespons dengan benar. Pastikan backend server berjalan di port 3001');
  }
  
  // If content type is not JSON, throw descriptive error
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Server tidak merespons dengan benar. Pastikan backend server berjalan di port 3001');
  }
  
  try {
    const data = await response.json();
    // Log parsed data for debugging (limited size)
    if (data && typeof data === 'object' && Object.keys(data).length <= 10) {
      console.log('Parsed response data:', data);
    } else if (Array.isArray(data) && data.length <= 5) {
      console.log('Parsed response data (first 5 items):', data.slice(0, 5));
    }
    return data;
  } catch (jsonError) {
    // Handle JSON parsing errors
    throw new Error('Server mengembalikan data yang tidak valid. Pastikan backend server berjalan dengan benar.');
  }
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log login attempt
      console.log(`Attempting login for: ${normalizedEmail}`);
      
      // Call auth-login edge function using fetch to access HTTP status
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Use the Supabase URL to call the edge function
      const functionsUrl = `${supabaseUrl}/functions/v1/auth-login`;
      const response = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ email: normalizedEmail, password })
      });

      const data = await response.json();

      // Check for HTTP 403 with subscription expired
      if (response.status === 403 && data.subscriptionExpired === true) {
        return {
          success: false,
          error: data.message || data.error || 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.',
          subscriptionExpired: true
        };
      }

      // Check for other errors
      if (!response.ok) {
        throw new Error(data.error || data.message || `Login failed with status ${response.status}`);
      }

      if (!data || !data.user || !data.token) {
        throw new Error('Invalid response from server');
      }

      // Set session token using supabase.auth.setSession() if session data is available
      if (data.session && data.session.access_token && data.session.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          });
        } catch (sessionError) {
          // If setSession fails, log but continue - token will be used directly
          console.log('Could not set session, will use token directly:', sessionError);
        }
      }

      // Include tenant_id as tenantId in response
      const userResponse = {
        ...data.user,
        tenantId: data.user.tenant_id || data.user.tenantId
      };
      
      return {
        user: userResponse,
        token: data.token,
        message: data.message || 'Login successful'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Login error: ${error.message}`);
      
      // Check if error is from edge function with subscription expired
      if (error.message && (error.message.includes('subscriptionExpired') || error.message.includes('Subscription expired'))) {
        return {
          success: false,
          error: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.',
          subscriptionExpired: true
        };
      }
      
      // Re-throw other errors
      throw error;
    }
  },
  
  register: async (name, email, password, role = 'owner') => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log registration attempt
      console.log(`Attempting registration for: ${normalizedEmail}`);
      
      // First, try to sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            name: name,
            role: role
          }
        }
      });
      
      if (authError) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Registration failed';
        if (authError.status === 400) {
          errorMessage = 'Invalid input data';
        } else if (authError.status === 409) {
          errorMessage = 'User already exists';
        } else if (authError.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = authError.message || 'Registration failed';
        }
        throw new Error(errorMessage);
      }
      
      // If user already exists but is not confirmed, authData.user will be null
      if (!authData.user) {
        throw new Error('User already exists but is not confirmed. Please check your email.');
      }
      
      // Set the auth token for subsequent requests
      if (authData.session) {
        await supabase.auth.setSession(authData.session);
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Insert user data into users table
      const userId = authData.user.id;
      const userTenantId = role === 'owner' ? userId : null; // Will be set by admin
      
      const { data: userData, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            name: name,
            email: normalizedEmail,
            role: role,
            tenant_id: userTenantId
          }
        ])
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .single();
      
      if (insertError) {
        console.error('User creation error:', {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        });
        throw new Error(insertError.message || 'Failed to create user profile');
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      return {
        user: userResponse,
        token: authData.session?.access_token || null,
        message: 'User registered successfully'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Registration error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  getCurrentUser: async (token) => {
    try {
      // Log user profile request
      console.log('Fetching current user profile');
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get user profile from users table by EMAIL instead of ID
      // This solves the ID mismatch issue between Supabase Auth and the database
      // Fallback strategy implemented to handle RLS configuration issues that cause error 406
      // If .single() fails with PGRST116 (406), try query without .single() and handle array result
      // This is defensive programming for RLS misconfiguration; for permanent fix, see SUPABASE_RLS_FIX.sql
      let userData;
      try {
        const result = await supabase
          .from('users')
          .select('id, name, email, role, tenant_id, permissions, created_at')
          .eq('email', authUser.email)  // Use email instead of ID
          .single();
        userData = result.data;
        if (result.error) {
          throw result.error;
        }
      } catch (singleError) {
        // Handle error 406 (PGRST116) with fallback strategy
        if (singleError.code === 'PGRST116') {
          console.error('Error 406 detected in getCurrentUser - likely RLS configuration issue:', {
            code: singleError.code,
            message: singleError.message,
            details: singleError.details,
            hint: singleError.hint
          });
          console.log('Attempting fallback query without .single() to bypass potential RLS block');
          
          // Fallback: query without .single() to get array
          const { data: userArray, error: arrayError } = await supabase
            .from('users')
            .select('id, name, email, role, tenant_id, permissions, created_at')
            .eq('email', authUser.email);
          
          if (arrayError) {
            console.error('Fallback query also failed:', arrayError);
            throw new Error('Failed to get user profile: ' + arrayError.message);
          }
          
          if (userArray.length === 0) {
            console.log('Fallback query returned empty array - user not found');
            throw new Error('User not found');
          } else if (userArray.length === 1) {
            console.log('Fallback query succeeded with single user');
            userData = userArray[0];
          } else {
            console.log('Fallback query returned multiple users - data inconsistency');
            throw new Error('Multiple users found');
          }
          
          console.log('RLS issue confirmed - fallback succeeded. For permanent fix, apply policies from SUPABASE_RLS_FIX.sql');
        } else {
          // Re-throw non-406 errors
          throw singleError;
        }
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      return userResponse;
    } catch (error) {
      // Log error detail for debugging
      console.log(`Get user error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  requestPasswordReset: async (email) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log password reset request
      console.log(`Requesting password reset for: ${normalizedEmail}`);
      
      // Determine redirect URL based on environment
      // Check if running on localhost/development
      const isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
      
      // Use current origin for development, configured URL for production
      const redirectUrl = isDevelopment 
        ? `${window.location.origin}/reset-password`
        : (import.meta.env.VITE_SITE_URL || 'https://idcashier.my.id') + '/reset-password';
      
      console.log('Environment:', isDevelopment ? 'Development' : 'Production');
      console.log('Using redirect URL:', redirectUrl);
      
      // Use Supabase Auth to send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: redirectUrl
      });
      
      if (error) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Failed to request password reset';
        if (error.status === 400) {
          errorMessage = 'Invalid email format';
        } else if (error.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = error.message || 'Failed to request password reset';
        }
        throw new Error(errorMessage);
      }
      
      return {
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Password reset request error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },
  
  resetPassword: async (token, password) => {
    try {
      // Log password reset attempt
      console.log('Attempting to reset password');
      
      // Update user's password using the token
      const { error } = await supabase.auth.updateUser({ password: password });
      
      if (error) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Failed to reset password';
        if (error.status === 400) {
          errorMessage = 'Invalid or expired reset token';
        } else if (error.status === 500) {
          errorMessage = 'Server error, silakan coba lagi';
        } else {
          errorMessage = error.message || 'Failed to reset password';
        }
        throw new Error(errorMessage);
      }
      
      return {
        success: true,
        message: 'Password has been reset successfully.'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Password reset error: ${error.message}`);
      // Re-throw other errors
      throw error;
    }
  },

  updatePassword: async (password) => {
    try {
      console.log('=== UPDATE PASSWORD START ===');
      console.log('Password length:', password.length);
      
      // Check current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session status:', sessionError ? 'ERROR' : 'OK');
      if (sessionData?.session) {
        console.log('Session user:', sessionData.session.user.email);
        console.log('Session expires at:', new Date(sessionData.session.expires_at * 1000).toLocaleString());
      } else {
        console.error('No active session found!');
        throw new Error('Session expired. Please request a new password reset link.');
      }
      
      // Update password - session recovery sudah di-set sebelumnya
      const { data, error } = await supabase.auth.updateUser({ 
        password: password 
      });
      
      if (error) {
        console.error('Update password error:', error);
        let errorMessage = 'Failed to update password';
        if (error.message && error.message.includes('session')) {
          errorMessage = 'Session expired. Please request a new password reset link.';
        } else if (error.status === 400) {
          errorMessage = 'Invalid password format. Use at least 6 characters.';
        } else {
          errorMessage = error.message || 'Failed to update password';
        }
        throw new Error(errorMessage);
      }
      
      console.log('Password updated successfully');
      console.log('=== UPDATE PASSWORD END ===');
      
      return {
        success: true,
        data,
        message: 'Password updated successfully'
      };
    } catch (error) {
      console.log(`Password update error: ${error.message}`);
      throw error;
    }
  },

  getUserData: async (authUserId, token) => {
    try {
      // Get auth user to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      return userData;
    } catch (error) {
      console.log(`Get user data error: ${error.message}`);
      throw error;
    }
  },
}

// Products API
export const productsAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch products for this user's tenant with related data
      // Both owner and cashier can see all products in the tenant
      let productsQuery = supabase
        .from('products')
        .select(`
          *,
          category:categories!products_category_id_fkey(name),
          supplier:suppliers!products_supplier_id_fkey(name, phone, address)
        `);

      // RLS policy "Users can view tenant products" will handle filtering automatically
      // No need to add additional filter - cashier will see owner's products via RLS

      const { data: rawData, error } = await productsQuery;
      
      if (error) {
        throw new Error(error.message || 'Failed to get products');
      }
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData?.map(product => ({
        ...product,
        category_name: product.category?.name || null,
        supplier_name: product.supplier?.name || null,
        supplier_phone: product.supplier?.phone || null,
        supplier_address: product.supplier?.address || null,
        cost_price: product.cost || null // Alias for ReportsPage compatibility
      })) || [];
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch product by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (productData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to product data using the database user ID
      const productWithUser = {
        ...productData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the product
      };
      
      // Create product
      const { data, error } = await supabase
        .from('products')
        .insert([productWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, productData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update product using the database user ID
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete product using the database user ID
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete product');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Sales API
export const salesAPI = {
  getAll: async (token) => {
    try {
      // Log request for debugging
      console.log('Fetching all sales data');
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch sales for this user's tenant with related data
      // Join with users, customers, and get sale_items with products
      // Both owner and cashier can see all tenant sales
      let salesQuery = supabase
        .from('sales')
        .select(`
          *,
          user:users!sales_user_id_fkey(name, email),
          customer:customers!sales_customer_id_fkey(name, email, phone),
          sale_items(
            *,
            product:products!sale_items_product_id_fkey(
              name,
              barcode,
              price,
              cost,
              supplier:suppliers!products_supplier_id_fkey(name)
            )
          )
        `);

      // RLS policy "Users can view tenant sales" will handle filtering automatically
      // Both owner and cashier will see all sales in the tenant via RLS

      const { data: rawData, error } = await salesQuery.order('created_at', { ascending: false });
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData?.map(sale => {
        // Determine customer name:
        // - If customer_id is null (walk-in customer) → Set to "Umum"
        // - If customer_id exists but customer is deleted → Set to null (will show "Unknown Customer")
        let customerName = null;
        if (sale.customer_id === null) {
          // Walk-in customer (no customer_id specified)
          customerName = 'Umum';
        } else if (sale.customer?.name) {
          // Customer exists and has name
          customerName = sale.customer.name;
        }
        // else: customer_id exists but customer deleted → customerName stays null
        
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
      
      // Log response data for debugging (limited to first 3 items to avoid huge logs)
      console.log('Sales fetch response data (first 3 items):', JSON.stringify(data.slice(0, 3), null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to get sales';
        
        // Handle specific error cases
        if (error.message && error.message.includes('pembayaran')) {
          errorMessage = error.message;
        } else if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid. Periksa kembali data yang dimasukkan.';
        } else {
          errorMessage = error.message || 'Gagal mengambil data penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sales fetch error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Log request for debugging
      console.log('Fetching sale data with ID:', id);
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch sale by ID for this user's tenant with related data
      const { data: rawData, error } = await supabase
        .from('sales')
        .select(`
          *,
          user:users!sales_user_id_fkey(name, email),
          customer:customers!sales_customer_id_fkey(name, email, phone),
          sale_items(
            *,
            product:products!sale_items_product_id_fkey(
              name,
              barcode,
              price,
              cost,
              supplier:suppliers!products_supplier_id_fkey(name)
            )
          )
        `)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      // Transform data to flatten nested relationships for backward compatibility
      const data = rawData ? (() => {
        // Determine customer name:
        // - If customer_id is null (walk-in customer) → Set to "Umum"
        // - If customer_id exists but customer is deleted → Set to null (will show "Unknown Customer")
        let customerName = null;
        if (rawData.customer_id === null) {
          // Walk-in customer (no customer_id specified)
          customerName = 'Umum';
        } else if (rawData.customer?.name) {
          // Customer exists and has name
          customerName = rawData.customer.name;
        }
        // else: customer_id exists but customer deleted → customerName stays null
        
        return {
          ...rawData,
          user_name: rawData.user?.name || null,
          user_email: rawData.user?.email || null,
          customer_name: customerName,
          customer_email: rawData.customer?.email || null,
          customer_phone: rawData.customer?.phone || null,
          sale_items: rawData.sale_items?.map(item => ({
            ...item,
            product_name: item.product?.name || null,
            barcode: item.product?.barcode || null,
            product_price: item.product?.price || null,
            product_cost: item.product?.cost || null,
            supplier_name: item.product?.supplier?.name || null
          })) || []
        };
      })() : null;
      
      // Log response data for debugging
      console.log('Sale fetch response data:', JSON.stringify(data, null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to get sale';
        
        // Handle specific error cases
        if (error.message && error.message.includes('pembayaran')) {
          errorMessage = error.message;
        } else if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid. Periksa kembali data yang dimasukkan.';
        } else {
          errorMessage = error.message || 'Gagal mengambil data penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sale fetch error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },
  
  create: async (saleData, token) => {
    try {
      // Log request payload for debugging
      console.log('Creating sale with data:', JSON.stringify(saleData, null, 2));
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Generate UUIDs for sale and sale items
      const saleId = crypto.randomUUID();
      
      // Extract custom_costs before creating sale (it's a separate table)
      const customCosts = saleData.custom_costs || [];
      
      // Add user_id to sale data using the database user ID
      const saleWithUser = {
        ...saleData,
        id: saleId,
        user_id: userData.id // Use database user ID instead of Supabase Auth user ID
      };
      
      // Remove sale_items and custom_costs from the sale object (they're separate tables)
      delete saleWithUser.sale_items;
      delete saleWithUser.custom_costs;
      
      // Process sale items
      const saleItems = saleData.sale_items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        sale_id: saleId
      }));
      
      // Create sale in a transaction
      const { data, error } = await supabase
        .from('sales')
        .insert([saleWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create sale');
      }
      
      // Create sale items
      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);
      
      if (itemsError) {
        throw new Error(itemsError.message || 'Failed to create sale items');
      }
      
      // Create custom costs if any
      if (customCosts.length > 0) {
        const customCostRecords = customCosts.map(cost => ({
          id: crypto.randomUUID(),
          sale_id: saleId,
          label: cost.label,
          amount: cost.amount
        }));

        const { error: costsError } = await supabase
          .from('sale_custom_costs')
          .insert(customCostRecords);

        if (costsError) {
          console.error('Failed to create custom costs:', costsError);
          // Don't fail the whole transaction, just log the error
        }
      }
      
      // Return the complete sale with items
      const { data: completeSale, error: fetchError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .eq('id', saleId)
        .single();
      
      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch created sale');
      }
      
      // Log response data for debugging
      console.log('Sale creation response data:', JSON.stringify(completeSale, null, 2));
      
      return completeSale;
    } catch (error) {
      // Log error for debugging
      console.error('Sale creation error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },

  delete: async (id, token) => {
    try {
      // Log delete request for debugging
      console.log('Deleting sale with ID:', id);
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete sale items first (due to foreign key constraint)
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', id);
      
      if (itemsError) {
        throw new Error(itemsError.message || 'Failed to delete sale items');
      }
      
      // Delete sale using the database user ID
      const { data, error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      // Log response data for debugging
      console.log('Sale deletion response data:', JSON.stringify(data, null, 2));
      
      if (error) {
        // Create more descriptive error messages based on error content
        let errorMessage = 'Failed to delete sale';
        
        // Handle specific error cases
        if (error.message && error.message.includes('Invalid input')) {
          errorMessage = 'Data input tidak valid.';
        } else {
          errorMessage = error.message || 'Gagal menghapus penjualan.';
        }
        
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error) {
      // Log error for debugging
      console.error('Sale deletion error:', error);
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },

  updatePaymentStatus: async (id, payment_status, payment_amount, token) => {
    try {
      // Log request for debugging
      console.log('Updating payment status for sale ID:', id, 'to:', payment_status);
      
      // Get current user from auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Prepare update data
      const updateData = { payment_status };
      
      // If marking as paid, update payment_amount and calculate change
      if (payment_status === 'paid' && payment_amount !== undefined) {
        // Get sale to calculate change
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .select('total_amount')
          .eq('id', id)
          .single();
        
        if (saleError) {
          throw new Error(saleError.message || 'Failed to get sale details');
        }
        
        updateData.payment_amount = payment_amount;
        updateData.change_amount = payment_amount - sale.total_amount;
      }
      
      // Update sale
      const { data, error } = await supabase
        .from('sales')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', userData.id) // Ensure user can only update their own sales
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update payment status');
      }
      
      console.log('Payment status updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Payment status update error:', error);
      throw error;
    }
  },

}

// Users API
export const usersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch users for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', userData.id); // Use database user ID instead of Supabase Auth user ID
      
      if (error) {
        throw new Error(error.message || 'Failed to get users');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch user by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get user');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (newUserData, token) => {
    try {
      // Call the auth-register Edge Function to create user in both auth.users and public.users
      const { data, error } = await supabase.functions.invoke('auth-register', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          name: newUserData.name,
          email: newUserData.email,
          password: newUserData.password,
          role: newUserData.role || 'cashier',
          tenant_id: newUserData.tenant_id,
          permissions: newUserData.permissions
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to create user');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data.user;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, updateData, token) => {
    try {
      // Call the users-update Edge Function which handles both public.users and auth.users updates
      const { data, error } = await supabase.functions.invoke(`users-update?id=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: updateData
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to update user');
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete user using the database user ID
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .eq('tenant_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Categories API
export const categoriesAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch categories for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userData.id); // Use database user ID instead of Supabase Auth user ID
      
      if (error) {
        throw new Error(error.message || 'Failed to get categories');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch category by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (categoryData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to category data using the database user ID
      const categoryWithUser = {
        ...categoryData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the category
      };
      
      // Create category
      const { data, error } = await supabase
        .from('categories')
        .insert([categoryWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, categoryData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update category using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete category using the database user ID
      const { data, error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete category');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Suppliers API
export const suppliersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch suppliers for this user's tenant
      // Both owner and cashier can see all suppliers in the tenant
      let suppliersQuery = supabase
        .from('suppliers')
        .select('*');

      // RLS policy "Users can view tenant suppliers" will handle filtering automatically
      // Both owner and cashier will see all suppliers in the tenant via RLS

      const { data, error } = await suppliersQuery;
      
      if (error) {
        throw new Error(error.message || 'Failed to get suppliers');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch supplier by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (supplierData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to supplier data using the database user ID
      const supplierWithUser = {
        ...supplierData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the supplier
      };
      
      // Create supplier
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplierWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, supplierData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update supplier using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete supplier using the database user ID
      const { data, error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete supplier');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Customers API
export const customersAPI = {
  getAll: async (token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch customers for this user's tenant
      // RLS policy "Users can view tenant customers" will handle filtering automatically
      // Both owner and cashier can see all customers in the tenant via RLS
      const { data, error } = await supabase
        .from('customers')
        .select('*');
      
      if (error) {
        throw new Error(error.message || 'Failed to get customers');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Fetch customer by ID for this user's tenant using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to get customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  create: async (customerData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Add user_id to customer data using the database user ID
      const customerWithUser = {
        ...customerData,
        user_id: userData.id, // Use database user ID instead of Supabase Auth user ID
        id: crypto.randomUUID() // Generate UUID for the customer
      };
      
      // Create customer
      const { data, error } = await supabase
        .from('customers')
        .insert([customerWithUser])
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to create customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  update: async (id, customerData, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Update customer using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL to get the correct database user ID
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role, tenant_id, permissions, created_at')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Delete customer using the database user ID
      const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
        .eq('user_id', userData.id) // Use database user ID instead of Supabase Auth user ID
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to delete customer');
      }
      
      return data;
    } catch (error) {
      // Re-throw errors
      throw error;
    }
  },
}

// Subscription API
export const subscriptionAPI = {
  getCurrentUserSubscription: async (token) => {
    try {
      // Validate token before proceeding
      if (!token) {
        throw new Error('No authentication token provided');
      }
      
      // Import the invokeFn helper
      const { invokeFn } = await import('./invokeFn');
      
      // Call Edge Function to get subscription data using invokeFn
      // Pass the token in the headers
      const data = await invokeFn('subscriptions-get-current-user', null, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return data || null;
    } catch (error) {
      // Log error for debugging
      console.error('Subscription API error:', error);
      
      // Re-throw other errors
      throw error;
    }
  }
};

// Settings API for app settings (HPP toggle, etc.)
export const settingsAPI = {
  get: async (key, token) => {
    try {
      // Get current user from auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Get setting by key - use maybeSingle() to handle cases where no row exists
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userData.id)
        .eq('setting_key', key)
        .maybeSingle();
      
      if (error) {
        throw new Error(error.message || 'Failed to get setting');
      }
      
      return data || null;
    } catch (error) {
      console.error('Settings API get error:', error);
      throw error;
    }
  },
  
  update: async (key, value, token) => {
    try {
      // Get current user from auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user profile from users table by EMAIL
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) {
        throw new Error(userError.message || 'Failed to get user profile');
      }
      
      // Upsert setting (insert or update)
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({
          user_id: userData.id,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,setting_key'
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(error.message || 'Failed to update setting');
      }
      
      return data;
    } catch (error) {
      console.error('Settings API update error:', error);
      throw error;
    }
  }
};

// Product HPP Breakdown API
export const productHPPBreakdownAPI = {
  getByProduct: async (productId, token) => {
    try {
      const { data, error } = await supabase
        .from('product_hpp_breakdown')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: true });
      
      if (error) {
        throw new Error(error.message || 'Failed to get HPP breakdown');
      }
      
      return data || [];
    } catch (error) {
      console.error('HPP Breakdown API get error:', error);
      throw error;
    }
  },
  
  save: async (productId, breakdownItems, token) => {
    try {
      // Delete existing breakdown items for this product
      const { error: deleteError } = await supabase
        .from('product_hpp_breakdown')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) {
        throw new Error(deleteError.message || 'Failed to delete old breakdown');
      }
      
      // Insert new breakdown items (only if there are items)
      if (breakdownItems && breakdownItems.length > 0) {
        const itemsToInsert = breakdownItems
          .filter(item => item.label && item.amount) // Only save items with label and amount
          .map(item => ({
            product_id: productId,
            label: item.label,
            amount: parseFloat(item.amount) || 0
          }));
        
        if (itemsToInsert.length > 0) {
          const { data, error } = await supabase
            .from('product_hpp_breakdown')
            .insert(itemsToInsert)
            .select();
          
          if (error) {
            throw new Error(error.message || 'Failed to save HPP breakdown');
          }
          
          return data;
        }
      }
      
      return [];
    } catch (error) {
      console.error('HPP Breakdown API save error:', error);
      throw error;
    }
  },
  
  delete: async (productId, token) => {
    try {
      const { error } = await supabase
        .from('product_hpp_breakdown')
        .delete()
        .eq('product_id', productId);
      
      if (error) {
        throw new Error(error.message || 'Failed to delete HPP breakdown');
      }
      
      return true;
    } catch (error) {
      console.error('HPP Breakdown API delete error:', error);
      throw error;
    }
  }
};

// Raw Materials API
export const rawMaterialsAPI = {
  getAll: async (token) => {
    try {
      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError) throw new Error(authError.message || 'Failed to get user');
      if (!authUser) throw new Error('User not authenticated');
      
      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) throw new Error(userError.message || 'Failed to get user profile');
      
      // Get all raw materials
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message || 'Failed to get raw materials');
      
      return data || [];
    } catch (error) {
      console.error('Raw Materials API getAll error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw new Error(error.message || 'Failed to get raw material');
      
      return data;
    } catch (error) {
      console.error('Raw Materials API getById error:', error);
      throw error;
    }
  },
  
  create: async (materialData, token) => {
    try {
      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError) throw new Error(authError.message || 'Failed to get user');
      if (!authUser) throw new Error('User not authenticated');
      
      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) throw new Error(userError.message || 'Failed to get user profile');
      
      // Create raw material
      const { data, error } = await supabase
        .from('raw_materials')
        .insert([{
          ...materialData,
          user_id: userData.id
        }])
        .select()
        .single();
      
      if (error) throw new Error(error.message || 'Failed to create raw material');
      
      return data;
    } catch (error) {
      console.error('Raw Materials API create error:', error);
      throw error;
    }
  },
  
  update: async (id, materialData, token) => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .update({
          ...materialData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(error.message || 'Failed to update raw material');
      
      return data;
    } catch (error) {
      console.error('Raw Materials API update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', id);
      
      if (error) {
        // Check if it's a foreign key constraint error
        if (error.code === '23503') {
          throw new Error('Tidak dapat menghapus. Bahan ini digunakan di produk.');
        }
        throw new Error(error.message || 'Failed to delete raw material');
      }
      
      return true;
    } catch (error) {
      console.error('Raw Materials API delete error:', error);
      throw error;
    }
  },
  
  deductStock: async (id, quantity, token) => {
    try {
      // Get current stock
      const { data: material, error: getError } = await supabase
        .from('raw_materials')
        .select('stock')
        .eq('id', id)
        .single();
      
      if (getError) throw new Error(getError.message || 'Failed to get raw material');
      
      const newStock = parseFloat(material.stock) - parseFloat(quantity);
      
      // Update stock
      const { data, error } = await supabase
        .from('raw_materials')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(error.message || 'Failed to deduct stock');
      
      return data;
    } catch (error) {
      console.error('Raw Materials API deductStock error:', error);
      throw error;
    }
  }
};

// Product Recipes API
export const productRecipesAPI = {
  getByProduct: async (productId, token) => {
    try {
      const { data, error } = await supabase
        .from('product_recipes')
        .select(`
          *,
          raw_materials:raw_material_id (
            id,
            name,
            unit,
            price_per_unit,
            stock
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: true });
      
      if (error) throw new Error(error.message || 'Failed to get recipes');
      
      return data || [];
    } catch (error) {
      console.error('Product Recipes API getByProduct error:', error);
      throw error;
    }
  },
  
  save: async (productId, recipes, token) => {
    try {
      // Delete existing recipes
      const { error: deleteError } = await supabase
        .from('product_recipes')
        .delete()
        .eq('product_id', productId);
      
      if (deleteError) throw new Error(deleteError.message || 'Failed to delete old recipes');
      
      // Insert new recipes (only if there are items)
      if (recipes && recipes.length > 0) {
        const recipesToInsert = recipes
          .filter(recipe => recipe.raw_material_id && recipe.quantity)
          .map(recipe => ({
            product_id: productId,
            raw_material_id: recipe.raw_material_id,
            quantity: parseFloat(recipe.quantity)
          }));
        
        if (recipesToInsert.length > 0) {
          const { data, error } = await supabase
            .from('product_recipes')
            .insert(recipesToInsert)
            .select();
          
          if (error) throw new Error(error.message || 'Failed to save recipes');
          
          return data;
        }
      }
      
      return [];
    } catch (error) {
      console.error('Product Recipes API save error:', error);
      throw error;
    }
  },
  
  calculateCost: async (productId, token) => {
    try {
      // Get recipes with raw material data
      const recipes = await productRecipesAPI.getByProduct(productId, token);
      
      // Calculate total cost
      const totalCost = recipes.reduce((sum, recipe) => {
        const cost = parseFloat(recipe.quantity) * parseFloat(recipe.raw_materials?.price_per_unit || 0);
        return sum + cost;
      }, 0);
      
      return totalCost;
    } catch (error) {
      console.error('Product Recipes API calculateCost error:', error);
      throw error;
    }
  }
};

// Global HPP API
export const globalHPPAPI = {
  getByMonth: async (year, month, token) => {
    try {
      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError) throw new Error(authError.message || 'Failed to get user');
      if (!authUser) throw new Error('User not authenticated');
      
      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) throw new Error(userError.message || 'Failed to get user profile');
      
      // Format month as YYYY-MM-01
      const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
      
      // Get global HPP for month
      const { data, error } = await supabase
        .from('global_hpp')
        .select('*')
        .eq('user_id', userData.id)
        .eq('month', monthDate)
        .order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message || 'Failed to get global HPP');
      
      return data || [];
    } catch (error) {
      console.error('Global HPP API getByMonth error:', error);
      throw error;
    }
  },
  
  upsert: async (hppData, token) => {
    try {
      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError) throw new Error(authError.message || 'Failed to get user');
      if (!authUser) throw new Error('User not authenticated');
      
      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single();
      
      if (userError) throw new Error(userError.message || 'Failed to get user profile');
      
      // Upsert (insert or update)
      const { data, error } = await supabase
        .from('global_hpp')
        .upsert({
          ...hppData,
          user_id: userData.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,label,month'
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message || 'Failed to save global HPP');
      
      return data;
    } catch (error) {
      console.error('Global HPP API upsert error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      const { error } = await supabase
        .from('global_hpp')
        .delete()
        .eq('id', id);
      
      if (error) throw new Error(error.message || 'Failed to delete global HPP');
      
      return true;
    } catch (error) {
      console.error('Global HPP API delete error:', error);
      throw error;
    }
  },
  
  getDailyRate: async (year, month, token) => {
    try {
      const hppItems = await globalHPPAPI.getByMonth(year, month, token);
      
      // Calculate total monthly amount
      const totalMonthly = hppItems.reduce((sum, item) => {
        return sum + parseFloat(item.monthly_amount || 0);
      }, 0);
      
      // Divide by 30 days
      const dailyRate = totalMonthly / 30;
      
      return { totalMonthly, dailyRate };
    } catch (error) {
      console.error('Global HPP API getDailyRate error:', error);
      throw error;
    }
  }
};

// Returns API
export const returnsAPI = {
  // Create a return
  create: async (returnData, token) => {
    try {
      // Get user data
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError) throw userError;

      const userData = await authAPI.getUserData(user.id, token);

      // Start a transaction-like operation
      // 1. Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          user_id: userData.id,
          sale_id: returnData.sale_id,
          return_type: returnData.return_type, // 'stock' or 'loss'
          reason: returnData.reason || '',
          total_amount: returnData.total_amount,
          created_by: user.id
        })
        .select()
        .single();

      if (returnError) {
        throw new Error(returnError.message || 'Failed to create return');
      }

      // 2. Create return items
      const returnItems = returnData.items.map(item => ({
        return_id: returnRecord.id,
        sale_item_id: item.sale_item_id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost
      }));

      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(returnItems);

      if (itemsError) {
        // Rollback: delete return record
        await supabase.from('returns').delete().eq('id', returnRecord.id);
        throw new Error(itemsError.message || 'Failed to create return items');
      }

      // 3. Update stock if return_type is 'stock'
      if (returnData.return_type === 'stock') {
        for (const item of returnData.items) {
          const { error: stockError } = await supabase.rpc('increment_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity
          });

          if (stockError) {
            console.error('Failed to restore stock for product:', item.product_id, stockError);
          }
        }
      }

      // 4. Update sale return_status
      const allItemsReturned = returnData.items.length === returnData.total_sale_items;
      const { error: statusError } = await supabase
        .from('sales')
        .update({ 
          return_status: allItemsReturned ? 'full' : 'partial' 
        })
        .eq('id', returnData.sale_id);

      if (statusError) {
        console.error('Failed to update sale return status:', statusError);
      }

      console.log('Return created successfully:', returnRecord);
      return returnRecord;
    } catch (error) {
      console.error('Return creation error:', error);
      throw error;
    }
  },

  // Get all returns
  getAll: async (token) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError) throw userError;

      const userData = await authAPI.getUserData(user.id, token);

      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          sales(
            total_amount,
            customer_id,
            customers(name)
          ),
          return_items(
            *,
            products(name)
          )
        `)
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message || 'Failed to fetch returns');
      }

      return data || [];
    } catch (error) {
      console.error('Fetch returns error:', error);
      throw error;
    }
  },

  // Get returns by sale ID
  getBySaleId: async (saleId, token) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError) throw userError;

      const userData = await authAPI.getUserData(user.id, token);

      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          return_items(
            *,
            products(name)
          )
        `)
        .eq('sale_id', saleId)
        .eq('user_id', userData.id);

      if (error) {
        throw new Error(error.message || 'Failed to fetch returns');
      }

      return data || [];
    } catch (error) {
      console.error('Fetch returns by sale ID error:', error);
      throw error;
    }
  }
};

// Expenses API
export const expensesAPI = {
  async getAll(token, filters = {}) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        category:expense_categories(id, name)
      `)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  async create(expenseData, token) {
    const { data: userData } = await supabase.auth.getUser();
    const { data: user } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userData.user.id)
      .single();
    
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        ...expenseData,
        tenant_id: user.tenant_id,
        created_by: userData.user.id
      })
      .select(`
        *,
        category:expense_categories(id, name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async update(id, expenseData, token) {
    const { data, error } = await supabase
      .from('expenses')
      .update(expenseData)
      .eq('id', id)
      .select(`
        *,
        category:expense_categories(id, name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async delete(id, token) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Expense Categories API
export const expenseCategoriesAPI = {
  async getAll(token) {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data;
  },
  
  async create(categoryData, token) {
    const { data: userData } = await supabase.auth.getUser();
    const { data: user } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userData.user.id)
      .single();
    
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        ...categoryData,
        tenant_id: user.tenant_id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  async delete(id, token) {
    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

export default {
  authAPI,
  productsAPI,
  salesAPI,
  usersAPI,
  categoriesAPI,
  suppliersAPI,
  customersAPI,
  subscriptionAPI,
  settingsAPI,
  productHPPBreakdownAPI,
  rawMaterialsAPI,
  productRecipesAPI,
  globalHPPAPI,
  returnsAPI,
  expensesAPI,
  expenseCategoriesAPI
};
