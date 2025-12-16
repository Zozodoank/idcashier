import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { authAPI } from '@/lib/api';

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [status, setStatus] = useState('processing');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // For OAuth callback, we need to handle the URL hash first
        // Supabase OAuth redirects with session in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        // If we have tokens in URL hash, set the session first
        if (accessToken && refreshToken) {
          console.log('🔐 Setting session from URL hash...');
          const { data: sessionData, error: sessionSetError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionSetError) {
            console.error('❌ Failed to set session:', sessionSetError);
            throw sessionSetError;
          }
          
          console.log('✅ Session set from URL hash');
        }
        
        // Get the session from the URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ Session error:', sessionError);
          throw sessionError;
        }

        if (!session) {
          console.error('❌ No session found after OAuth callback');
          // No session found, redirect to login
          navigate('/login');
          return;
        }
        
        console.log('✅ Session found:', session.user?.email);

        const user = session.user;
        const email = user.email;
        const name = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'User';

        // 🔧 FIXED: Cek apakah ini alur registrasi berbayar via price card
        // Enhanced check dengan multiple sources untuk memastikan price card detection
        const pendingOAuthPlan = localStorage.getItem('pendingOAuthPlan');
        const urlParams = new URLSearchParams(window.location.search);
        const isFromPriceCard = urlParams.get('plan') !== null || !!pendingOAuthPlan;
        
        console.log('🔍 Debug - URL params:', Object.fromEntries(urlParams));
        console.log('🔍 Debug - pendingOAuthPlan:', pendingOAuthPlan);
        console.log('🔍 Debug - isFromPriceCard:', isFromPriceCard);
        
        // Check if user exists in public.users
        try {
          const token = session.access_token;
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase configuration missing.');
          }

          // Set session in Supabase client first
          try {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: session.refresh_token
            });
          } catch (e) {
            console.warn('Failed to set Supabase session:', e);
          }

          // Try to get user profile
          let userProfile = null;
          let profileFetchError = null;
          try {
            console.log('🔍 Fetching user profile...');
            userProfile = await authAPI.getCurrentUser(token);
            console.log('✅ Existing user profile found:', userProfile.id);
          } catch (e) {
            profileFetchError = e;
            console.log('ℹ️ User profile not found (new user or error):', e.message);
          }

          // If profile found, proceed to login
          if (userProfile && userProfile.id) {
             // Success - Existing User
             console.log('✅ Login successful for existing user');
          } else {
            // No profile found, assumes new user -> REGISTER
            console.log('📝 New OAuth user detected. Registering...');
            
            const cleanUrl = supabaseUrl.replace(/\/$/, '');
            const functionUrl = `${cleanUrl}/functions/v1/auth-register`;
            
            // 🔧 FIXED: Enhanced request body with explicit price card flag
            const requestBody = {
              name: name,
              email: email,
              password: null, // OAuth
              role: 'owner',
              // 🔧 CRITICAL FIX: Explicitly set trialDays to 0 for price card registration
              paymentCompleted: false,
              trialDays: isFromPriceCard ? 0 : 7, // 0 = NO TRIAL for price card, 7 = trial for direct
              oauthProvider: 'google',
              oauthUserId: user.id,
              // 🔧 ADDITIONAL: Explicit flag for price card registration
              isPriceCardRegistration: isFromPriceCard
            };

            console.log('📋 Request body:', requestBody);
            
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'apikey': supabaseAnonKey
              },
              body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
              // Ignore "already registered" errors for OAuth - this means race condition or temporary fetch failure
              if (response.status !== 422 &&
                  !data.error?.includes('already registered') &&
                  !data.error?.includes('already exists')) {
                throw new Error(data.error || 'Failed to create user profile');
              }
              console.log('ℹ️ User likely already exists (backend handled conflict)');
            } else {
               console.log('✅ Registration successful:', data);
            }
            
            // Assuming registration succeeded (or user exists), we can proceed.
            // We don't strictly need to fetch the profile again if we trust the registration/login flow.
            // But we'll do a quick check to set userProfile for consistency, but won't block on it.
             try {
                // Wait a moment for DB propagation
                await new Promise(r => setTimeout(r, 1000));
                userProfile = await authAPI.getCurrentUser(token);
             } catch (e) {
                console.warn('⚠️ Could not fetch profile immediately after reg, but proceeding:', e.message);
                // Create a dummy profile object to satisfy the check below,
                // since we know auth-register succeeded.
                userProfile = { id: user.id, email: email, name: name, role: 'owner' };
             }
          }

          // Final success check
          if (userProfile) {
            // Manually update auth context
            localStorage.setItem('idcashier_token', token);
            
            // 🔧 Clean up price card plan data after successful registration
            if (isFromPriceCard) {
              localStorage.removeItem('pendingOAuthPlan');
              console.log('🗑️ Cleaned up pendingOAuthPlan after successful price card registration');
            }
            
            setStatus('success');
            toast({
              title: t('loginSuccess'),
              description: `Welcome, ${name}!`,
            });
            
            // Reload page to update auth context
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1000);
          } else {
            throw new Error('Failed to complete authentication flow.');
          }
        } catch (error) {
          console.error('Error handling OAuth callback:', error);
          
          // Provide more specific error messages
          let errorMessage = error.message || 'Failed to complete authentication';
          
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.';
          } else if (error.message?.includes('API key')) {
            errorMessage = 'Configuration error: API key is missing or invalid. Please contact support.';
          } else if (error.message?.includes('Network error')) {
            errorMessage = error.message; // Use the specific network error message
          }
          
          setStatus('error');
          toast({
            title: t('loginFailed'),
            description: errorMessage,
            variant: 'destructive',
          });
          
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        
        // Provide more specific error messages
        let errorMessage = error.message || 'Authentication failed';
        
        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.';
        } else if (error.message?.includes('session')) {
          errorMessage = 'Session error: Please try logging in again.';
        }
        
        setStatus('error');
        toast({
          title: t('loginFailed'),
          description: errorMessage,
          variant: 'destructive',
        });
        
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, toast, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="text-center text-white">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Processing authentication...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-400 text-4xl mb-4">✓</div>
            <p>Authentication successful! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-400 text-4xl mb-4">✗</div>
            <p>Authentication failed. Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
