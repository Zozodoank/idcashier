import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useHPP } from '@/contexts/HPPContext';

export default function PaymentCallbackPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  const { refreshHPPSetting } = useHPP();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState(t('processingPayment'));
  const isRegistration = params.get('register') === '1';
  const isRenewal = params.get('renewal') === '1';
  const isHPPActivation = params.get('hpp') === '1';

  // Debug logging
  console.log('🔍 Payment Callback Debug:', {
    allParams: Object.fromEntries(params.entries()),
    isRegistration,
    isRenewal,
    url: window.location.href
  });

  useEffect(() => {
    const processPaymentCallback = async () => {
      try {
        const paymentStatus = params.get('status') || '';
        const resultCode = params.get('resultCode') || params.get('resultcode') || '';
        const result = params.get('result') || '';

        const isSuccess =
          (paymentStatus.toLowerCase() === 'success' ||
            paymentStatus.toLowerCase() === 'paid' ||
            resultCode === '00' ||
            result.toLowerCase() === 'success') &&
          resultCode !== '01'; // Ensure it's not a cancellation

        if (isSuccess) {
          setStatus('success');
          setMessage(t('paymentSuccessful'));

          if (isRegistration) {
            let pendingRegistration = null;
            try {
              const storedData = localStorage.getItem('pendingRegistration');
              if (storedData) {
                pendingRegistration = JSON.parse(storedData);
              }
            } catch (parseError) {
              console.error('❌ Error parsing pendingRegistration:', parseError);
            }

            if (!pendingRegistration) {
              console.warn('⚠️ No pending registration data found');
              toast({ title: t('paymentSuccessful'), description: 'Pembayaran berhasil! Mengarahkan ke setup toko...' });
              setTimeout(() => navigate('/store-setup', { replace: true, state: { fromPayment: true } }), 1500);
              return;
            }

            console.log('💳 Processing payment for registration logic...');
            const isOAuthRegistration = !pendingRegistration.password || pendingRegistration.oauthProvider === 'google';

            if (isOAuthRegistration) {
              console.log('✅ OAuth user - waiting for session initialization...');

              // Helper to wait for session (Patient Waiter)
              const waitForSession = async () => {
                for (let i = 0; i < 10; i++) { // Try 10 times (5 seconds)
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session) return session;
                  await new Promise(r => setTimeout(r, 500));
                }
                return null;
              };

              let session = await waitForSession();

              // Recovery attempt manual
              if (!session) {
                const manualToken = localStorage.getItem('idcashier_token');
                if (manualToken) {
                  console.log('🔄 Attempting manual token recovery...');
                  await supabase.auth.setSession({ access_token: manualToken, refresh_token: manualToken });
                  session = (await supabase.auth.getSession()).data.session;
                }
              }

              if (session) {
                console.log('✅ Session active.');
                const currentUser = session.user;
                // 2. SAFETY NET: Check & Create Profile if missing
                const { data: profile } = await supabase.from('users').select('id').eq('id', currentUser.id).maybeSingle();

                if (!profile) {
                  console.log('⚠️ Profile missing - Invoking Server-Side Rescue...');
                  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      userId: currentUser.id,
                      email: currentUser.email,
                      name: pendingRegistration?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
                      role: 'owner',
                      isPriceCardRegistration: true,
                      paymentCompleted: true
                    })
                  });
                }
              } else {
                console.warn('⚠️ Session wait timed out. Redirecting to Store Setup anyway (ProtectedRoute will handle auth).');
              }

              localStorage.removeItem('pendingRegistration');
              toast({ title: t('registrationSuccessful'), description: 'Pembayaran berhasil! Mengarahkan ke setup toko...' });
              setTimeout(() => {
                navigate('/store-setup', { replace: true, state: { fromPayment: true } });
              }, 1500);

            } else {
              // Email/Password user
              console.log('✅ Email/Password user - logging in after payment');

              try {
                // Login user
                const loginRes = await login(pendingRegistration.email, pendingRegistration.password);

                if (loginRes.success && loginRes.user) {
                  const { data: profile } = await supabase.from('users').select('id').eq('id', loginRes.user.id).maybeSingle();
                  if (!profile) {
                    console.log('⚠️ Profile missing for Email User - Invoking Server-Side Rescue...');
                    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${loginRes.token}`,
                      },
                      body: JSON.stringify({
                        userId: loginRes.user.id,
                        email: loginRes.user.email,
                        name: pendingRegistration.name,
                        role: 'owner',
                        paymentCompleted: true
                      })
                    });
                  }
                }

                if (!loginRes.success) {
                  throw new Error(loginRes.error || 'Login failed');
                } else {
                  console.log('✅ Login successful after payment');
                  localStorage.removeItem('pendingRegistration');
                  toast({ title: t('registrationSuccessful'), description: 'Pembayaran berhasil! Mengarahkan ke setup toko...' });
                  setTimeout(() => navigate('/store-setup', { replace: true, state: { fromPayment: true } }), 1500);
                  return;
                }

              } catch (loginError) {
                console.error('Login attempt error:', loginError);
                // Fallback: Check existing session
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  localStorage.setItem('idcashier_token', session.access_token);
                  navigate('/store-setup', { replace: true, state: { fromPayment: true } });
                  return;
                }

                // Ultimate fallback: Redirect to login with message
                console.warn('Login failed and no session. Standard redirect to login.');
                toast({ title: t('paymentSuccessful'), description: 'Silakan login ulang untuk melanjutkan.' });
                setTimeout(() => navigate('/login?payment=success', { replace: true }), 2000);
              }
            }

          } else if (isRenewal) {
            // RENEWAL LOGIC
            if (isHPPActivation) {
              // ... HPP Logic (Simplified for brevity, assumes standard flow)
              // Keeping optimistic updates as they were good
              const token = localStorage.getItem('idcashier_token');
              if (token) {
                const { settingsAPI } = await import('@/lib/api');
                settingsAPI.update('hpp_enabled', { enabled: true }, token).catch(console.error);
                refreshHPPSetting && refreshHPPSetting();
              }
              localStorage.setItem('idcashier_hpp_optimistic', JSON.stringify({ enabled: true, ts: Date.now(), ttl: 600000 }));
              setMessage(t('paymentSuccessful') || 'HPP Activated');
              setTimeout(() => window.location.href = '/dashboard?page=settings&tab=hpp&hpp_refreshed=true', 2000);
            } else {
              // Standard Renewal
              setMessage(t('paymentVerifiedRedirecting'));
              localStorage.setItem('idcashier_renewal_pending', Date.now().toString());
              localStorage.removeItem('idcashier_subscription_cache');
              setTimeout(() => window.location.href = '/store-setup?fromRenewal=true', 2000);
            }

          } else {
            // General Success
            localStorage.setItem('idcashier_current_page', 'subscription');
            localStorage.removeItem('idcashier_subscription_cache');
            setTimeout(() => window.location.href = '/dashboard?subscription_refreshed=true', 1500);
          }

        } else {
          // FAILED / CANCELLED
          setStatus('failed');
          setMessage(t('paymentFailedOrCancelled'));
          if (isRegistration) localStorage.removeItem('pendingRegistration');
          setTimeout(() => {
            const hasToken = localStorage.getItem('idcashier_token');
            navigate(isRegistration || !hasToken ? '/login?payment_failed=1' : '/dashboard?payment_failed=1', { replace: true });
          }, 2500);
        }
      } catch (error) {
        console.error('❌ Payment Callback Critical Error:', error);
        setStatus('error');
        setMessage('Terjadi kesalahan memproses pembayaran.');
        if (isRegistration) localStorage.removeItem('pendingRegistration');
        setTimeout(() => navigate('/login?error=callback_exception'), 3000);
      }
    };

    processPaymentCallback();
  }, [params, navigate, toast, login, isRegistration, isRenewal, isHPPActivation, refreshHPPSetting, t]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && t('processingPayment')}
            {status === 'success' && t('paymentSuccessful')}
            {status === 'failed' && t('paymentFailed')}
            {status === 'error' && t('error')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p>{message}</p>
            </div>
          )}
          {status !== 'processing' && status !== 'success' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-red-500">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
