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
        console.log('🔄 Starting Auth Callback...');

        // 1. Explicitly handle URL hash for OAuth tokens if present
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('🔐 Setting session from URL hash...');
          const { error: sessionSetError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (sessionSetError) throw sessionSetError;
        }

        // 2. Get verified session
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // Retry logic if session is missing immediately after redirect
        if (!session && !sessionError) {
          await new Promise(r => setTimeout(r, 500));
          const retry = await supabase.auth.getSession();
          session = retry.data.session;
          sessionError = retry.error;
        }

        if (sessionError) throw sessionError;
        if (!session) throw new Error('No active session found. Please login again.');

        const token = session.access_token;
        const currentUser = session.user;
        const userMetadata = currentUser.user_metadata || {};
        const currentName = userMetadata.name || userMetadata.full_name || currentUser.email?.split('@')[0] || 'User';
        const currentEmail = currentUser.email;

        console.log('✅ OAuth Session confirmed for:', currentEmail);

        // 3. Determine Registration Context (Price Card vs Normal)
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

        // 4. Get or Create User Profile
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
            role: 'owner',
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
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(regBody)
          });

          const regText = await regRes.text();
          let regData;
          try { regData = JSON.parse(regText); } catch (e) { throw new Error('Invalid server response'); }

          if (!regRes.ok) {
            if (regRes.status !== 422 && !regData.error?.includes('already registered')) {
              throw new Error(regData.error || 'Registration failed');
            }
          }

          userProfile = { id: currentUser.id, email: currentEmail, name: regBody.name, role: 'owner' };
          console.log('✅ Registration logic completed.');
        }

        // 5. Handle Post-Auth Logic (Payment or Dashboard)
        if (isPriceCardFlow) {
          console.log('💰 Starting Payment Flow for:', planDetails.planName);

          if (!planDetails.paymentMethod) {
            toast({ title: t('paymentMethodRequired'), description: t('selectPaymentMethodDesc'), variant: "destructive" });
            const retryParams = new URLSearchParams(planDetails).toString();
            window.location.href = `/register?${retryParams}`;
            return;
          }

          await processDuitkuPayment(planDetails, userProfile, token, planDetails.paymentMethod);

        } else {
          console.log('🚀 Redirecting to Dashboard...');
          toast({ title: t('loginSuccess'), description: `Welcome ${currentName}!` });
          navigate('/dashboard');
        }

      } catch (error) {
        console.error('❌ Auth Flow Error:', error);
        setStatus('error');
        const errorMessage = mapApiErrorToFriendly(error.message || 'Terjadi kesalahan saat otentikasi.');
        toast({
          title: t('loginFailed'),
          description: errorMessage,
          variant: 'destructive',
        });

        setTimeout(() => {
          navigate('/login');
        }, 3000);
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
