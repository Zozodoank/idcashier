// Improved authentication context with better token expiry handling
// Fixes timezone issues and race conditions

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

  // Fixed: Better token parsing with timezone awareness
  const parseTokenWithTimezone = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Convert exp to proper UTC timestamp and handle timezone
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const utcOffset = new Date().getTimezoneOffset() * 60 * 1000; // Convert to milliseconds
      
      // Adjust for timezone difference
      const adjustedCurrentTime = currentTime + utcOffset;
      const timeUntilExpiry = expiryTime - adjustedCurrentTime;
      
      return {
        ...payload,
        expiryTime,
        currentTime: adjustedCurrentTime,
        timeUntilExpiry,
        isExpired: timeUntilExpiry <= 0,
        expiresInMinutes: Math.ceil(timeUntilExpiry / (60 * 1000))
      };
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  };

  // Initialize auth state from localStorage
  useEffect(() => { 
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🚀 Initializing auth...');
        console.time('AuthInit');
        
        // Check localStorage first for quick initialization
        const storedToken = localStorage.getItem('idcashier_token');
        
        // 1. Get session from Supabase with timeout
        const getSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ 
            data: { session: null, error: null, timedOut: true }, 
            error: null 
          }), 5000)
        );

        const sessionResult = await Promise.race([getSessionPromise, timeoutPromise]);

        if (sessionResult.error) {
          console.error('Session error:', sessionResult.error.message);
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

        if (sessionResult.data?.session) {
          console.log('✅ Session found from Supabase client');
          const session = sessionResult.data.session;
          
          if (mounted) {
            setToken(session.access_token);
            localStorage.setItem('idcashier_token', session.access_token);
          }

          // Parse token with timezone awareness
          const parsedToken = parseTokenWithTimezone(session.access_token);
          if (parsedToken?.isExpired) {
            console.warn('⚠️ Stored token is expired, will attempt refresh');
          }

          // Fetch user profile with timeout
          await fetchUserProfileFast(session.access_token, mounted, setUser, session.user);
        } else if (storedToken) {
          console.log('ℹ️ No active session found, using stored token');
          
          // Validate stored token
          const parsedStoredToken = parseTokenWithTimezone(storedToken);
          if (parsedStoredToken?.isExpired) {
            console.warn('⚠️ Stored token expired, clearing...');
            localStorage.removeItem('idcashier_token');
            localStorage.removeItem('idcashier_refresh_token');
          } else if (mounted) {
            setToken(storedToken);
            await fetchUserProfileFast(storedToken, mounted, setUser);
          }
        } else {
          console.log('ℹ️ No stored token found');
        }

      } catch (err) {
        console.error('Auth initialization error:', err);
        setConnectionError('Failed to initialize authentication');
      } finally { 
        if (mounted) setLoading(false);
        console.timeEnd('AuthInit');
      }
    };

    initializeAuth();

    return () => { 
      mounted = false;
    };
  }, []);

  // Enhanced auth state change listener with better handling
  useEffect(() => { 
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {  
      console.log('Auth state changed:', event, !!session);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session && session.access_token) {
          // Parse new token
          const parsedToken = parseTokenWithTimezone(session.access_token);
          
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
      } else if (event === 'USER_UPDATED') {
        console.log('User updated event received');
        // Refresh user data when user metadata is updated
        if (session?.access_token) {
          await fetchUserProfile(session.access_token, session.user);
        }
      }
    });

    return () => {  
      subscription.unsubscribe();
    };
  }, []);

  // Enhanced auto-refresh with better error handling and timezone awareness
  useEffect(() => { 
    if (!token) return;

    let isMounted = true;
    let refreshInterval = null;

    const checkTokenExpiry = async () => { 
      if (!isMounted || !token) return; 

      try {
        const parsedToken = parseTokenWithTimezone(token);
        
        if (!parsedToken) {
          console.error('Failed to parse token for expiry check');
          return;
        }

        console.log(`Token expires in ${parsedToken.expiresInMinutes} minutes`);
        
        // Refresh token if it expires in less than 10 minutes (increased from 5)
        if (parsedToken.timeUntilExpiry < 10 * 60 * 1000 && parsedToken.timeUntilExpiry > 0) {
          console.log('Token expires soon, refreshing...');
          
          try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.error('Token refresh failed:', error);
              
              // If refresh fails due to expired refresh token, logout user
              if (error.message?.includes('refresh_token_not_found') || 
                  error.message?.includes('expired')) {
                console.warn('Refresh token expired, logging out user');
                if (isMounted) {
                  await logout();
                }
                return;
              }
            } else if (data?.session && isMounted) {
              console.log('Token refreshed successfully');
              setToken(data.session.access_token);
              localStorage.setItem('idcashier_token', data.session.access_token);
              
              if (data.session.refresh_token) {
                localStorage.setItem('idcashier_refresh_token', data.session.refresh_token);
              }
            }
          } catch (refreshError) {
            console.error('Token refresh error:', refreshError);
          }
        } else if (parsedToken.isExpired) {
          console.warn('Token is already expired, attempting refresh');
          
          try {
            const { data, error } = await supabase.auth.refreshSession();
            
            if (error) {
              console.error('Expired token refresh failed:', error);
              if (isMounted) {
                await logout();
              }
            }
          } catch (err) {
            console.error('Expired token refresh error:', err);
            if (isMounted) {
              await logout();
            }
          }
        }
      } catch (err) {
        console.error('Error checking token expiry:', err);
      }
    };

    // Check immediately and then every 2 minutes (increased frequency)
    checkTokenExpiry();
    refreshInterval = setInterval(checkTokenExpiry, 2 * 60 * 1000);

    return () => {  
      isMounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [token]); // Removed logout dependency to avoid circular dependency

  // Enhanced login function with better error handling
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

      if (result.token && result.user) {
        console.log('✅ Login successful, setting user and token');
        
        // Validate token before setting
        const parsedToken = parseTokenWithTimezone(result.token);
        if (!parsedToken) {
          throw new Error('Invalid token received from server');
        }
        
        setToken(result.token);
        
        // Ensure tenantId is properly set
        const userWithTenantId = {      
          ...result.user,
          tenantId: result.user.tenant_id || result.user.tenantId,
          tokenExpiry: parsedToken.expiryTime,
          expiresInMinutes: parsedToken.expiresInMinutes
        };
        
        setUser(userWithTenantId);      
        localStorage.setItem('idcashier_token', result.token);
        
        if (result.refreshToken) {      
          localStorage.setItem('idcashier_refresh_token', result.refreshToken);
        }
        
        // Clean up current page to ensure user starts on dashboard
        localStorage.removeItem('idcashier_current_page');  
        
        console.log('✅ AuthContext: Login complete, returning success');      
        return { success: true, user: userWithTenantId };   
      } else {      
        console.error('❌ Invalid response from server:', result);
        throw new Error('Invalid response from server');    
      }
    } catch (error) {
      console.error("❌ Login failed:", error);

      // Enhanced error handling with network awareness
      if (error instanceof TypeError && error.message.includes('fetch')) {      
        console.log("Login error source: Network connectivity issue");
        setConnectionError('Network connection failed. Please check your connection.');
      } else if (error.message?.includes('Invalid token')) {
        console.log("Login error source: Invalid token from server");
        setConnectionError('Authentication token invalid. Please try again.');
      } else {      
        console.log("Login error source: Server response or client-side validation");
        setConnectionError(null); // Clear connection error for server-side errors
      }

      // Ensure error message is useful
      let errorMessage = 'Login failed. Please try again.';
      
      if (error && typeof error.message === 'string' && error.message.trim() !== '') {
        errorMessage = error.message;
      } else if (error && typeof error === 'string') {
        errorMessage = error;
      }

      return { success: false, error: errorMessage, connectionError: connectionError };       
    refreshSession: () => supabase.auth.refreshSession(),
    isAuthenticated: !!user,
    isAuthenticated: !!user
    }
  };

  // Enhanced logout with cleanup
  const logout = useCallback(async () => {
    try {
      console.log('Logging out...');  
      
      setToken(null);
      setUser(null);
      localStorage.removeItem('idcashier_token');
      localStorage.removeItem('idcashier_refresh_token');
      localStorage.removeItem('sb-eypfeiqtvfxxiimhtycc-auth-token');
      localStorage.removeItem('idcashier_current_page');

      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure local state is cleared even if Supabase errors
      setToken(null);
      setUser(null);
      localStorage.removeItem('idcashier_token');
      localStorage.removeItem('idcashier_refresh_token');
    }
  }, []);

  // Fast user profile fetch with timeout
  const fetchUserProfileFast = async (token, mounted, setUserFn, authUser = null) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Get email from authUser or decode from token
      let email = authUser?.email;
      if (!email && token) {
        try {     
          const parsedToken = parseTokenWithTimezone(token);
          email = parsedToken?.email;
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

  const value = {
    user,
    token,
    loading,
    connectionError,
    isOffline,
    login,
    logout,
    refreshSession: () => supabase.auth.refreshSession()
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};