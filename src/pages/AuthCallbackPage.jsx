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

  // Helper to process payment
  const processDuitkuPayment = async (plan, user, token, methodCode) => {
    try {
      setStatus('processing');
      const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentAmount: parseInt(plan.planPrice, 10),
          productDetails: plan.planName,
          customerVaName: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email,
          userId: user.id,
          isRegistration: true,
          paymentMethod: methodCode // Pass selected payment method
        })
      });

      // Clone response to avoid "body stream already read" error
      const paymentResponseClone = paymentResponse.clone();

      let paymentData;
      try {
        paymentData = await paymentResponse.json();
      } catch (jsonError) {
        console.warn('Response body already read, using clone:', jsonError.message);
        paymentData = await paymentResponseClone.json();
      }

      if (!paymentResponse.ok) {
        // Map common API errors to user-friendly messages
        const friendlyError = mapApiErrorToFriendly(paymentData.error || paymentData.message);
        throw new Error(friendlyError);
      }

      if (paymentData.paymentUrl) {
        // Save pending registration data for callback
        const duration = plan.planDuration ? parseInt(plan.planDuration, 10) : 1;
        localStorage.setItem('pendingRegistration', JSON.stringify({
          name: user.user_metadata?.name || '',
          email: user.email,
          password: null, // OAuth - no password
            oauthUserId: user.id,
          planDuration: duration,
          merchantOrderId: paymentData.merchantOrderId,
          useHPP: false,
          role: 'owner',
          oauthProvider: 'google'
        }));

        // Clean up OAuth plan data
        localStorage.removeItem('pendingOAuthPlan');

        // Redirect immediately to payment gateway
        window.location.href = paymentData.paymentUrl;
        return true;
      } else {
        throw new Error('URL pembayaran tidak ditemukan. Silakan coba lagi.');
      }
    } catch (paymentError) {
      console.error('❌ Payment processing error:', paymentError);

      setStatus('error');
      toast({
        title: 'Gagal Memproses Pembayaran',
        description: paymentError.message || 'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi nanti.',
        variant: 'destructive'
      });

      // Redirect back to register with plan details to retry
      setTimeout(() => {
        const params = new URLSearchParams();
        if (plan.planName) params.append('plan', plan.planName);
        if (plan.planPrice) params.append('price', plan.planPrice);
        if (plan.planDuration) params.append('duration', plan.planDuration);
        window.location.href = `/register?${params.toString()}`;
      }, 3000);
      return false;
    }
  };

  // Helper to map API errors to user-friendly messages
  const mapApiErrorToFriendly = (errorMsg) => {
    if (!errorMsg) return 'Terjadi kesalahan yang tidak dikenal.';

    const msg = errorMsg.toLowerCase();

    if (msg.includes('payment') || msg.includes('duitku')) {
      return 'Gagal terhubung ke sistem pembayaran. Silakan coba lagi nanti.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'Masalah koneksi internet. Pastikan koneksi Anda stabil dan coba lagi.';
    }
    if (msg.includes('timeout')) {
      return 'Waktu tunggu habis. Silakan coba lagi.';
    }
    if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('token')) {
      return 'Sesi Anda telah berakhir. Silakan login kembali.';
    }
    if (msg.includes('validation') || msg.includes('required')) {
      return 'Data yang dikirim tidak lengkap. Silakan coba lagi.';
    }
    if (msg.includes('duplicate') || msg.includes('exists')) {
      return 'Data sudah ada sebelumnya. Silakan gunakan data lain.';
    }

    // Default friendly message
    return 'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi nanti.';
  };

  useEffect(() => {
    const withTimeout = (promise, ms, label) => {
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      });
      return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
    };

    const handleAuthCallback = async () => {
      let finished = false;
      let token = null;
      let pendingPlan = null;
      let isFromPriceCardFlag = false;
      let stubUser = null;
      const failSafe = setTimeout(async () => {
        if (!finished) {
          console.error('⚠️ Auth callback failsafe triggered (timeout).');
          // If this is price-card flow and we have token + plan, attempt direct payment
          if (isFromPriceCardFlag && token && pendingPlan && stubUser) {
            try {
              await processDuitkuPayment(pendingPlan, stubUser, token, pendingPlan.paymentMethod);
              return;
            } catch (e) {
              console.error('Failsafe payment attempt failed:', e);
            }
          }
          setStatus('error');
          toast({
            title: t('loginFailed'),
            description: 'Authentication timeout. Please try again.',
            variant: 'destructive',
          });
          const params = new URLSearchParams();
          if (pendingPlan?.planName) params.append('plan', pendingPlan.planName);
          if (pendingPlan?.planPrice) params.append('price', pendingPlan.planPrice);
          if (pendingPlan?.planDuration) params.append('duration', pendingPlan.planDuration);
          window.location.href = params.toString() ? `/register?${params.toString()}` : '/login';
        }
      }, 20000);
      try {
        // Handle both implicit (hash) and PKCE (code) flows
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const errorParam = urlParams.get('error');

        console.log('🔍 OAuth callback params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          state,
          errorParam,
          hash: window.location.hash,
          search: window.location.search
        });

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        // Implicit flow: tokens in hash
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

        // PKCE flow: code + state in query
        if (!accessToken && code) {
          console.log('🔐 Exchanging PKCE code for session...');
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('❌ Failed to exchange code:', exchangeError);
            throw exchangeError;
          }
          console.log('✅ Session set from code exchange');
        }

        // If neither tokens nor code exist, don't fail yet because
        // Supabase detectSessionInUrl may have already consumed them.
        if (!accessToken && !refreshToken && !code) {
          console.warn('⚠️ OAuth callback has no tokens/code; will attempt getSession()');
        }

        // Get the session from the URL hash
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'getSession'
        );

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
        token = session.access_token;

        // Build a stub profile immediately to avoid blocking
        let userProfile = { id: user.id, email, name, role: 'owner', user_metadata: user.user_metadata };
        stubUser = userProfile;

        // 🔧 FIXED: Cek apakah ini alur registrasi berbayar via price card
        // Enhanced check dengan multiple sources untuk memastikan price card detection
        const pendingOAuthPlan = localStorage.getItem('pendingOAuthPlan');
        const isFromPriceCard = urlParams.get('plan') !== null || !!pendingOAuthPlan;
        isFromPriceCardFlag = isFromPriceCard;

        console.log('🔍 Debug - URL params:', Object.fromEntries(urlParams));
        console.log('🔍 Debug - pendingOAuthPlan:', pendingOAuthPlan);
        console.log('🔍 Debug - isFromPriceCard:', isFromPriceCard);

        // Check if user exists in public.users
        try {
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

          // For price-card OAuth, force register immediately to ensure account exists
          if (isFromPriceCard) {
            const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/auth-register`;
            const requestBody = {
              name: name,
              email: email,
              password: null,
              role: 'owner',
              paymentCompleted: false,
              oauthProvider: 'google',
              oauthUserId: user.id,
              isPriceCardRegistration: true,
              skipTrial: true,
              trialDays: 0
            };

            pendingPlan = {
              planName: urlParams.get('plan'),
              planPrice: urlParams.get('price'),
              planDuration: urlParams.get('duration'),
              paymentMethod: urlParams.get('paymentMethod')
            };

            const storedPlan = JSON.parse(pendingOAuthPlan || '{}');
            if (!pendingPlan.planName) pendingPlan.planName = storedPlan.planName;
            if (!pendingPlan.planPrice) pendingPlan.planPrice = storedPlan.planPrice;
            if (!pendingPlan.planDuration) pendingPlan.planDuration = storedPlan.planDuration;
            if (!pendingPlan.paymentMethod) pendingPlan.paymentMethod = storedPlan.paymentMethod;

            if (pendingPlan.planDuration) {
              requestBody.planDuration = parseInt(pendingPlan.planDuration, 10);
            }

            const response = await withTimeout(
              fetch(functionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify(requestBody)
              }),
              10000,
              'auth-register'
            );

            const data = await response.clone().json().catch(() => ({}));
            console.log('📩 auth-register response:', { status: response.status, body: data });

            if (!response.ok && response.status !== 422) {
              throw new Error(data.error || `Auth-register failed (${response.status})`);
            }
          } else {
            // Non-price-card OAuth flow should also ensure public.users + trial subscription exist.
            // Previously we allowed proceeding with a stub profile when getCurrentUser failed,
            // which leads to "expired" because no subscription row exists.
            try {
              console.log('🔍 Fetching user profile...');
              const fetchedProfile = await withTimeout(
                authAPI.getCurrentUser(token),
                4000,
                'getCurrentUser'
              );
              if (fetchedProfile) {
                userProfile = fetchedProfile;
                console.log('✅ Existing user profile found:', userProfile.id);
              }
            } catch (e) {
              console.log('ℹ️ User profile not found. Creating/syncing via auth-register for trial user...', e.message);

              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              const functionUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/auth-register`;

              const requestBody = {
                name: name,
                email: email,
                password: null, // OAuth
                role: 'owner',
                paymentCompleted: false,
                oauthProvider: 'google',
                oauthUserId: user.id,
                isPriceCardRegistration: false,
                skipTrial: false,
                trialDays: 7
              };

              const resp = await withTimeout(
                fetch(functionUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey
                  },
                  body: JSON.stringify(requestBody)
                }),
                10000,
                'auth-register-trial'
              );

              const data = await resp.clone().json().catch(() => ({}));
              console.log('📩 auth-register (trial) response:', { status: resp.status, body: data });

              if (!resp.ok && resp.status !== 422) {
                throw new Error(data.error || `Auth-register trial failed (${resp.status})`);
              }

              // Fetch profile again after sync (best-effort)
              try {
                await new Promise(r => setTimeout(r, 800));
                const fetchedProfile2 = await withTimeout(
                  authAPI.getCurrentUser(token),
                  4000,
                  'getCurrentUserAfterTrialRegister'
                );
                if (fetchedProfile2) userProfile = fetchedProfile2;
              } catch (e2) {
                console.warn('⚠️ Could not fetch profile after trial register; using stub:', e2.message);
              }
            }
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
              paymentCompleted: false,
              oauthProvider: 'google',
              oauthUserId: user.id,
              isPriceCardRegistration: isFromPriceCard
            };

            // If from price card, skip trial and redirect to payment
            if (isFromPriceCard) {
              requestBody.skipTrial = true;
              requestBody.trialDays = 0; // Explicitly set trial days to 0

              // Get plan details from localStorage or URL params
              let pendingPlan = JSON.parse(pendingOAuthPlan || '{}');

              // Fallback to URL params if localStorage is empty but URL has params
              if (!pendingPlan.planName && urlParams.get('plan')) {
                pendingPlan = {
                  planName: urlParams.get('plan'),
                  planPrice: urlParams.get('price'),
                  planDuration: urlParams.get('duration')
                };
              }

              if (pendingPlan.planDuration) {
                requestBody.planDuration = parseInt(pendingPlan.planDuration, 10);
              }
            } else {
              // Only give trial for non-price-card registrations
              requestBody.trialDays = 7;
            }

            console.log('📋 Request body:', requestBody);

            const response = await withTimeout(
              fetch(functionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify(requestBody)
              }),
              10000,
              'auth-register'
            );

            // Clone response to avoid "body stream already read" error
            const responseClone = response.clone();

            let data;
            try {
              data = await response.json();
            } catch (jsonError) {
              console.warn('Response body already read, using clone:', jsonError.message);
              data = await responseClone.json();
            }

            console.log('📩 auth-register response:', { status: response.status, body: data });

            if (!response.ok) {
              // Ignore "already registered" errors for OAuth - this means race condition or temporary fetch failure
              if (response.status !== 422 &&
                !data.error?.includes('already registered') &&
                !data.error?.includes('already exists')) {
                throw new Error(data.error || `Auth-register failed (${response.status})`);
              }
              console.log('ℹ️ User likely already exists (backend handled conflict)');
            } else if (data?.success === false) {
              throw new Error(data.error || 'Auth-register returned success=false');
            } else {
              console.log('✅ Registration successful:', data);
            }

            // Assuming registration succeeded (or user exists), we can proceed.
            // We don't strictly need to fetch the profile again if we trust the registration/login flow.
            // But we'll do a quick check to set userProfile for consistency, but won't block on it.
            try {
              // Wait a moment for DB propagation
              await new Promise(r => setTimeout(r, 800));
              const fetchedProfile = await withTimeout(
                authAPI.getCurrentUser(token),
                3000,
                'getCurrentUserAfterRegister'
              );
              if (fetchedProfile) {
                userProfile = fetchedProfile;
              }
            } catch (e) {
              console.warn('⚠️ Could not fetch profile immediately after reg, but proceeding:', e.message);
              // Keep stub profile; auth-register already succeeded
              userProfile = userProfile || { id: user.id, email: email, name: name, role: 'owner' };
            }
          }

          // Final success check
          if (userProfile) {
            // Manually update auth context
            localStorage.setItem('idcashier_token', token);

            // 🔧 FIXED: If from price card, process payment directly instead of redirecting
            if (isFromPriceCard) {
              // Prefer URL params for fresh data, fallback to localStorage
              const pendingPlan = {
                planName: urlParams.get('plan'),
                planPrice: urlParams.get('price'),
                planDuration: urlParams.get('duration'),
                paymentMethod: urlParams.get('paymentMethod')
              };

              // Fill from localStorage if missing in URL
              const storedPlan = JSON.parse(pendingOAuthPlan || '{}');
              if (!pendingPlan.planName) pendingPlan.planName = storedPlan.planName;
              if (!pendingPlan.planPrice) pendingPlan.planPrice = storedPlan.planPrice;
              if (!pendingPlan.planDuration) pendingPlan.planDuration = storedPlan.planDuration;
              if (!pendingPlan.paymentMethod) pendingPlan.paymentMethod = storedPlan.paymentMethod;

              console.log('💰 Price card registration detected, processing payment...');

              // Store plan details for payment processing
              if (pendingPlan.planName && pendingPlan.planPrice && pendingPlan.planDuration) {
                // If payment method is selected, proceed to payment
                if (pendingPlan.paymentMethod) {
                  const paymentSuccess = await processDuitkuPayment(pendingPlan, userProfile, token, pendingPlan.paymentMethod);
                  if (paymentSuccess) return; // Exit if redirecting
                  // If payment failed (returned false), error already shown, redirect back to register
                  const params = new URLSearchParams();
                  params.append('plan', pendingPlan.planName);
                  params.append('price', pendingPlan.planPrice);
                  params.append('duration', pendingPlan.planDuration);
                  localStorage.removeItem('pendingOAuthPlan');
                  setTimeout(() => {
                    window.location.href = `/register?${params.toString()}`;
                  }, 2000);
                  return;
                } else {
                  // Payment method missing - redirect back to register page to select payment method
                  console.warn('⚠️ Payment method missing for price card registration');
                  toast({
                    title: 'Metode Pembayaran Diperlukan',
                    description: 'Silakan pilih metode pembayaran untuk melanjutkan.',
                    variant: 'default'
                  });

                  const params = new URLSearchParams();
                  params.append('plan', pendingPlan.planName);
                  params.append('price', pendingPlan.planPrice);
                  params.append('duration', pendingPlan.planDuration);
                  localStorage.removeItem('pendingOAuthPlan');

                  setTimeout(() => {
                    window.location.href = `/register?${params.toString()}`;
                  }, 1500);
                  return;
                }
              } else {
                // Plan details missing - redirect to register without params
                console.warn('⚠️ Price card registration but plan details missing');
                toast({
                  title: 'Data Paket Tidak Lengkap',
                  description: 'Silakan pilih paket langganan kembali.',
                  variant: 'default'
                });
                localStorage.removeItem('pendingOAuthPlan');
                setTimeout(() => {
                  window.location.href = '/';
                }, 1500);
                return;
              }
            } else {
              // Non-price-card registration - clean up and proceed normally
              console.log('✅ Standard registration (with trial)');
            }

            // Standard success path (No payment, or payment skipped/missing data)
            setStatus('success');
            toast({
              title: t('loginSuccess'),
              description: `Welcome, ${name}!`,
            });

            finished = true;
            clearTimeout(failSafe);
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 800);
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

          finished = true;
          clearTimeout(failSafe);
          setTimeout(() => {
            navigate('/login');
          }, 1500);
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

        finished = true;
        clearTimeout(failSafe);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
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