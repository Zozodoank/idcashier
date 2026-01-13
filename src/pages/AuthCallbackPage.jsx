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
  const processDuitkuPayment = async (plan, userProfile, token, methodCode) => {
    try {
      setStatus('processing');
      // Use userProfile data, fallback to session user if needed
      const userName = userProfile?.name || userProfile?.user_metadata?.name || userProfile?.email?.split('@')[0] || 'User';
      const userEmail = userProfile?.email || '';
      const userId = userProfile?.id || '';

      if (!userId || !userEmail) {
        throw new Error('User data tidak lengkap. Silakan coba lagi.');
      }

      const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentAmount: parseInt(plan.planPrice, 10),
          productDetails: plan.planName,
          customerVaName: userName,
          email: userEmail,
          userId: userId,
          isRegistration: true,
          paymentMethod: methodCode // Pass selected payment method
        })
      });

      const responseText = await paymentResponse.text();
      let paymentData;
      try {
        paymentData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse payment response:', responseText);
        throw new Error('Invalid response from payment server');
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
        if (methodCode) params.append('paymentMethod', methodCode);
        navigate(`/register?${params.toString()}`);
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
                  planDuration: urlParams.get('duration'),
                  paymentMethod: urlParams.get('paymentMethod')
                };
              }

              // Also check URL params for payment method if not in pendingPlan
              if (!pendingPlan.paymentMethod && urlParams.get('paymentMethod')) {
                pendingPlan.paymentMethod = urlParams.get('paymentMethod');
              }

              if (pendingPlan.planDuration) {
                requestBody.planDuration = parseInt(pendingPlan.planDuration, 10);
              }
            } else {
              // Only give trial for non-price-card registrations
              requestBody.trialDays = 7;
            }

            console.log('📋 Request body:', requestBody);

            // WRAPPED: Try/catch to prevent blocking payment flow if registration glitches
            try {
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
                // Warning only - proceed to payment phase regardless
                console.warn('⚠️ Register function returned error (continuing to payment):', data.error);
              } else {
                console.log('✅ Registration successful:', data);
              }
            } catch (regError) {
              console.error('⚠️ Registration call failed (continuing to payment):', regError);
            }

            // Assuming registration succeeded (or user exists), we can proceed.
            // We don't strictly need to fetch the profile again if we trust the registration/login flow.
            // But we'll do a quick check to set userProfile for consistency, but won't block on it.
            try {
              // Wait a moment for DB propagation (increased delay for OAuth registration)
              await new Promise(r => setTimeout(r, 2000));
              userProfile = await authAPI.getCurrentUser(token);
              console.log('✅ User profile fetched after registration:', userProfile?.id);
            } catch (e) {
              console.warn('⚠️ Could not fetch profile immediately after reg, but proceeding:', e.message);
              // For OAuth registration, create profile object from auth user data
              // This ensures we can proceed even if profile fetch fails temporarily
              userProfile = {
                id: user.id,
                email: email,
                name: name,
                role: 'owner',
                // Mark as temporary to handle in payment flow
                _temp: true
              };
              console.log('📝 Using temporary profile object for OAuth registration');
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

              // Fill from localStorage if missing in URL (prioritize URL params)
              const storedPlan = JSON.parse(pendingOAuthPlan || '{}');
              if (!pendingPlan.planName) pendingPlan.planName = storedPlan.planName;
              if (!pendingPlan.planPrice) pendingPlan.planPrice = storedPlan.planPrice;
              if (!pendingPlan.planDuration) pendingPlan.planDuration = storedPlan.planDuration;
              // Payment method: prefer URL params, then localStorage
              if (!pendingPlan.paymentMethod) {
                pendingPlan.paymentMethod = storedPlan.paymentMethod;
              }

              console.log('💰 Price card registration detected, processing payment...');

              // Store plan details for payment processing
              if (pendingPlan.planName && pendingPlan.planPrice && pendingPlan.planDuration) {
                // If payment method is selected, proceed to payment
                if (pendingPlan.paymentMethod) {
                  // Use userProfile if available, otherwise fallback to session user
                  const paymentUser = userProfile && userProfile.id ? userProfile : {
                    id: user.id,
                    email: email,
                    name: name,
                    user_metadata: user.user_metadata
                  };
                  const paymentSuccess = await processDuitkuPayment(pendingPlan, paymentUser, token, pendingPlan.paymentMethod);
                  if (paymentSuccess) return; // Exit if redirecting
                  // If payment failed (returned false), error already shown, redirect back to register
                  const params = new URLSearchParams();
                  params.append('plan', pendingPlan.planName);
                  params.append('price', pendingPlan.planPrice);
                  params.append('duration', pendingPlan.planDuration);
                  params.append('paymentMethod', pendingPlan.paymentMethod);
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

        // FIXED: Smart redirect handles registration errors by sending user back to register page
        if (isFromPriceCard) {
          // Reconstruct params to allow retry
          const pendingPlan = JSON.parse(localStorage.getItem('pendingOAuthPlan') || '{}');
          const params = new URLSearchParams(window.location.search);
          if (pendingPlan.planName) params.set('plan', pendingPlan.planName);
          if (pendingPlan.planPrice) params.set('price', pendingPlan.planPrice);
          if (pendingPlan.planDuration) params.set('duration', pendingPlan.planDuration);
          if (pendingPlan.paymentMethod) params.set('paymentMethod', pendingPlan.paymentMethod);

          setTimeout(() => {
            navigate(`/register?${params.toString()}`);
          }, 2000);
        } else {
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
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
            <p className="text-xl">Loading Aplikasi...</p>
            <p className="text-sm mt-2 opacity-80">Mohon tunggu sebentar</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-400 text-4xl mb-4">✓</div>
            <p className="text-xl">Berhasil! Mengalihkan...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-400 text-4xl mb-4">✗</div>
            <p className="text-xl">Terjadi kesalahan. Mengalihkan...</p>
          </>
        )}
      </div>


    </div>
  );
};

export default AuthCallbackPage;
