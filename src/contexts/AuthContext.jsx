// Improved authentication context with better token expiry handling
// Fixes timezone issues and race conditions

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '@/lib/api';
import { supabase, testSupabaseConnection, withRetry } from '@/lib/supabaseClient';
import { usePayment } from '@/contexts/PaymentContext';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const { openPaymentModal } = usePayment();
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
            // Security: Use dynamic project ref from environment instead of hardcoded
            const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
            if (projectRef) {
              localStorage.removeItem(`sb-${projectRef}-auth-token`);
            }
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


          // Conflicting with AuthCallbackPage - disabling this to prevent race condition where 
          // localStorage is cleared before AuthCallbackPage can read it.
          // handleOAuthPaymentRedirect(session.access_token);
        }
      } else if (event === 'SIGNED_OUT') {
        // Only clear if not already cleared to avoid loops/redundant updates
        if (token || user) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('idcashier_token');
          localStorage.removeItem('idcashier_refresh_token');
          localStorage.removeItem('idcashier_current_page');
        }
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
  const login = async (email, password, isOAuth = false) => {
    try {
      console.log('🔐 AuthContext: Starting login process', { isOAuth });

      // For OAuth users, we need to get the session from Supabase directly
      if (isOAuth) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          throw new Error(sessionError?.message || 'No session found');
        }

        // Get user profile
        const token = session.access_token;
        const userProfile = await authAPI.getCurrentUser(token);

        if (userProfile) {
          setToken(token);
          setUser(userProfile);
          localStorage.setItem('idcashier_token', token);
          return { success: true, user: userProfile, token };
        } else {
          throw new Error('User profile not found');
        }
      }

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

      // Price-card payment pending
      if (result.error && result.paymentPending) {
        console.warn('💳 Payment pending');
        return {
          success: false,
          error: result.error,
          paymentPending: true
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
        return { success: true, user: userWithTenantId, token: result.token };
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
    }
  };

  // Enhanced logout with cleanup - stable reference
  const logoutRef = React.useRef(null);

  // Create stable logout function
  const logout = React.useCallback(async () => {
    try {
      console.log('Logging out...');

      // Clear state first (synchronous)
      setToken(null);
      setUser(null);

      // Clear localStorage
      localStorage.removeItem('idcashier_token');
      localStorage.removeItem('idcashier_refresh_token');
      localStorage.removeItem('idcashier_current_page');

      // Clear project-specific storage
      const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (projectRef) {
        localStorage.removeItem(`sb-${projectRef}-auth-token`);
        localStorage.removeItem(`sb-${projectRef}-auth-token-expires-at`);
        localStorage.removeItem(`sb-${projectRef}-refresh-token`);
      }

      // Sign out from Supabase (fire and forget, don't wait)
      supabase.auth.signOut().then(({ error }) => {
        if (error) {
          console.warn('Supabase signOut error:', error.message);
        } else {
          console.log('Supabase signed out successfully');
        }
      });

      console.log('✅ Logout completed');
    } catch (error) {
      console.error('Logout critical error:', error);
      // Force clear state even on error
      setToken(null);
      setUser(null);
    }
  }, []);

  // Fast user profile fetch with timeout
  const fetchUserProfileFast = async (token, mounted, setUserFn, authUser = null) => {
    try {
      console.log('🔍 DEBUG: Starting fetchUserProfileFast');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('🔍 DEBUG: Environment variables:', {
        supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
        supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
        token: token ? 'SET' : 'MISSING'
      });

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Missing Supabase environment variables');
        return;
      }

      if (!token) {
        console.error('❌ No token provided for user profile fetch');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Get email from authUser or decode from token
      let email = authUser?.email;
      if (!email && token) {
        try {
          const parsedToken = parseTokenWithTimezone(token);
          email = parsedToken?.email;
          console.log('🔍 DEBUG: Decoded email from token:', email);
        } catch (e) {
          console.warn('Could not decode token for email');
        }
      }

      if (!email) {
        console.error('❌ No email found for user profile fetch');
        return;
      }

      console.log('🔍 DEBUG: Making fetch request to Supabase...');

      // CRITICAL: Add API key to URL parameter to ensure it's always present
      const urlParams = new URLSearchParams({
        'apikey': supabaseAnonKey, // API key MUST be in URL
        'email': `eq.${email}`,
        'select': 'id,name,email,role,tenant_id,permissions,created_at'
      });
      const urlWithApiKey = `${supabaseUrl}/rest/v1/users?${urlParams.toString()}`;

      console.log('🔑 API key in URL:', supabaseAnonKey ? 'YES' : 'NO');

      const response = await fetch(urlWithApiKey, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('🔍 DEBUG: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 DEBUG: User data received:', data);

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
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch user profile:', response.status, errorText);
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
      // Use direct REST API call to ensure API key is always included
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // CRITICAL: Add API key to URL parameter
      const urlParams = new URLSearchParams({
        'apikey': supabaseAnonKey, // API key MUST be in URL
        'email': `eq.${authUser.email}`,
        'select': 'id,name,email,role,tenant_id,permissions,created_at'
      });
      const urlWithApiKey = `${supabaseUrl}/rest/v1/users?${urlParams.toString()}`;

      console.log('🔍 Fetching user profile via direct API (fetchUserProfile)...');

      const response = await fetch(urlWithApiKey, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user profile: ${response.status} ${errorText}`);
      }

      const userArray = await response.json();
      let userData;

      if (!Array.isArray(userArray) || userArray.length === 0) {
        console.warn('⚠️ User authenticated but not found in public.users. Attempting recovery via auth-register...');

        // Recovery strategy:
        // 1) Call auth-register to sync OAuth user into public.users (id/email).
        // 2) Wait briefly for DB propagation.
        // 3) Retry fetching profile once.
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          if (supabaseUrl && supabaseAnonKey && authUser?.id && authUser?.email) {
            const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/auth-register`;
            const requestBody = {
              name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
              email: authUser.email,
              password: null,
              role: 'owner',
              oauthProvider: 'google',
              oauthUserId: authUser.id,
              paymentCompleted: false,
              // Not necessarily price card here; we just want to ensure profile exists.
              isPriceCardRegistration: false,
              skipTrial: true
            };

            const regRes = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey
              },
              body: JSON.stringify(requestBody)
            });

            const regJson = await regRes.clone().json().catch(() => ({}));
            console.log('📩 AuthContext recovery auth-register:', { status: regRes.status, body: regJson });

            // Small delay to let DB insert commit
            await new Promise(r => setTimeout(r, 800));

            // Retry fetch once
            const retryResponse = await fetch(urlWithApiKey, {
              method: 'GET',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });

            if (retryResponse.ok) {
              const retryArray = await retryResponse.json();
              if (Array.isArray(retryArray) && retryArray.length > 0) {
                userData = retryArray[0];
              }
            }
          }
        } catch (recoveryError) {
          console.warn('AuthContext recovery failed:', recoveryError);
        }

        // If still no user profile, do NOT signOut immediately.
        // Let AuthCallbackPage/payment flows handle registration.
        if (!userData) {
          console.warn('⚠️ Profile still missing after recovery attempt. Keeping session (no auto-signOut).');
          return;
        }
      }

      if (!userData) {
        userData = userArray[0];
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
      // If user not found, logout to prevent orphaned sessions
      if (err.message?.includes('User not found')) {
        console.warn('⚠️ Logging out due to missing user profile');
        await supabase.auth.signOut();
        setToken(null);
        setUser(null);
      }
      // Don't throw here to avoid breaking the auth flow
    }
  };

  const handleOAuthPaymentRedirect = async (accessToken) => {
    const pendingPlanJSON = localStorage.getItem('pendingOAuthPlan');
    if (!pendingPlanJSON) {
      return; // No pending plan, so do nothing
    }

    localStorage.removeItem('pendingOAuthPlan'); // Clear it immediately
    const planDetails = JSON.parse(pendingPlanJSON);
    console.log('💳 Handling OAuth payment redirect for plan:', planDetails);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser(accessToken);
      if (!authUser) throw new Error('Could not retrieve user after OAuth.');

      openPaymentModal({
        amount: planDetails.planPrice,
        onSelect: async (paymentMethod) => {
          try {
            const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                paymentAmount: parseInt(planDetails.planPrice, 10),
                productDetails: planDetails.planName,
                customerVaName: authUser.user_metadata?.name || authUser.email,
                email: authUser.email,
                userId: authUser.id,
                paymentMethod: paymentMethod,
                isRegistration: true,
              }),
            });

            const paymentData = await paymentResponse.json();
            if (!paymentResponse.ok) throw new Error(paymentData.error || 'Payment request failed');

            if (paymentData.paymentUrl) {
              const duration = planDetails.planDuration ? parseInt(planDetails.planDuration, 10) : 1;
              localStorage.setItem('pendingRegistration', JSON.stringify({
                name: authUser.user_metadata?.name || authUser.email,
                email: authUser.email,
                planDuration: duration,
                merchantOrderId: paymentData.merchantOrderId,
                role: 'owner',
              }));
              window.location.href = paymentData.paymentUrl;
            } else {
              throw new Error('Payment URL not received from Duitku');
            }
          } catch (error) {
            console.error('❌ OAuth Payment Redirect Error:', error);
          }
        },
      });
    } catch (error) {
      console.error('❌ OAuth Payment Redirect Error:', error);
      // Optionally, show a toast message to the user
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
    refreshSession: () => supabase.auth.refreshSession(),
    isAuthenticated: !!user,
    verifyEmail: async (email, token) => {
      try {
        console.log('🔍 AuthContext: Verifying email:', email);
        const result = await authAPI.verifyEmail(email, token);

        if (result.success) {
          console.log('✅ Email verification successful');
          // After successful verification, refresh user data
          if (token) {
            try {
              const { data: { user: authUser } } = await supabase.auth.getUser(token);
              if (authUser) {
                await fetchUserProfile(token, authUser);
              }
            } catch (err) {
              console.warn('Error refreshing user data after verification:', err);
            }
          }
        }

        return result;
      } catch (error) {
        console.error('❌ AuthContext: Email verification failed:', error);
        throw error;
      }
    },
    resendVerification: async (email) => {
      try {
        console.log('📧 AuthContext: Resending verification email:', email);
        const result = await authAPI.resendVerification(email);
        return result;
      } catch (error) {
        console.error('❌ AuthContext: Resend verification failed:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
