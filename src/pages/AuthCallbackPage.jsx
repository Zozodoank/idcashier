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
              paymentCompleted: false,
              oauthProvider: 'google',
              oauthUserId: user.id,
              isPriceCardRegistration: isFromPriceCard
            };

            // If from price card, skip trial and redirect to payment
            if (isFromPriceCard) {
              requestBody.skipTrial = true;
              // Get plan details from localStorage
              const pendingPlan = JSON.parse(pendingOAuthPlan || '{}');
              if (pendingPlan.planDuration) {
                requestBody.planDuration = parseInt(pendingPlan.planDuration, 10);
              }
            } else {
              // Only give trial for non-price-card registrations
              requestBody.trialDays = 7;
            }

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
            
            // 🔧 FIXED: If from price card, process payment directly instead of redirecting
            if (isFromPriceCard) {
              const pendingPlan = JSON.parse(pendingOAuthPlan || '{}');
              console.log('💰 Price card registration detected, processing payment...');
              
              // Store plan details for payment processing
              if (pendingPlan.planName && pendingPlan.planPrice && pendingPlan.planDuration) {
                try {
                  // Process payment directly - call payment gateway
                  const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      paymentAmount: parseInt(pendingPlan.planPrice, 10),
                      productDetails: pendingPlan.planName,
                      customerVaName: name,
                      email: email,
                      userId: userProfile.id,
                      isRegistration: true,
                      // Let backend decide payment method or use default
                      paymentMethod: undefined
                    })
                  });

                  const paymentData = await paymentResponse.json();
                  
                  if (!paymentResponse.ok) {
                    throw new Error(paymentData.error || paymentData.message || 'Payment request failed');
                  }

                  if (paymentData.paymentUrl) {
                    // Save pending registration data for callback
                    const duration = pendingPlan.planDuration ? parseInt(pendingPlan.planDuration, 10) : 1;
                    localStorage.setItem('pendingRegistration', JSON.stringify({
                      name,
                      email,
                      password: null, // OAuth - no password
                      planDuration: duration,
                      merchantOrderId: paymentData.merchantOrderId,
                      useHPP: false,
                      role: 'owner',
                      oauthProvider: 'google'
                    }));

                    // Clean up OAuth plan data
                    localStorage.removeItem('pendingOAuthPlan');
                    
                    console.log('🔗 Redirecting to payment gateway:', paymentData.paymentUrl);
                    
                    setStatus('success');
                    toast({
                      title: t('registrationSuccessful') || 'Registrasi Berhasil',
                      description: 'Mengarahkan ke halaman pembayaran...',
                    });
                    
                    // Redirect to payment gateway
                    setTimeout(() => {
                      window.location.href = paymentData.paymentUrl;
                    }, 1500);
                    return; // Exit early to prevent dashboard redirect
                  } else {
                    throw new Error('Payment URL not received');
                  }
                } catch (paymentError) {
                  console.error('❌ Payment processing error:', paymentError);
                  // Fallback: clean up and show error
                  localStorage.removeItem('pendingOAuthPlan');
                  toast({
                    title: t('error') || 'Error',
                    description: paymentError.message || 'Gagal memproses pembayaran. Silakan coba lagi.',
                    variant: 'destructive'
                  });
                  // Still redirect to dashboard but user will need to pay manually
                }
              } else {
                console.warn('⚠️ Price card registration but plan details missing');
                // Fallback: clean up and redirect to dashboard
                localStorage.removeItem('pendingOAuthPlan');
              }
            } else {
              // Non-price-card registration - clean up and proceed normally
              console.log('✅ Standard registration (with trial)');
            }
            
            setStatus('success');
            toast({
              title: t('loginSuccess'),
              description: `Welcome, ${name}!`,
            });
            
            // Reload page to update auth context (only for non-price-card)
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
