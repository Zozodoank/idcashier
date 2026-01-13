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
          name: userProfile.user_metadata?.name || userProfile.name || '',
          email: userProfile.email,
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
        const handleCallback = async () => {
          try {
            // 1. Handle OAuth Callback
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session) {
              // Keep waiting if session not yet established (sometimes takes a moment after redirect)
              const { data: { session: freshSession }, error: freshError } = await supabase.auth.getSession();
              if (freshError || !freshSession) throw new Error('No session found. Please try logging in again.');
            }

            const token = session.access_token;
            const currentUser = session.user;
            const userMetadata = currentUser.user_metadata || {};
            const currentName = userMetadata.name || userMetadata.full_name || currentUser.email?.split('@')[0] || 'User';
            const currentEmail = currentUser.email;

            console.log('✅ OAuth Session confirmed for:', currentEmail);

            // 2. Determine Registration Context (Price Card vs Normal)
            // Prioritize URL params (most reliable after redirect), then localStorage
            const urlParams = new URLSearchParams(window.location.search);
            let planDetails = null;

            // Check URL params first
            if (urlParams.get('plan')) {
              planDetails = {
                planName: urlParams.get('plan'),
                planPrice: urlParams.get('price'),
                planDuration: urlParams.get('duration'),
                paymentMethod: urlParams.get('paymentMethod')
              };
            }

            // Fallback to localStorage
            if (!planDetails) {
              try {
                const stored = JSON.parse(localStorage.getItem('pendingOAuthPlan'));
                if (stored && stored.planName) planDetails = stored;
              } catch (e) { /* ignore json error */ }
            }

            const isPriceCardFlow = !!(planDetails && planDetails.planName);

            // 3. Get or Create User Profile
            let userProfile = null;
            try {
              userProfile = await authAPI.getCurrentUser(token);
              console.log('✅ Existing profile found:', userProfile.id);
            } catch (e) {
              console.log('ℹ️ Profile not found, registering new user...');

              // Register New User via Edge Function
              const regBody = {
                name: name || email.split('@')[0],
                email: email,
                password: null, // OAuth
                role: 'owner', // Default role
                paymentCompleted: false,
                isPriceCardRegistration: isPriceCardFlow,
                oauthProvider: 'google',
                oauthUserId: user.id
              };

              // Force strict trial rules in registration
              if (isPriceCardFlow) {
                regBody.trialDays = 0;
                regBody.skipTrial = true;
              }

              const regRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` // Use user token for RLS if needed, or anon key
                  // Note: auth-register mainly uses service role internally, but passing token helps context
                },
                body: JSON.stringify(regBody)
              });

              const regText = await regRes.text();
              let regData;
              try { regData = JSON.parse(regText); } catch (e) { throw new Error('Invalid server response'); }

              if (!regRes.ok) {
                // Ignore unique constraint violation (user already exists race condition)
                if (regRes.status !== 422 && !regData.error?.includes('already registered')) {
                  throw new Error(regData.error || 'Registration failed');
                }
              }

              // Construct a profile object to proceed without re-fetching
              userProfile = { id: user.id, email, name: regBody.name, role: 'owner' };
              console.log('✅ Registration logic completed.');
            }

            // 4. Handle Post-Auth Logic (Payment or Dashboard)
            if (isPriceCardFlow) {
              console.log('💰 Starting Payment Flow for:', planDetails.planName);

              if (!planDetails.paymentMethod) {
                // Critical: No payment method selected
                toast({ title: t('paymentMethodRequired'), description: t('selectPaymentMethodDesc'), variant: "destructive" });
                // Redirect back to register to pick method, preserving plan info
                const retryParams = new URLSearchParams(planDetails).toString();
                window.location.href = `/register?${retryParams}`;
                return;
              }

              // Execute Payment Request
              await processDuitkuPayment(planDetails, userProfile, token, planDetails.paymentMethod);
              // processDuitkuPayment will handle redirect on success or toast on failure

            } else {
              // Normal Login/Register (Trial)
              const stored = JSON.parse(localStorage.getItem('pendingOAuthPlan'));
              if (stored && stored.planName) planDetails = stored;
            } catch (e) { /* ignore json error */ }
          }

        const isPriceCardFlow = !!(planDetails && planDetails.planName);

          // 3. Get or Create User Profile
          let userProfile = null;
          try {
            userProfile = await authAPI.getCurrentUser(token);
            console.log('✅ Existing profile found:', userProfile.id);
          } catch (e) {
            console.log('ℹ️ Profile not found, registering new user...');

            // Register New User via Edge Function
            const regBody = {
              name: currentName,
              email: currentEmail,
              password: null, // OAuth
              role: 'owner', // Default role
              paymentCompleted: false,
              isPriceCardRegistration: isPriceCardFlow,
              oauthProvider: 'google',
              oauthUserId: currentUser.id
            };

            // Force strict trial rules in registration
            if (isPriceCardFlow) {
              regBody.trialDays = 0;
              regBody.skipTrial = true;
            }

            const regRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Use user token for RLS if needed, or anon key
                // Note: auth-register mainly uses service role internally, but passing token helps context
              },
              body: JSON.stringify(regBody)
            });

            const regText = await regRes.text();
            let regData;
            try { regData = JSON.parse(regText); } catch (e) { throw new Error('Invalid server response'); }

            if (!regRes.ok) {
              // Ignore unique constraint violation (user already exists race condition)
              if (regRes.status !== 422 && !regData.error?.includes('already registered')) {
                throw new Error(regData.error || 'Registration failed');
              }
            }

            // Construct a profile object to proceed without re-fetching
            userProfile = { id: currentUser.id, email: currentEmail, name: regBody.name, role: 'owner' };
            console.log('✅ Registration logic completed.');
          }

          // 4. Handle Post-Auth Logic (Payment or Dashboard)
          if (isPriceCardFlow) {
            console.log('💰 Starting Payment Flow for:', planDetails.planName);

            if (!planDetails.paymentMethod) {
              // Critical: No payment method selected
              toast({ title: t('paymentMethodRequired'), description: t('selectPaymentMethodDesc'), variant: "destructive" });
              // Redirect back to register to pick method, preserving plan info
              const retryParams = new URLSearchParams(planDetails).toString();
              window.location.href = `/register?${retryParams}`;
              return;
            }

            // Execute Payment Request
            await processDuitkuPayment(planDetails, userProfile, token, planDetails.paymentMethod);
            // processDuitkuPayment will handle redirect on success or toast on failure

          } else {
            // Normal Login/Register (Trial)
            console.log('🚀 Redirecting to Dashboard...');
            toast({ title: t('loginSuccess'), description: `Welcome ${currentName}!` });
            navigate('/dashboard');
          }

        } catch (error) {
          console.error('❌ Auth Flow Error:', error);
          setStatus('error');
          // Assuming 'errorMessage' is defined elsewhere or should be derived from 'error'
          const errorMessage = mapApiErrorToFriendly(error.message || 'Terjadi kesalahan saat otentikasi.');
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
