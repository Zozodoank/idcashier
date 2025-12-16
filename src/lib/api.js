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
      console.log(`🔐 Attempting login for: ${normalizedEmail}`);
      console.time('LoginRequest');
      
      // Call auth-login edge function using fetch to access HTTP status
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Use the Supabase URL to call the edge function
      const functionsUrl = `${supabaseUrl}/functions/v1/auth-login-final`;
      console.log(`📡 Calling edge function: ${functionsUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏰ Login request timeout (60s) - Server took too long to respond');
        controller.abort();
      }, 60000); // Increased to 60 seconds timeout for slower connections/cold starts

      let response, data;
      try {
        response = await fetch(functionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify({ email: normalizedEmail, password }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log(`📥 Response received: ${response.status} ${response.statusText}`);

        data = await response.json();
        console.timeEnd('LoginRequest');
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.timeEnd('LoginRequest');
        
        // Handle abort/timeout error
        if (fetchError.name === 'AbortError') {
          throw new Error('Login request timeout. Please check your internet connection and try again.');
        }
        // Handle network errors
        if (fetchError instanceof TypeError) {
          throw new Error('Network error. Please check your internet connection.');
        }
        throw fetchError;
      }


      // Check for HTTP 403 with subscription expired
      if (response.status === 403 && data.subscriptionExpired === true) {
        console.log('🚫 Subscription expired response detected');
        return {
          success: false,
          error: data.message || data.error || 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.',
          subscriptionExpired: true
        };
      }

      // Check for other errors
      if (!response.ok) {
        console.error(`🚫 Response not OK: ${response.status}`);
        throw new Error(data.error || data.message || `Login failed with status ${response.status}`);
      }

      console.log('🔍 Validating response data...', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasToken: !!data?.token
      });

      if (!data || !data.user || !data.token) {
        console.error('❌ Invalid data structure:', data);
        throw new Error('Invalid response from server');
      }

      console.log('✅ Response validated successfully');

      // Set session token using supabase.auth.setSession() - NON-BLOCKING
      // Don't wait for this to complete - let it run in background
      if (data.session && data.session.access_token && data.session.refresh_token) {
        console.log('🔄 Setting Supabase session (non-blocking)...');
        // Fire and forget - don't await
        supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        }).then(result => {
          if (result.error) {
            console.warn('⚠️ setSession error:', result.error.message);
          } else {
            console.log('✅ Supabase session set in background');
          }
        }).catch(err => {
          console.warn('⚠️ setSession failed:', err.message);
        });
      }

      // Include tenant_id as tenantId in response
      const userResponse = {
        ...data.user,
        tenantId: data.user.tenant_id || data.user.tenantId
      };
      
      console.log('✅ Login API returning success');
      return {
        user: userResponse,
        token: data.token,
        refreshToken: data.session?.refresh_token || null, // Return refresh token if available
        message: data.message || 'Login successful'
      };
    } catch (error) {
      // Log error detail for debugging
      console.error(`❌ Login error: ${error.message}`);
      
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
      
      // Validate required environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing. Please check environment variables.');
      }
      
      if (!token) {
        throw new Error('Authentication token is required');
      }
      
      // Get current user from auth to get their email
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        throw new Error(authError.message || 'Failed to get user from auth');
      }
      
      if (!authUser || !authUser.email) {
        throw new Error('User not authenticated or email not available');
      }
      
      // Add a small delay to ensure the session is properly propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get user profile from users table by EMAIL instead of ID
      // This solves the ID mismatch issue between Supabase Auth and the database
      // Fallback strategy implemented to handle RLS configuration issues that cause error 406
      // If .single() fails with PGRST116 (406), try query without .single() and handle array result
      // This is defensive programming for RLS misconfiguration; for permanent fix, see SUPABASE_RLS_FIX.sql
      // Use direct REST API for reliable auth
      const encodedEmail = encodeURIComponent(authUser.email);
      
      // CRITICAL: Add API key to URL FIRST, then add other params
      // This ensures API key is always present even if headers are stripped
      const baseUrl = `${supabaseUrl}/rest/v1/users`;
      const urlParams = new URLSearchParams({
        'apikey': supabaseAnonKey, // API key MUST be in URL
        'email': `eq.${authUser.email}`,
        'select': 'id,name,email,role,tenant_id,permissions,created_at'
      });
      const urlWithApiKey = `${baseUrl}?${urlParams.toString()}`;
      
      console.log('🔍 Fetching user profile from:', baseUrl);
      console.log('🔑 API key in URL:', supabaseAnonKey ? 'YES' : 'NO');
      console.log('🔑 API key value:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
      console.log('🎫 Token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
      
      // Ensure API key is in BOTH header AND URL parameter
      const headers = {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
      
      // Validate headers before making request
      if (!headers.apikey) {
        throw new Error('API key is missing from headers. Check VITE_SUPABASE_ANON_KEY environment variable.');
      }
      
      console.log('📤 Request details:', {
        url: baseUrl,
        hasApiKeyInUrl: urlWithApiKey.includes('apikey='),
        hasApiKeyInHeader: !!headers.apikey,
        hasToken: !!token
      });
      
      let response;
      try {
        response = await fetch(urlWithApiKey, {
          method: 'GET',
          headers: headers,
          // Ensure credentials are included
          credentials: 'include'
        });
      } catch (fetchError) {
        console.error('❌ Fetch request failed:', fetchError);
        // Handle network errors
        if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
          throw new Error('Network error: Unable to connect to server. Please check your internet connection and try again.');
        }
        throw fetchError;
      }
      
      console.log('User profile response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
        } catch (textError) {
          errorText = 'Unable to read error response';
        }
        console.error('User profile fetch error:', response.status, errorText);
        
        // Provide more specific error messages
        if (response.status === 406) {
          throw new Error('API key missing or invalid. Please check Supabase configuration.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 404) {
          throw new Error('User profile not found in database.');
        } else {
          throw new Error(`Failed to get user profile: ${response.status} ${errorText}`);
        }
      }
      
      let userArray;
      try {
        userArray = await response.json();
      } catch (jsonError) {
        console.error('❌ Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response format from server');
      }
      let userData;
      
      if (!Array.isArray(userArray)) {
        throw new Error('Invalid response format from server');
      }
      
      if (userArray.length === 0) {
        throw new Error('User not found in database');
      } else if (userArray.length === 1) {
        userData = userArray[0];
      } else {
        console.warn('Multiple users found with same email:', userArray);
        // Use the first one, but log warning
        userData = userArray[0];
      }
      
      // Include tenant_id as tenantId in response
      const userResponse = {
        ...userData,
        tenantId: userData.tenant_id
      };
      
      console.log('User profile fetched successfully:', userResponse.id);
      return userResponse;
    } catch (error) {
      // Log error detail for debugging
      console.error(`Get user error: ${error.message}`, error);
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
      
      // Get user profile from users table by EMAIL using direct REST API
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(authUser.email)}&select=id,name,email,role,tenant_id,permissions,created_at&apikey=${encodeURIComponent(supabaseAnonKey)}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get user profile: ${errorText}`);
      }
      
      const userArray = await response.json();
      if (userArray.length === 0) {
        throw new Error('User not found');
      }
      
      return userArray[0];
    } catch (error) {
      console.log(`Get user data error: ${error.message}`);
      throw error;
    }
  },

  verifyEmail: async (email, token) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log email verification attempt
      console.log(`🔍 Attempting email verification for: ${normalizedEmail}`);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Call auth-verify-email edge function
      const functionsUrl = `${supabaseUrl}/functions/v1/auth-verify-email`;
      console.log(`📡 Calling edge function: ${functionsUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏰ Email verification request timeout (20s)');
        controller.abort();
      }, 20000);

      let response, data;
      try {
        response = await fetch(functionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify({ email: normalizedEmail, token }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log(`📥 Response received: ${response.status} ${response.statusText}`);

        data = await response.json();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Email verification request timeout. Please try again.');
        }
        if (fetchError instanceof TypeError) {
          throw new Error('Network error. Please check your internet connection.');
        }
        throw fetchError;
      }

      if (!response.ok) {
        console.error(`🚫 Response not OK: ${response.status}`);
        throw new Error(data.error || data.message || `Email verification failed with status ${response.status}`);
      }

      console.log('✅ Email verification successful');
      return {
        success: true,
        message: data.message || 'Email verified successfully',
        user: data.user
      };
    } catch (error) {
      // Log error detail for debugging
      console.error(`❌ Email verification error: ${error.message}`);
      throw error;
    }
  },

  resendVerification: async (email) => {
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      // Log resend verification attempt
      console.log(`📧 Resending verification email for: ${normalizedEmail}`);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }
      
      // Use Supabase Auth resend functionality
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${import.meta.env.VITE_SITE_URL || 'https://idcashier.my.id'}/login`
        }
      });
      
      if (error) {
        // Map Supabase errors to the expected format
        let errorMessage = 'Failed to resend verification email';
        if (error.status === 400) {
          errorMessage = 'Invalid email format';
        } else if (error.status === 429) {
          errorMessage = 'Too many requests. Please wait before trying again.';
        } else {
          errorMessage = error.message || 'Failed to resend verification email';
        }
        throw new Error(errorMessage);
      }
      
      return {
        success: true,
        message: 'Verification email sent successfully. Please check your email.'
      };
    } catch (error) {
      // Log error detail for debugging
      console.log(`Resend verification error: ${error.message}`);
      throw error;
    }
  },
}

// Products API
export const productsAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching products with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      // We fetch products with joined category and supplier
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Products fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`Products fetched: ${rawData.length} items`);

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
      console.error('Products API Error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      console.log('📦 Getting product by ID:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get product: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.length === 0) {
        throw new Error('Product not found');
      }
      
      return data[0];
    } catch (error) {
      console.error('Product getById error:', error);
      throw error;
    }
  },
  
  create: async (productData, token) => {
    try {
      console.log('📦 Creating product...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Generate UUID for the product
      const productWithId = {
        ...productData,
        id: crypto.randomUUID()
      };
      // Note: user_id will be auto-populated by database trigger if exists
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/products`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(productWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Product creation failed:', response.status, errorText);
        throw new Error(`Failed to create product: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Product created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Product create error:', error);
      throw error;
    }
  },
  
  update: async (id, productData, token) => {
    try {
      console.log('✏️ Updating product:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(productData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Product update failed:', response.status, errorText);
        throw new Error(`Failed to update product: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Product updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Product update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting product:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/products?id=eq.${id}`,
        {
          method: 'DELETE',
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
        console.error('Product deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete product: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Product deleted:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Product delete error:', error);
      throw error;
    }
  },
}

// Sales API
export const salesAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching all sales data with direct fetch');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Direct fetch for sales with related data
      // Equivalent to:
      // .select(`*,user:users!sales_user_id_fkey(name, email),customer:customers!sales_customer_id_fkey(name, email, phone),sale_items(*,product:products!sale_items_product_id_fkey(name,barcode,price,cost,supplier:suppliers!products_supplier_id_fkey(name)))`)
      // .order('created_at', { ascending: false });
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/sales?select=*,user:users!sales_user_id_fkey(name,email),customer:customers!sales_customer_id_fkey(name,email,phone),sale_items(*,product:products!sale_items_product_id_fkey(name,barcode,price,cost,supplier:suppliers!products_supplier_id_fkey(name)))&order=created_at.desc`,
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
      // Log error for debugging
      console.error('Sales fetch error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      console.log('📄 Fetching sale by ID:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/sales?id=eq.${id}&select=*,user:users!sales_user_id_fkey(name,email),customer:customers!sales_customer_id_fkey(name,email,phone),sale_items(*,product:products!sale_items_product_id_fkey(name,barcode,price,cost,supplier:suppliers!products_supplier_id_fkey(name)))`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get sale: ${errorText}`);
      }
      
      const dataArray = await response.json();
      if (dataArray.length === 0) {
        throw new Error('Sale not found');
      }
      
      const rawData = dataArray[0];
      
      // Transform data to flatten nested relationships for backward compatibility
      let customerName = null;
      if (rawData.customer_id === null) {
        customerName = 'Umum';
      } else if (rawData.customer?.name) {
        customerName = rawData.customer.name;
      }
      
      const data = {
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
      
      console.log('✅ Sale fetched:', data.id);
      return data;
    } catch (error) {
      console.error('Sale fetch error:', error);
      throw error;
    }
  },
  
  create: async (saleData, token) => {
    try {
      // Log request payload for debugging
      console.log('Creating sale with data:', JSON.stringify(saleData, null, 2));
      
      // Get environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Decode token to get email (avoid supabase.auth.getUser which has API key issues)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const userEmail = payload.email;
      
      if (!userEmail) {
        throw new Error('No email found in token');
      }
      
      console.log('📧 User email from token:', userEmail);
      
      // Get user profile from users table by EMAIL using direct fetch
      const userProfileController = new AbortController();
      const userProfileTimeout = setTimeout(() => {
        console.error('⏰ User profile fetch timeout (10s)');
        userProfileController.abort();
      }, 10000);
      
      let userResponse;
      try {
        userResponse = await fetch(
          `${supabaseUrl}/rest/v1/users?select=id,name,email,role,tenant_id,permissions,created_at&email=eq.${encodeURIComponent(userEmail)}&apikey=${encodeURIComponent(supabaseAnonKey)}`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: userProfileController.signal
          }
        );
        clearTimeout(userProfileTimeout);
      } catch (fetchError) {
        clearTimeout(userProfileTimeout);
        if (fetchError.name === 'AbortError') {
          throw new Error('User profile fetch timeout');
        }
        throw fetchError;
      }
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('User profile fetch failed:', userResponse.status, errorText);
        throw new Error(`Failed to get user profile: ${userResponse.statusText}`);
      }
      
      const userDataArray = await userResponse.json();
      if (!userDataArray || userDataArray.length === 0) {
        throw new Error('User profile not found');
      }
      
      const userData = userDataArray[0];
      console.log('✅ User profile loaded:', userData.email);
      
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
      
      // Create sale using direct fetch to avoid Supabase client issues
      console.log('🚀 Sending sale creation request...');
      const saleController = new AbortController();
      const saleTimeout = setTimeout(() => saleController.abort(), 15000); // 15s timeout

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
      } finally {
        clearTimeout(saleTimeout);
      }

      if (!saleResponse.ok) {
        const errorText = await saleResponse.text();
        throw new Error(`Failed to create sale: ${errorText}`);
      }

      const saleResult = await saleResponse.json();
      const createdSale = saleResult[0];
      console.log('✅ Sale created with ID:', createdSale.id);
      
      // Create sale items using direct fetch
      console.log('📦 Creating sale items...');
      const itemsController = new AbortController();
      const itemsTimeout = setTimeout(() => itemsController.abort(), 15000);

      let itemsResponse;
      try {
        itemsResponse = await fetch(
          `${supabaseUrl}/rest/v1/sale_items`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(saleItems),
            signal: itemsController.signal
          }
        );
      } finally {
        clearTimeout(itemsTimeout);
      }

      if (!itemsResponse.ok) {
        const errorText = await itemsResponse.text();
        throw new Error(`Failed to create sale items: ${errorText}`);
      }
      
      // Create custom costs if any
      if (customCosts.length > 0) {
        console.log('💰 Creating custom costs...');
        const customCostRecords = customCosts.map(cost => ({
          id: crypto.randomUUID(),
          sale_id: saleId,
          label: cost.label,
          amount: cost.amount
        }));

        const costsController = new AbortController();
        const costsTimeout = setTimeout(() => costsController.abort(), 10000);

        try {
          const costsResponse = await fetch(
            `${supabaseUrl}/rest/v1/sale_custom_costs`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(customCostRecords),
              signal: costsController.signal
            }
          );

          if (!costsResponse.ok) {
            console.error('Failed to create custom costs:', await costsResponse.text());
          }
        } catch (err) {
          console.error('Error creating custom costs:', err);
        } finally {
          clearTimeout(costsTimeout);
        }
      }
      
      // Return the complete sale with items using direct fetch
      console.log('🔄 Fetching complete sale data...');
      const completeSaleController = new AbortController();
      const completeSaleTimeout = setTimeout(() => completeSaleController.abort(), 10000);

      let completeSaleResponse;
      try {
        completeSaleResponse = await fetch(
          `${supabaseUrl}/rest/v1/sales?id=eq.${saleId}&select=*,sale_items(*)`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: completeSaleController.signal
          }
        );
      } finally {
        clearTimeout(completeSaleTimeout);
      }

      if (!completeSaleResponse.ok) {
        const errorText = await completeSaleResponse.text();
        throw new Error(`Failed to fetch created sale: ${errorText}`);
      }

      const completeSaleData = await completeSaleResponse.json();
      const completeSale = completeSaleData[0];
      
      // Log response data for debugging
      console.log('Sale creation response data:', JSON.stringify(completeSale, null, 2));
      
      return completeSale;
    } catch (error) {
      // Log error for debugging
      console.error('Sale creation error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Sale creation timed out. Please check your internet connection.');
      }
      
      // Re-throw other errors with better formatting
      throw error;
    }
  },

  delete: async (id, token) => {
    try {
      // Log delete request for debugging
      console.log('🗑️ Deleting sale with ID:', id);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // 1. Delete custom costs first (child table)
      console.log('1️⃣ Deleting sale_custom_costs...');
      const costsResponse = await fetch(
        `${supabaseUrl}/rest/v1/sale_custom_costs?sale_id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!costsResponse.ok) {
        const errorText = await costsResponse.text();
        console.warn('Warning deleting sale_custom_costs:', errorText);
        // Don't throw - custom costs might not exist
      } else {
        console.log('✅ sale_custom_costs deleted');
      }
      
      // 2. Delete sale items (child table)
      console.log('2️⃣ Deleting sale_items...');
      const itemsResponse = await fetch(
        `${supabaseUrl}/rest/v1/sale_items?sale_id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!itemsResponse.ok) {
        const errorText = await itemsResponse.text();
        console.error('Failed to delete sale_items:', errorText);
        throw new Error(`Failed to delete sale items: ${errorText}`);
      }
      console.log('✅ sale_items deleted');
      
      // 3. Delete the sale itself (parent table)
      console.log('3️⃣ Deleting sale...');
      const saleResponse = await fetch(
        `${supabaseUrl}/rest/v1/sales?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );
      
      if (!saleResponse.ok) {
        const errorText = await saleResponse.text();
        console.error('Failed to delete sale:', errorText);
        throw new Error(`Failed to delete sale: ${errorText}`);
      }
      
      const deletedData = await saleResponse.json();
      console.log('✅ Sale deleted successfully:', deletedData);
      
      return deletedData[0] || { id };
    } catch (error) {
      // Log error for debugging
      console.error('❌ Sale deletion error:', error);
      throw error;
    }
  },

  updatePaymentStatus: async (id, payment_status, payment_amount, token) => {
    try {
      console.log('💳 Updating payment status for sale ID:', id, 'to:', payment_status);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Prepare update data
      const updateData = { payment_status };
      
      // If marking as paid, update payment_amount and calculate change
      if (payment_status === 'paid' && payment_amount !== undefined) {
        // Get sale to calculate change
        const saleResponse = await fetch(
          `${supabaseUrl}/rest/v1/sales?id=eq.${id}&select=total_amount`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!saleResponse.ok) {
          const errorText = await saleResponse.text();
          throw new Error(`Failed to get sale details: ${errorText}`);
        }
        
        const saleData = await saleResponse.json();
        if (saleData.length === 0) {
          throw new Error('Sale not found');
        }
        
        updateData.payment_amount = payment_amount;
        updateData.change_amount = payment_amount - saleData[0].total_amount;
      }
      
      // Update sale
      const response = await fetch(
        `${supabaseUrl}/rest/v1/sales?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update payment status: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Payment status updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Payment status update error:', error);
      throw error;
    }
  },

}

export const usersAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching users with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?select=*&apikey=${encodeURIComponent(supabaseAnonKey)}`,
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
        console.error('Users fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`Users fetched: ${rawData.length} items`);

      return rawData || [];
    } catch (error) {
      console.error('Users API Error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      console.log('👤 Getting user by ID:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // CRITICAL: Add API key to URL parameter
      const urlParams = new URLSearchParams({
        'apikey': supabaseAnonKey,
        'id': `eq.${id}`,
        'select': '*'
      });
      const urlWithApiKey = `${supabaseUrl}/rest/v1/users?${urlParams.toString()}`;
      
      const response = await fetch(urlWithApiKey, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get user: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.length === 0) {
        throw new Error('User not found');
      }
      
      return data[0];
    } catch (error) {
      console.error('User getById error:', error);
      throw error;
    }
  },
  
  create: async (newUserData, token) => {
    try {
      const { invokeFn } = await import('./invokeFn');
      
      // Call the auth-register Edge Function to create user in both auth.users and public.users
      const data = await invokeFn('auth-register', {
          name: newUserData.name,
          email: newUserData.email,
          password: newUserData.password,
          role: newUserData.role || 'cashier',
          tenant_id: newUserData.tenant_id,
          permissions: newUserData.permissions
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
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
      const { invokeFn } = await import('./invokeFn');
      
      // Call the users-update Edge Function which handles both public.users and auth.users updates
      const data = await invokeFn(`users-update?id=${id}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
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
      console.log('🗑️ Deleting user:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // CRITICAL: Add API key to URL parameter
      const urlParams = new URLSearchParams({
        'apikey': supabaseAnonKey,
        'id': `eq.${id}`
      });
      const urlWithApiKey = `${supabaseUrl}/rest/v1/users?${urlParams.toString()}`;
      
      const response = await fetch(urlWithApiKey, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete user: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ User deleted:', data[0]);
      return data[0];
    } catch (error) {
      console.error('User delete error:', error);
      throw error;
    }
  },
}

// Categories API
export const categoriesAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching categories with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      const response = await fetch(
        `${supabaseUrl}/rest/v1/categories?select=*`,
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
        console.error('Categories fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`Categories fetched: ${rawData.length} items`);

      return rawData || [];
    } catch (error) {
      console.error('Categories API Error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      console.log('📜 Getting category:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/categories?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get category: ${errorText}`);
      }
      
      const data = await response.json();
      return data[0];
    } catch (error) {
      console.error('Category getById error:', error);
      throw error;
    }
  },
  
  create: async (categoryData, token) => {
    try {
      console.log('📜 Creating category...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const categoryWithId = {
        ...categoryData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/categories`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(categoryWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Category creation failed:', response.status, errorText);
        throw new Error(`Failed to create category: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Category created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Category create error:', error);
      throw error;
    }
  },
  
  update: async (id, categoryData, token) => {
    try {
      console.log('✏️ Updating category:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/categories?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(categoryData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Category update failed:', response.status, errorText);
        throw new Error(`Failed to update category: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Category updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Category update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting category:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/categories?id=eq.${id}`,
        {
          method: 'DELETE',
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
        console.error('Category deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete category: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Category deleted:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Category delete error:', error);
      throw error;
    }
  },
}

// Suppliers API
export const suppliersAPI = {
  getAll: async (token) => {
      try {
        console.log('Fetching suppliers with direct fetch...');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
        // Use direct REST API call to bypass potential supabase-js client state issues
        const response = await fetch(
          `${supabaseUrl}/rest/v1/suppliers?select=*`,
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
          console.error('Suppliers fetch failed:', response.status, errorText);
          throw new Error(`Failed to fetch suppliers: ${response.statusText}`);
        }
  
        const rawData = await response.json();
        console.log(`Suppliers fetched: ${rawData.length} items`);
  
        return rawData || [];
      } catch (error) {
        console.error('Suppliers API Error:', error);
        throw error;
      }
    },
  
  getById: async (id, token) => {
    try {
      console.log('📦 Getting supplier:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/suppliers?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get supplier: ${errorText}`);
      }
      
      const data = await response.json();
      return data[0];
    } catch (error) {
      console.error('Supplier getById error:', error);
      throw error;
    }
  },
  
  create: async (supplierData, token) => {
    try {
      console.log('📦 Creating supplier...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const supplierWithId = {
        ...supplierData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/suppliers`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(supplierWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supplier creation failed:', response.status, errorText);
        throw new Error(`Failed to create supplier: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Supplier created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Supplier create error:', error);
      throw error;
    }
  },
  
  update: async (id, supplierData, token) => {
    try {
      console.log('✏️ Updating supplier:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/suppliers?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(supplierData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supplier update failed:', response.status, errorText);
        throw new Error(`Failed to update supplier: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Supplier updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Supplier update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting supplier:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/suppliers?id=eq.${id}`,
        {
          method: 'DELETE',
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
        console.error('Supplier deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete supplier: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Supplier deleted:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Supplier delete error:', error);
      throw error;
    }
  },
}

// Customers API
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
  
  getById: async (id, token) => {
    try {
      console.log('👤 Getting customer by ID:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/customers?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get customer: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.length === 0) {
        throw new Error('Customer not found');
      }
      
      return data[0];
    } catch (error) {
      console.error('Customer getById error:', error);
      throw error;
    }
  },
  
  create: async (customerData, token) => {
    try {
      console.log('👤 Creating customer...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Generate UUID for the customer
      const customerWithId = {
        ...customerData,
        id: crypto.randomUUID()
      };
      // Note: user_id will be auto-populated by database trigger
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/customers`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(customerWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Customer creation failed:', response.status, errorText);
        throw new Error(`Failed to create customer: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Customer created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Customer create error:', error);
      throw error;
    }
  },
  
  update: async (id, customerData, token) => {
    try {
      console.log('✏️ Updating customer:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/customers?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(customerData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Customer update failed:', response.status, errorText);
        throw new Error(`Failed to update customer: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Customer updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Customer update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting customer:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/customers?id=eq.${id}`,
        {
          method: 'DELETE',
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
        console.error('Customer deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete customer: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Customer deleted:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Customer delete error:', error);
      throw error;
    }
  },
}

export const subscriptionAPI = {
  getCurrentUserSubscription: async (token) => {
    try {
      console.log('Fetching subscription data with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      const response = await fetch(
        `${supabaseUrl}/functions/v1/subscriptions-get-current-user`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Subscription fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log('Subscription data fetched');

      return rawData || null;
    } catch (error) {
      console.error('Subscription API Error:', error);
      throw error;
    }
  }
};

// Settings API for app settings (HPP toggle, etc.)
export const settingsAPI = {
  // Optional userId: when provided, we scope settings to that user explicitly.
  // This helps ensure we read the correct row for per-user settings like HPP.
  get: async (key, token, userId) => {
    try {
      console.log('⚙️ Getting setting:', key);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const userFilter = userId ? `user_id=eq.${encodeURIComponent(userId)}&` : '';

      const response = await fetch(
        `${supabaseUrl}/rest/v1/app_settings?${userFilter}setting_key=eq.${encodeURIComponent(key)}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get setting: ${errorText}`);
      }
      
      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      console.error('Settings API get error:', error);
      throw error;
    }
  },
  
  // Optional userId: when provided, scope update to that user's row.
  update: async (key, value, token, userId) => {
    try {
      console.log('⚙️ Updating setting:', key);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // First try to get existing setting
      const userFilter = userId ? `user_id=eq.${encodeURIComponent(userId)}&` : '';

      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/app_settings?${userFilter}setting_key=eq.${encodeURIComponent(key)}&select=id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const existing = await existingResponse.json();
      
      if (existing && existing.length > 0) {
        // Update existing setting
        const response = await fetch(
          `${supabaseUrl}/rest/v1/app_settings?${userFilter}setting_key=eq.${encodeURIComponent(key)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              setting_value: value,
              updated_at: new Date().toISOString()
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update setting: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Setting updated:', data[0]);
        return data[0];
      } else {
        // Insert new setting
        const response = await fetch(
          `${supabaseUrl}/rest/v1/app_settings`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              id: crypto.randomUUID(),
              user_id: userId || undefined,
              setting_key: key,
              setting_value: value,
              updated_at: new Date().toISOString()
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create setting: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Setting created:', data[0]);
        return data[0];
      }
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
      console.log('📊 Getting HPP breakdown for product:', productId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/product_hpp_breakdown?product_id=eq.${productId}&select=*&order=created_at`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get HPP breakdown: ${errorText}`);
      }
      
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('HPP Breakdown API get error:', error);
      throw error;
    }
  },
  
  save: async (productId, breakdownItems, token) => {
    try {
      console.log('💾 Saving HPP breakdown for product:', productId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Delete existing breakdown items for this product
      const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/product_hpp_breakdown?product_id=eq.${productId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete old breakdown: ${errorText}`);
      }
      
      // Insert new breakdown items (only if there are items)
      if (breakdownItems && breakdownItems.length > 0) {
        const itemsToInsert = breakdownItems
          .filter(item => item.label && item.amount)
          .map(item => ({
            id: crypto.randomUUID(),
            product_id: productId,
            label: item.label,
            amount: parseFloat(item.amount) || 0
          }));
        
        if (itemsToInsert.length > 0) {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/product_hpp_breakdown`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(itemsToInsert)
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to save HPP breakdown: ${errorText}`);
          }
          
          const data = await response.json();
          console.log('✅ HPP breakdown saved:', data.length, 'items');
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
      console.log('🗑️ Deleting HPP breakdown for product:', productId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/product_hpp_breakdown?product_id=eq.${productId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete HPP breakdown: ${errorText}`);
      }
      
      console.log('✅ HPP breakdown deleted');
      return true;
    } catch (error) {
      console.error('HPP Breakdown API delete error:', error);
      throw error;
    }
  }
};

export const rawMaterialsAPI = {
  getAll: async (token) => {
    try {
      console.log('Fetching raw materials with direct fetch...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use direct REST API call to bypass potential supabase-js client state issues
      const response = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?select=*`,
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
        console.error('Raw Materials fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch raw materials: ${response.statusText}`);
      }

      const rawData = await response.json();
      console.log(`Raw Materials fetched: ${rawData.length} items`);

      return rawData || [];
    } catch (error) {
      console.error('Raw Materials API Error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      console.log('🧪 Getting raw material:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?id=eq.${id}&select=*`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get raw material: ${errorText}`);
      }
      
      const data = await response.json();
      return data[0];
    } catch (error) {
      console.error('Raw Materials API getById error:', error);
      throw error;
    }
  },
  
  create: async (materialData, token) => {
    try {
      console.log('🧪 Creating raw material...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const materialWithId = {
        ...materialData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(materialWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Raw material creation failed:', response.status, errorText);
        throw new Error(`Failed to create raw material: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Raw material created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Raw Materials API create error:', error);
      throw error;
    }
  },
  
  update: async (id, materialData, token) => {
    try {
      console.log('✏️ Updating raw material:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const updateData = {
        ...materialData,
        updated_at: new Date().toISOString()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Raw material update failed:', response.status, errorText);
        throw new Error(`Failed to update raw material: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Raw material updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Raw Materials API update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting raw material:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?id=eq.${id}`,
        {
          method: 'DELETE',
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
        // Check if it's a foreign key constraint error
        if (response.status === 409 || errorText.includes('23503')) {
          throw new Error('Tidak dapat menghapus. Bahan ini digunakan di produk.');
        }
        console.error('Raw material deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete raw material: ${errorText}`);
      }
      
      console.log('✅ Raw material deleted');
      return true;
    } catch (error) {
      console.error('Raw Materials API delete error:', error);
      throw error;
    }
  },
  
  deductStock: async (id, quantity, token) => {
    try {
      console.log('📩 Deducting stock for raw material:', id, 'quantity:', quantity);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Get current stock
      const getResponse = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?id=eq.${id}&select=stock`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!getResponse.ok) {
        throw new Error('Failed to get raw material stock');
      }
      
      const materials = await getResponse.json();
      if (!materials || materials.length === 0) {
        throw new Error('Raw material not found');
      }
      
      const newStock = parseFloat(materials[0].stock) - parseFloat(quantity);
      
      // Update stock
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/raw_materials?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            stock: newStock,
            updated_at: new Date().toISOString()
          })
        }
      );
      
      if (!updateResponse.ok) {
        throw new Error('Failed to deduct stock');
      }
      
      const data = await updateResponse.json();
      console.log('✅ Stock deducted:', data[0]);
      return data[0];
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
      console.log('🍽️ Getting recipes for product:', productId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/product_recipes?product_id=eq.${productId}&select=*,raw_materials:raw_material_id(id,name,unit,price_per_unit,stock)&order=created_at`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get recipes: ${errorText}`);
      }
      
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Product Recipes API getByProduct error:', error);
      throw error;
    }
  },
  
  save: async (productId, recipes, token) => {
    try {
      console.log('💾 Saving recipes for product:', productId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Delete existing recipes
      const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/product_recipes?product_id=eq.${productId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete old recipes: ${errorText}`);
      }
      
      // Insert new recipes (only if there are items)
      if (recipes && recipes.length > 0) {
        const recipesToInsert = recipes
          .filter(recipe => recipe.raw_material_id && recipe.quantity)
          .map(recipe => ({
            id: crypto.randomUUID(),
            product_id: productId,
            raw_material_id: recipe.raw_material_id,
            quantity: parseFloat(recipe.quantity)
          }));
        
        if (recipesToInsert.length > 0) {
          const response = await fetch(
            `${supabaseUrl}/rest/v1/product_recipes`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(recipesToInsert)
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to save recipes: ${errorText}`);
          }
          
          const data = await response.json();
          console.log('✅ Recipes saved:', data.length, 'items');
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
      console.log('📈 Getting global HPP for:', year, month);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Format month as YYYY-MM-01
      const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/global_hpp?month=eq.${monthDate}&select=*&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get global HPP: ${errorText}`);
      }
      
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Global HPP API getByMonth error:', error);
      throw error;
    }
  },
  
  upsert: async (hppData, token) => {
    try {
      console.log('💾 Saving global HPP...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Check if record exists
      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/global_hpp?label=eq.${encodeURIComponent(hppData.label)}&month=eq.${hppData.month}&select=id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const existing = await existingResponse.json();
      
      if (existing && existing.length > 0) {
        // Update existing
        const response = await fetch(
          `${supabaseUrl}/rest/v1/global_hpp?id=eq.${existing[0].id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              ...hppData,
              updated_at: new Date().toISOString()
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update global HPP: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Global HPP updated:', data[0]);
        return data[0];
      } else {
        // Insert new
        const response = await fetch(
          `${supabaseUrl}/rest/v1/global_hpp`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              ...hppData,
              id: crypto.randomUUID(),
              updated_at: new Date().toISOString()
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create global HPP: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Global HPP created:', data[0]);
        return data[0];
      }
    } catch (error) {
      console.error('Global HPP API upsert error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting global HPP:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/global_hpp?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete global HPP: ${errorText}`);
      }
      
      console.log('✅ Global HPP deleted');
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
      console.log('🔄 Creating return...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Get user data
      const userData = await authAPI.getUserData(null, token);

      // 1. Create return record
      const returnPayload = {
        id: crypto.randomUUID(),
        user_id: userData.id,
        sale_id: returnData.sale_id,
        return_type: returnData.return_type,
        reason: returnData.reason || '',
        total_amount: returnData.total_amount
      };
      
      const returnResponse = await fetch(
        `${supabaseUrl}/rest/v1/returns`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(returnPayload)
        }
      );
      
      if (!returnResponse.ok) {
        const errorText = await returnResponse.text();
        throw new Error(`Failed to create return: ${errorText}`);
      }
      
      const returnRecordArray = await returnResponse.json();
      const returnRecord = returnRecordArray[0];

      // 2. Create return items
      const returnItems = returnData.items.map(item => ({
        id: crypto.randomUUID(),
        return_id: returnRecord.id,
        sale_item_id: item.sale_item_id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost
      }));

      const itemsResponse = await fetch(
        `${supabaseUrl}/rest/v1/return_items`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(returnItems)
        }
      );

      if (!itemsResponse.ok) {
        // Rollback: delete return record
        await fetch(`${supabaseUrl}/rest/v1/returns?id=eq.${returnRecord.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const errorText = await itemsResponse.text();
        throw new Error(`Failed to create return items: ${errorText}`);
      }

      // 3. Update stock if return_type is 'stock'
      if (returnData.return_type === 'stock') {
        for (const item of returnData.items) {
          await fetch(
            `${supabaseUrl}/rest/v1/rpc/increment_stock`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                p_product_id: item.product_id,
                p_quantity: item.quantity
              })
            }
          );
        }
      }

      // 4. Update sale return_status
      const allItemsReturned = returnData.items.length === returnData.total_sale_items;
      await fetch(
        `${supabaseUrl}/rest/v1/sales?id=eq.${returnData.sale_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ return_status: allItemsReturned ? 'full' : 'partial' })
        }
      );

      console.log('✅ Return created:', returnRecord.id);
      return returnRecord;
    } catch (error) {
      console.error('Return creation error:', error);
      throw error;
    }
  },

  // Get all returns
  getAll: async (token) => {
    try {
      console.log('🔄 Fetching returns...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/returns?select=*,sales(total_amount,customer_id,customers(name)),return_items(*,products(name))&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch returns: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Returns fetched: ${data.length} items`);
      return data || [];
    } catch (error) {
      console.error('Fetch returns error:', error);
      throw error;
    }
  },

  // Get returns by sale ID
  getBySaleId: async (saleId, token) => {
    try {
      console.log('🔄 Fetching returns by sale ID:', saleId);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/returns?sale_id=eq.${saleId}&select=*,return_items(*,products(name))`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch returns: ${errorText}`);
      }
      
      const data = await response.json();
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
    try {
      console.log('💸 Fetching expenses...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses?apikey=${supabaseAnonKey}&select=*,category:expense_categories(id,name)&order=date.desc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch expenses: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Expenses fetched: ${data.length} items`);
      return data;
    } catch (error) {
      console.error('Expenses API getAll error:', error);
      throw error;
    }
  },
  
  async create(expenseData, token) {
    try {
      console.log('💸 Creating expense...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const expenseWithId = {
        ...expenseData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses?apikey=${supabaseAnonKey}`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(expenseWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Expense creation failed:', response.status, errorText);
        throw new Error(`Failed to create expense: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Expense created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Expenses API create error:', error);
      throw error;
    }
  },
  
  async update(id, expenseData, token) {
    try {
      console.log('✏️ Updating expense:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses?id=eq.${id}&apikey=${supabaseAnonKey}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(expenseData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Expense update failed:', response.status, errorText);
        throw new Error(`Failed to update expense: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Expense updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Expenses API update error:', error);
      throw error;
    }
  },
  
  async delete(id, token) {
    try {
      console.log('🗑️ Deleting expense:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expenses?id=eq.${id}&apikey=${supabaseAnonKey}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Expense deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete expense: ${errorText}`);
      }
      
      console.log('✅ Expense deleted');
    } catch (error) {
      console.error('Expenses API delete error:', error);
      throw error;
    }
  }
};

// Expense Categories API
export const expenseCategoriesAPI = {
  async getAll(token) {
    try {
      console.log('📁 Fetching expense categories...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expense_categories?select=*&order=name`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch expense categories: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Expense categories fetched: ${data.length} items`);
      return data;
    } catch (error) {
      console.error('Expense Categories API getAll error:', error);
      throw error;
    }
  },
  
  async create(categoryData, token) {
    try {
      console.log('📁 Creating expense category...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const categoryWithId = {
        ...categoryData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expense_categories`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(categoryWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Expense category creation failed:', response.status, errorText);
        throw new Error(`Failed to create expense category: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Expense category created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Expense Categories API create error:', error);
      throw error;
    }
  },
  
  async delete(id, token) {
    try {
      console.log('🗑️ Deleting expense category:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/expense_categories?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Expense category deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete expense category: ${errorText}`);
      }
      
      console.log('✅ Expense category deleted');
    } catch (error) {
      console.error('Expense Categories API delete error:', error);
      throw error;
    }
  }
};

// Attendance Machines API
export const attendanceMachinesAPI = {
  getAll: async (token) => {
    try {
      console.log('🧑‍💼 Fetching attendance machines...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/attendance_machines?select=*&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        // Check if table doesn't exist
        if (response.status === 404 || errorText.includes('42P01')) {
          console.warn('Attendance machines table does not exist yet');
          return [];
        }
        throw new Error(`Failed to get attendance machines: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ Attendance machines fetched: ${data.length} items`);
      return data || [];
    } catch (error) {
      console.error('Attendance machines API getAll error:', error);
      throw error;
    }
  },
  
  create: async (machineData, token) => {
    try {
      console.log('➕ Creating attendance machine...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const machineWithId = {
        ...machineData,
        id: crypto.randomUUID()
      };
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/attendance_machines`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(machineWithId)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Attendance machine creation failed:', response.status, errorText);
        throw new Error(`Failed to create attendance machine: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Attendance machine created:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Attendance machines API create error:', error);
      throw error;
    }
  },
  
  update: async (id, machineData, token) => {
    try {
      console.log('✏️ Updating attendance machine:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/attendance_machines?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(machineData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Attendance machine update failed:', response.status, errorText);
        throw new Error(`Failed to update attendance machine: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ Attendance machine updated:', data[0]);
      return data[0];
    } catch (error) {
      console.error('Attendance machines API update error:', error);
      throw error;
    }
  },
  
  delete: async (id, token) => {
    try {
      console.log('🗑️ Deleting attendance machine:', id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/attendance_machines?id=eq.${id}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Attendance machine deletion failed:', response.status, errorText);
        throw new Error(`Failed to delete attendance machine: ${errorText}`);
      }
      
      console.log('✅ Attendance machine deleted');
      return true;
    } catch (error) {
      console.error('Attendance machines API delete error:', error);
      throw error;
    }
  }
};;

// Profit Shares API
export const profitSharesAPI = {
  track: async (saleId, cart, authUser, token) => {
    try {
      console.log('💰 Tracking profit shares...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // 1. Resolve Employee ID
      const employeeResponse = await fetch(
        `${supabaseUrl}/rest/v1/employees?user_id=eq.${authUser.id}&select=id`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!employeeResponse.ok) {
        console.error('Error fetching employee record');
        return;
      }
      
      const employeeData = await employeeResponse.json();
      if (!employeeData || employeeData.length === 0) {
        console.log('No employee record found for user');
        return;
      }
      
      const currentEmployeeId = employeeData[0].id;
      
      // 2. Check Attendance
      const today = new Date().toISOString().split('T')[0];
      const attendanceResponse = await fetch(
        `${supabaseUrl}/rest/v1/employee_attendance?employee_id=eq.${currentEmployeeId}&attendance_date=eq.${today}&select=status`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!attendanceResponse.ok) {
        console.error('Error fetching attendance');
        return;
      }
      
      const attendanceData = await attendanceResponse.json();
      const attendance = attendanceData[0] || null;
      
      // Only apply profit share if present (or late/half_day)
      const isPresent = attendance && ['present', 'late', 'half_day'].includes(attendance.status);
      
      if (!isPresent) {
        console.log('Employee absent or no attendance record - skipping profit share');
        return;
      }
      
      // 3. Fetch all shares for this employee
      const sharesResponse = await fetch(
        `${supabaseUrl}/rest/v1/employee_product_shares?employee_id=eq.${currentEmployeeId}&select=product_id,share_type,share_value`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!sharesResponse.ok) {
        console.error('Error fetching employee shares');
        return;
      }
      
      const employeeShares = await sharesResponse.json();
      
      // 4. Process each cart item
      for (const item of cart) {
        const specificShare = employeeShares?.find(s => s.product_id === item.id);
        const globalShare = employeeShares?.find(s => s.product_id === null);
        const employeeShare = specificShare || globalShare;
        
        let shareConfig = null;
        
        if (employeeShare) {
          shareConfig = {
            enabled: true,
            type: employeeShare.share_type,
            value: employeeShare.share_value
          };
        } else if (item.profit_share_enabled) {
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
            shareAmount = (item.price * item.quantity * shareConfig.value) / 100;
          } else if (shareConfig.type === 'fixed') {
            shareAmount = shareConfig.value * item.quantity;
          }
          
          // Save profit share to database
          if (shareAmount > 0) {
            await fetch(
              `${supabaseUrl}/rest/v1/profit_shares`,
              {
                method: 'POST',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  id: crypto.randomUUID(),
                  sale_id: saleId,
                  employee_id: currentEmployeeId,
                  product_id: item.id,
                  quantity: item.quantity,
                  share_amount: shareAmount
                })
              }
            );
          }
        }
      }
      console.log('✅ Profit shares tracked');
    } catch (error) {
      console.error('Error tracking profit shares:', error);
      // Don't throw - this is a non-critical operation
    }
  }
};

// Store Settings API
export const storeSettingsAPI = {
  save: async (storeSettings, receiptSettings, generalSettings, userId, token) => {
    try {
      // Handle backward compatibility: if called with old signature (settingsObject, token)
      let actualStoreSettings = storeSettings;
      let actualReceiptSettings = receiptSettings || {};
      let actualGeneralSettings = generalSettings || {};
      let actualUserId = userId;
      let actualToken = token;
      
      // Check if this is the old calling pattern (settingsObject, token)
      if (typeof receiptSettings === 'string' && !generalSettings && !userId && !token) {
        // Old pattern: save(settingsObject, token)
        actualToken = receiptSettings;
        actualStoreSettings = storeSettings?.store || {};
        actualReceiptSettings = {};
        actualGeneralSettings = storeSettings?.general || {};
        actualUserId = null;
        
        // Extract receipt settings from the object if present
        if (storeSettings?.receipt_58mm) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt_58mm: storeSettings.receipt_58mm };
        }
        if (storeSettings?.receipt_80mm) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt_80mm: storeSettings.receipt_80mm };
        }
        if (storeSettings?.receipt_A4) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt_A4: storeSettings.receipt_A4 };
        }
        if (storeSettings?.receipt_delivery_note) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt_delivery_note: storeSettings.receipt_delivery_note };
        }
        if (storeSettings?.enabled_receipt_types) {
          actualReceiptSettings = { ...actualReceiptSettings, enabled_receipt_types: storeSettings.enabled_receipt_types };
        }
        if (storeSettings?.invoiceA4Design) {
          actualReceiptSettings = { ...actualReceiptSettings, invoiceA4Design: storeSettings.invoiceA4Design };
        }
        if (storeSettings?.deliveryNoteDesign) {
          actualReceiptSettings = { ...actualReceiptSettings, deliveryNoteDesign: storeSettings.deliveryNoteDesign };
        }
        if (storeSettings?.receipt58mmDesign) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt58mmDesign: storeSettings.receipt58mmDesign };
        }
        if (storeSettings?.receipt80mmDesign) {
          actualReceiptSettings = { ...actualReceiptSettings, receipt80mmDesign: storeSettings.receipt80mmDesign };
        }
      }
      
      // Use provided userId or try to get from token
      let ownerId = actualUserId;
      
      if (!ownerId && actualToken) {
        try {
          // Try to get user ID from token if not provided
          const { data: { user }, error } = await supabase.auth.getUser(actualToken);
          if (!error && user) {
            ownerId = user.id;
          }
        } catch (authError) {
          console.warn('Could not get user from token, using provided userId or fallback');
        }
      }
      
      // Fallback: try without token (might work if session is active)
      if (!ownerId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            ownerId = user.id;
          }
        } catch (fallbackError) {
          console.error('Could not get user ID:', fallbackError);
          throw new Error('User ID is required to save store settings');
        }
      }
      
      if (!ownerId) {
        throw new Error('User ID is required to save store settings');
      }
      
      // Save to localStorage for quick access
      if (actualStoreSettings && Object.keys(actualStoreSettings).length > 0) {
        localStorage.setItem(`idcashier_store_settings_${ownerId}`, JSON.stringify(actualStoreSettings));
      }
      
      if (actualReceiptSettings && Object.keys(actualReceiptSettings).length > 0) {
        // Save each receipt setting type separately
        Object.keys(actualReceiptSettings).forEach(key => {
          if (key.startsWith('receipt_') || key === 'enabled_receipt_types' || key.endsWith('Design')) {
            localStorage.setItem(`idcashier_${key}_settings_${ownerId}`, JSON.stringify(actualReceiptSettings[key]));
          } else {
            localStorage.setItem(`idcashier_receipt_settings_${ownerId}`, JSON.stringify(actualReceiptSettings));
          }
        });
      }
      
      if (actualGeneralSettings && Object.keys(actualGeneralSettings).length > 0) {
        localStorage.setItem(`idcashier_general_settings_${ownerId}`, JSON.stringify(actualGeneralSettings));
      }
      
      // Also save to database (app_settings table) for persistence across sessions/devices
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      try {
        // Build list of settings to upsert
        const settingsToUpsert = [];
        
        if (actualStoreSettings && Object.keys(actualStoreSettings).length > 0) {
          settingsToUpsert.push({ user_id: ownerId, setting_key: 'store', setting_value: actualStoreSettings });
        }
        
        if (actualGeneralSettings && Object.keys(actualGeneralSettings).length > 0) {
          settingsToUpsert.push({ user_id: ownerId, setting_key: 'general', setting_value: actualGeneralSettings });
        }
        
        // Add individual receipt settings
        if (actualReceiptSettings) {
          Object.keys(actualReceiptSettings).forEach(key => {
            if (actualReceiptSettings[key] && Object.keys(actualReceiptSettings[key]).length > 0) {
              settingsToUpsert.push({ user_id: ownerId, setting_key: key, setting_value: actualReceiptSettings[key] });
            }
          });
        }
        
        // Upsert each setting individually
        for (const setting of settingsToUpsert) {
          // First try to update existing
          const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/app_settings?user_id=eq.${ownerId}&setting_key=eq.${setting.setting_key}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${actualToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({ setting_value: setting.setting_value })
            }
          );
          
          // If no rows updated, insert new
          if (updateResponse.status === 200 || updateResponse.status === 204) {
            // Check if any rows were updated by trying a GET
            const checkResponse = await fetch(
              `${supabaseUrl}/rest/v1/app_settings?user_id=eq.${ownerId}&setting_key=eq.${setting.setting_key}&select=id`,
              {
                method: 'GET',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${actualToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (checkResponse.ok) {
              const existingData = await checkResponse.json();
              if (!existingData || existingData.length === 0) {
                // No existing record, insert new
                await fetch(
                  `${supabaseUrl}/rest/v1/app_settings`,
                  {
                    method: 'POST',
                    headers: {
                      'apikey': supabaseAnonKey,
                      'Authorization': `Bearer ${actualToken}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(setting)
                  }
                );
              }
            }
          }
        }
        
        console.log('[storeSettingsAPI] Settings saved to database');
      } catch (dbError) {
        console.warn('[storeSettingsAPI] Could not save to database, settings saved to localStorage only:', dbError);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Store settings save error:', error);
      throw error;
    }
  },
  
  load: async (token) => {
    try {
      let ownerId = null;
      
      if (token) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (!error && user) {
            ownerId = user.id;
          }
        } catch (authError) {
          console.warn('Could not get user from token');
        }
      }
      
      if (!ownerId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            ownerId = user.id;
          }
        } catch (fallbackError) {
          console.error('Could not get user ID:', fallbackError);
          return {
            storeSettings: {},
            receiptSettings: {},
            generalSettings: {}
          };
        }
      }
      
      if (!ownerId) {
        return {
          storeSettings: {},
          receiptSettings: {},
          generalSettings: {}
        };
      }
      
      // First try to load from database (app_settings table)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      let dbSettings = {};
      let loadedFromDb = false;
      
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/app_settings?user_id=eq.${ownerId}&select=setting_key,setting_value`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            loadedFromDb = true;
            // Convert array of settings to object
            for (const setting of data) {
              dbSettings[setting.setting_key] = setting.setting_value;
            }
            console.log('[storeSettingsAPI] Loaded settings from database:', Object.keys(dbSettings));
          }
        }
      } catch (dbError) {
        console.warn('[storeSettingsAPI] Could not load from database, falling back to localStorage:', dbError);
      }
      
      // If loaded from database, also sync to localStorage for faster access
      if (loadedFromDb) {
        if (dbSettings.store) {
          localStorage.setItem(`idcashier_store_settings_${ownerId}`, JSON.stringify(dbSettings.store));
        }
        if (dbSettings.general) {
          localStorage.setItem(`idcashier_general_settings_${ownerId}`, JSON.stringify(dbSettings.general));
        }
        if (dbSettings.receipt_58mm) {
          localStorage.setItem(`idcashier_receipt_58mm_settings_${ownerId}`, JSON.stringify(dbSettings.receipt_58mm));
        }
        if (dbSettings.receipt_80mm) {
          localStorage.setItem(`idcashier_receipt_80mm_settings_${ownerId}`, JSON.stringify(dbSettings.receipt_80mm));
        }
        if (dbSettings.receipt_A4) {
          localStorage.setItem(`idcashier_receipt_A4_settings_${ownerId}`, JSON.stringify(dbSettings.receipt_A4));
        }
        if (dbSettings.receipt_delivery_note) {
          localStorage.setItem(`idcashier_receipt_delivery_note_settings_${ownerId}`, JSON.stringify(dbSettings.receipt_delivery_note));
        }
        if (dbSettings.enabled_receipt_types) {
          localStorage.setItem(`idcashier_enabled_receipt_types_${ownerId}`, JSON.stringify(dbSettings.enabled_receipt_types));
        }
        if (dbSettings.invoiceA4Design) {
          localStorage.setItem(`idcashier_invoice_a4_design_${ownerId}`, JSON.stringify(dbSettings.invoiceA4Design));
        }
        if (dbSettings.deliveryNoteDesign) {
          localStorage.setItem(`idcashier_delivery_note_design_${ownerId}`, JSON.stringify(dbSettings.deliveryNoteDesign));
        }
        
        return {
          store: dbSettings.store || {},
          storeSettings: dbSettings.store || {},
          general: dbSettings.general || {},
          generalSettings: dbSettings.general || {},
          receipt_58mm: dbSettings.receipt_58mm || null,
          receipt_80mm: dbSettings.receipt_80mm || null,
          receipt_A4: dbSettings.receipt_A4 || null,
          receipt_delivery_note: dbSettings.receipt_delivery_note || null,
          enabled_receipt_types: dbSettings.enabled_receipt_types || null,
          invoiceA4Design: dbSettings.invoiceA4Design || null,
          deliveryNoteDesign: dbSettings.deliveryNoteDesign || null
        };
      }
      
      // Fallback to localStorage if database load failed or returned no data
      const storeSettingsRaw = localStorage.getItem(`idcashier_store_settings_${ownerId}`);
      const receiptSettingsRaw = localStorage.getItem(`idcashier_receipt_settings_${ownerId}`);
      const generalSettingsRaw = localStorage.getItem(`idcashier_general_settings_${ownerId}`);
      
      // Parse store settings
      let storeSettingsParsed = {};
      if (storeSettingsRaw) {
        try {
          storeSettingsParsed = JSON.parse(storeSettingsRaw);
        } catch (e) {
          console.error('Error parsing store settings:', e);
        }
      }
      
      // Parse receipt settings
      let receiptSettingsParsed = {};
      if (receiptSettingsRaw) {
        try {
          receiptSettingsParsed = JSON.parse(receiptSettingsRaw);
        } catch (e) {
          console.error('Error parsing receipt settings:', e);
        }
      }
      
      // Parse general settings
      let generalSettingsParsed = {};
      if (generalSettingsRaw) {
        try {
          generalSettingsParsed = JSON.parse(generalSettingsRaw);
        } catch (e) {
          console.error('Error parsing general settings:', e);
        }
      }
      
      // Load individual receipt type settings
      const receipt58mm = localStorage.getItem(`idcashier_receipt_58mm_settings_${ownerId}`);
      const receipt80mm = localStorage.getItem(`idcashier_receipt_80mm_settings_${ownerId}`);
      const receiptA4 = localStorage.getItem(`idcashier_receipt_A4_settings_${ownerId}`);
      const receiptDeliveryNote = localStorage.getItem(`idcashier_receipt_delivery_note_settings_${ownerId}`);
      const enabledReceiptTypes = localStorage.getItem(`idcashier_enabled_receipt_types_${ownerId}`);
      
      return {
        // Return store settings in the format expected by SettingsPage
        store: storeSettingsParsed,
        storeSettings: storeSettingsParsed, // Keep for backward compatibility
        receiptSettings: receiptSettingsParsed,
        general: generalSettingsParsed,
        generalSettings: generalSettingsParsed,
        // Individual receipt type settings
        receipt_58mm: receipt58mm ? JSON.parse(receipt58mm) : null,
        receipt_80mm: receipt80mm ? JSON.parse(receipt80mm) : null,
        receipt_A4: receiptA4 ? JSON.parse(receiptA4) : null,
        receipt_delivery_note: receiptDeliveryNote ? JSON.parse(receiptDeliveryNote) : null,
        enabled_receipt_types: enabledReceiptTypes ? JSON.parse(enabledReceiptTypes) : null
      };
    } catch (error) {
      console.error('Store settings load error:', error);
      throw error;
    }
  }
};
