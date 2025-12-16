import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '@/lib/api';
import { supabase, testSupabaseConnection, withRetry } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
   const [user, setUser] = useState(null);
   const [loading, setLoading] = useState(true);
   const [token, setToken] = useState(null);
   const [connectionError, setConnectionError] = useState(null);
   const [isOffline, setIsOffline] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing Auth...');
        console.time('AuthInit');
        
        // FAST PATH: Check localStorage first for quick initialization
        const storedToken = localStorage.getItem('idcashier_token');
        
        // 1. Get session from Supabase with SHORT timeout (5s instead of 15s)
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null, timedOut: true }), 5000)
        );

        const sessionResult = await Promise.race([getSessionPromise, timeoutPromise]);
        
        if (sessionResult.timedOut) {
          console.warn('⚠️ getSession timed out (5s), using stored token if available');
          // If we have a stored token, use it directly without waiting for Supabase
          if (storedToken && mounted) {
            setToken(storedToken);
            // Try to get user profile in background
            fetchUserProfileFast(storedToken, mounted, setUser);
          }
          if (mounted) setLoading(false);
          console.timeEnd('AuthInit');
          return;
        }

        const { data: { session }, error } = sessionResult;
        
        if (error) {
          console.error('Session error:', error.message);
          if (mounted) {
             setToken(null);
             setUser(null);
             localStorage.removeItem('idcashier_token');
             localStorage.removeItem('idcashier_refresh_token');
             localStorage.removeItem('sb-eypfeiqtvfxxiimhtycc-auth-token');
          }
          if (mounted) setLoading(false);
          console.timeEnd('AuthInit');
          return;
        }

        if (session) {
          console.log('✅ Session found from Supabase client');
          if (mounted) {
             setToken(session.access_token);
             localStorage.setItem('idcashier_token', session.access_token);
          }
          
          // Fetch User Profile with timeout
          await fetchUserProfileFast(session.access_token, mounted, setUser, session.user);

        } else {
          console.log('ℹ️ No active session found');
          const legacyToken = localStorage.getItem('idcashier_token');
          if (legacyToken) {
             console.warn('Found legacy token but no session. Cleaning up.');
             localStorage.removeItem('idcashier_token');
             localStorage.removeItem('idcashier_refresh_token');
             localStorage.removeItem('sb-eypfeiqtvfxxiimhtycc-auth-token');
          }
        }

      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
        console.timeEnd('AuthInit');
      }
    };

    // Fast user profile fetch with 3s timeout
    const fetchUserProfileFast = async (token, mounted, setUserFn, authUser = null) => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // If we have authUser email, use it; otherwise decode from token
        let email = authUser?.email;
        if (!email && token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            email = payload.email;
          } catch (e) {
            console.warn('Could not decode token for email');
          }
        }
        
        if (!email) return;
        
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=id,name,email,role,tenant_id,permissions,created_at`,
          {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0 && mounted) {
            const userData = data[0];
            const userWithTenantId = {
              ...userData,
              email_confirmed_at: authUser?.email_confirmed_at,
              user_metadata: authUser?.user_metadata,
              tenantId: userData.tenant_id || userData.tenantId
            };
            setUserFn(userWithTenantId);
            console.log('✅ User profile loaded');
          }
        }
      } catch (profileError) {
        if (profileError.name !== 'AbortError') {
          console.error('Failed to load user profile:', profileError);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen to Supabase Auth State Changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setToken(session.access_token);
          localStorage.setItem('idcashier_token', session.access_token);
          if (session.refresh_token) {
            localStorage.setItem('idcashier_refresh_token', session.refresh_token);
          }
          
          try {
            await fetchUserProfile(session.access_token, session.user);
          } catch (err) {
             console.error("Error fetching user details on auth change:", err);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setToken(null);
        setUser(null);
        localStorage.removeItem('idcashier_token');
        localStorage.removeItem('idcashier_refresh_token');
        localStorage.removeItem('idcashier_current_page');
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event received');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Separate function for fetching user profile
  const fetchUserProfile = async (accessToken, authUser) => {
    try {
      let userData;
      try {
          const { data, error } = await supabase
            .from('users')
            .select('id, name, email, role, tenant_id, permissions, created_at')
            .eq('email', authUser.email)
            .single()
            .setHeader('Authorization', `Bearer ${accessToken}`);
          
          if (error) throw error;
          userData = data;
      } catch (singleError) {
          if (singleError.code === 'PGRST116') {
              const { data: arrayData } = await supabase
                  .from('users')
                  .select('id, name, email, role, tenant_id, permissions, created_at')
                  .eq('email', authUser.email)
                  .setHeader('Authorization', `Bearer ${accessToken}`);
              if (arrayData && arrayData.length > 0) userData = arrayData[0];
          } else {
              throw singleError;
          }
      }

      if (userData) {
          const userWithTenantId = {
              ...userData,
              email_confirmed_at: authUser.email_confirmed_at,
              user_metadata: authUser.user_metadata,
              tenantId: userData.tenant_id || userData.tenantId
          };
          setUser(userWithTenantId);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      // Don't throw here to avoid breaking the auth flow
    }
  };

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    const checkTokenExpiry = async () => {
      if (!isMounted || !token) return;
      
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Refresh token if it expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          console.log('Token expires soon, refreshing...');
          const { data, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.error('Token refresh failed:', error);
            if (isMounted) {
              // If refresh fails, logout user
              await logout();
            }
          } else if (data.session && isMounted) {
            console.log('Token refreshed successfully');
            setToken(data.session.access_token);
            localStorage.setItem('idcashier_token', data.session.access_token);
          }
        }
      } catch (err) {
        console.error('Error checking token expiry:', err);
      }
    };

    // Check immediately and then every minute
    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]); // Remove logout dependency to avoid circular dependency

  const login = async (email, password) => {
    try {
      console.log('🔐 AuthContext: Starting login process');
      const result = await authAPI.login(email, password);
      console.log('📦 AuthContext: Login API result:', { 
        hasToken: !!result.token, 
        hasUser: !!result.user,
        hasError: !!result.error,
        keys: Object.keys(result)
      });
      
      // Check for subscription expired error
      if (result.error && result.subscriptionExpired) {
        console.warn('⚠️ Subscription expired');
        return {
          success: false,
          error: result.error,
          subscriptionExpired: true
        };
      }
      
      // The edge function now returns token directly, no need for session fallback
      if (result.token && result.user) {
        console.log('✅ Login successful, setting user and token');
        setToken(result.token);
        // Ensure tenantId is properly set
        const userWithTenantId = {
          ...result.user,
          tenantId: result.user.tenant_id || result.user.tenantId
        };
        setUser(userWithTenantId);
        localStorage.setItem('idcashier_token', result.token);
        if (result.refreshToken) {
          localStorage.setItem('idcashier_refresh_token', result.refreshToken);
        }
        // Clean up current page from localStorage to ensure user starts on dashboard
        localStorage.removeItem('idcashier_current_page');
        console.log('✅ AuthContext: Login complete, returning success');
        return { success: true, user: userWithTenantId };
      } else {
        console.error('❌ Invalid response from server:', result);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      // Log error detail for debugging
      console.error("❌ Login failed:", error);
      
      // Log whether error is from network or server
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log("Login error source: Network connectivity issue");
      } else {
        console.log("Login error source: Server response or client-side validation");
      }
      
      // Ensure error message is useful and provide fallback if undefined
      let errorMessage = 'Login failed. Please try again.';
      if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        errorMessage = error.message;
      } else if (error && typeof error === 'string') {
        errorMessage = error;
      }
      
      // For network errors, suggest retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.log("Suggestion: Check network connection and retry login");
        errorMessage += " Please check your connection and try again.";
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = useCallback(async () => {
    try {
        console.log('Logging out...');
        setToken(null);
        setUser(null);
        localStorage.removeItem('idcashier_token');
        localStorage.removeItem('idcashier_refresh_token');
        localStorage.removeItem('sb-eypfeiqtvfxxiimhtycc-auth-token');
        // Clean up current page from localStorage on logout
        localStorage.removeItem('idcashier_current_page');
        
        // Also sign out from Supabase to clear session
        // Await to ensure cleanup before redirecting (if awaited by caller)
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
        // Ensure local state is cleared even if Supabase errors
        setToken(null);
        setUser(null);
        localStorage.removeItem('idcashier_token');
        localStorage.removeItem('idcashier_refresh_token');
        localStorage.removeItem('sb-eypfeiqtvfxxiimhtycc-auth-token');
    }
  }, []);

  const loginWithToken = async (token, userData, session = null) => {
    setToken(token);
    const userWithTenantId = {
      ...userData,
      tenantId: userData.tenant_id || userData.tenantId,
      email_confirmed_at: userData.email_confirmed_at,
      user_metadata: userData.user_metadata
    };
    setUser(userWithTenantId);
    localStorage.setItem('idcashier_token', token);
    localStorage.removeItem('idcashier_current_page');

    // Set Supabase session if provided (non-blocking to prevent UI hang)
    if (session) {
      supabase.auth.setSession(session).catch(error => {
        console.error('Failed to set Supabase session:', error);
      });
    }

    return true;
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUserData
    }));
  };

  const value = {
    user,
    token,
    login,
    logout,
    loginWithToken,
    updateUser,
    isAuthenticated: !!user,
    loading,
    connectionError,
    isOffline,
    retryConnection: async () => {
      setConnectionError(null);
      setIsOffline(false);
      // Re-run initialization
      const storedToken = localStorage.getItem('idcashier_token');
      if (storedToken) {
        try {
          const isConnected = await testSupabaseConnection();
          if (isConnected) {
            // Re-initialize auth
            window.location.reload();
          } else {
            setConnectionError('Koneksi masih bermasalah. Silakan periksa koneksi internet Anda.');
            setIsOffline(true);
          }
        } catch (error) {
          setConnectionError('Gagal menghubungkan kembali. Silakan coba lagi nanti.');
          setIsOffline(true);
        }
      }
    },
  };

  // Comment 2: Provide clearer feedback when loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {connectionError ? 'Mencoba menghubungkan kembali...' : 'Memuat sesi pengguna...'}
          </p>
          {connectionError && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md">
              <p className="text-sm text-yellow-800 mb-2">{connectionError}</p>
              <button
                onClick={value.retryConnection}
                className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
