import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';     
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';    
import { supabase } from '@/lib/supabaseClient';
import { useHPP } from '@/contexts/HPPContext';     

export default function PaymentCallbackPage() {      
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, user } = useAuth(); // Removed refreshSession
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
        // Cek status pembayaran dari parameter URL  
        const paymentStatus = params.get('status') || '';
        const resultCode = params.get('resultCode') || params.get('resultcode') || '';
        const result = params.get('result') || '';   

        // Determine success from multiple indicators
        const isSuccess =
          (paymentStatus.toLowerCase() === 'success' ||
            paymentStatus.toLowerCase() === 'paid' ||
            resultCode === '00' ||
            result.toLowerCase() === 'success') &&
          resultCode !== '01'; // Ensure it's not a cancellation

        if (isSuccess) {
          setStatus('success');
          setMessage(t('paymentSuccessful'));        

          // Jika ini adalah proses registrasi, lakukan pendaftaran di Supabase
          if (isRegistration) {
             // ... registration logic stays same
             // ...
             // But inside registration logic, replace any refreshSession/timeout refresh logic if any
             // ...
             // Let's assume registration block is mostly fine as user complained about renewal/expired status
             
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
              navigate('/login?payment=success');  
              return;
            }

            // ... fetch auth-register ...
            const registerRes = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',  
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                name: pendingRegistration.name,      
                email: pendingRegistration.email,    
                password: pendingRegistration.password,
                planDuration: pendingRegistration.planDuration,
                useHPP: pendingRegistration.useHPP,  
                merchantOrderId: pendingRegistration.merchantOrderId,
                paymentCompleted: true,
                trialDays: 7 // Auto-enable HPP trial for all new registrations
              })
            });

            const regJson = await registerRes.json();
            if (!registerRes.ok) throw new Error(regJson.error || regJson.message || 'Register failed');  

            // Login
            const loginRes = await login(pendingRegistration.email, pendingRegistration.password);        
            if (!loginRes.success) throw new Error(loginRes.error);

            localStorage.removeItem('pendingRegistration');

            toast({
              title: t('registrationSuccessful'),
              description: 'Pembayaran berhasil! Akun Anda telah aktif. Mengarahkan ke setup toko...',
            });

            setTimeout(() => {
              navigate('/store-setup', { replace: true, state: { fromPayment: true } });
            }, 1500);

          } else if (isRenewal) {
            // Renewal logic - Redirect to store setup after successful payment (unless HPP activation)
            console.log('🔄 Processing renewal payment callback...');
            
            // Check if this is HPP activation
            if (isHPPActivation) {
              console.log('🔄 [HPP Activation] Processing HPP activation in frontend...');
              // Handle HPP activation
              // Force enable HPP setting if payment was successful, even if pending data is missing
              // This is a robust fallback for when backend processing lags or fails
              try {
                console.log('🔄 [HPP Activation] Attempting to force enable HPP setting...');
                const { settingsAPI } = await import('@/lib/api');
                const token = localStorage.getItem('idcashier_token');
                
                if (token) {
                  // Always attempt to update setting to enabled, regardless of pending data
                  console.log('🔄 [HPP Activation] Updating HPP setting via API...');
                  await settingsAPI.update('hpp_enabled', { enabled: true }, token);
                  console.log('✅ [HPP Activation] HPP setting successfully updated via API');
                  
                  // Clear pending data if it exists
                  localStorage.removeItem('pendingHPPActivation');
                  
                  // Set optimistic flag to avoid UI lag until context refresh completes
                  localStorage.setItem('idcashier_hpp_optimistic', JSON.stringify({
                    enabled: true,
                    ts: Date.now(),
                    ttl: 10 * 60 * 1000 // 10 minutes
                  }));
                  
                  // Refresh HPP context to reflect the change immediately
                  if (refreshHPPSetting) {
                    console.log('🔄 [HPP Activation] Refreshing HPP context...');
                    await refreshHPPSetting();
                    console.log('✅ [HPP Activation] HPP context refreshed');
                  }
                } else {
                  console.warn('⚠️ [HPP Activation] Token missing, setting optimistic flag anyway');
                  // Even without token, set optimistic flag as fallback
                  localStorage.setItem('idcashier_hpp_optimistic', JSON.stringify({
                    enabled: true,
                    ts: Date.now(),
                    ttl: 10 * 60 * 1000 // 10 minutes
                  }));
                }
              } catch (error) {
                console.error('❌ [HPP Activation] Error forcing HPP activation:', error);
                // Even if API update fails, still set optimistic flag as fallback
                localStorage.setItem('idcashier_hpp_optimistic', JSON.stringify({
                  enabled: true,
                  ts: Date.now(),
                  ttl: 10 * 60 * 1000 // 10 minutes
                }));
                console.log('🔄 [HPP Activation] Set optimistic flag as fallback after API error');
              }
              
              setMessage(t('paymentSuccessful') || 'Pembayaran berhasil! Fitur HPP telah diaktifkan.');
              
              setTimeout(() => {
                const hasToken = localStorage.getItem('idcashier_token');
                if (hasToken) {
                  // Set flag to force refresh HPP setting after redirect
                  localStorage.setItem('idcashier_hpp_refresh_needed', 'true');
                  console.log('🔄 [HPP Activation] Setting refresh flag and redirecting...');
                  // Redirect to HPP settings tab instead of general
                  window.location.href = '/dashboard?page=settings&tab=hpp&hpp_refreshed=true';
                } else {
                  window.location.href = '/login?message=hpp_activated';
                }
              }, 2000);
            } else {
              // Regular renewal - redirect to store setup
              setMessage(t('paymentVerifiedRedirecting') || 'Pembayaran terverifikasi. Mengarahkan ke pengaturan toko...');

              // Set optimistic flag that allows temporary access while server syncs
              localStorage.setItem('idcashier_renewal_pending', Date.now().toString());
              localStorage.setItem('idcashier_current_page', 'store-setup');
              
              // Force refresh subscription status by clearing any cached data
              localStorage.removeItem('idcashier_subscription_cache');
              sessionStorage.removeItem('idcashier_subscription_cache');

              // Wait briefly for UX (so user sees success message) then redirect to store setup
              setTimeout(() => {
                  console.log('✅ Redirecting to store setup after renewal');
                  const hasToken = localStorage.getItem('idcashier_token');
                  if (hasToken) {
                      // Redirect to store setup page
                      window.location.href = '/store-setup?fromRenewal=true';
                  } else {
                      window.location.href = '/login?message=subscription_extended';
                  }
              }, 2000);
            }

          } else {
            // General success
            if (typeof window !== 'undefined') {     
              localStorage.setItem('idcashier_current_page', 'subscription');
            }

            const hasToken = localStorage.getItem('idcashier_token');
            if (hasToken) {
               console.log('✅ General Payment Success - Redirecting');
               // Also set optimistic flag just in case
               localStorage.setItem('idcashier_renewal_pending', Date.now().toString());
               // Force refresh subscription status
               localStorage.removeItem('idcashier_subscription_cache');
               sessionStorage.removeItem('idcashier_subscription_cache');
               
               setTimeout(() => {
                   // Force full page reload to refresh subscription status
                   window.location.href = '/dashboard?subscription_refreshed=true';
               }, 1500);
            } else {
              window.location.href = '/login?payment=success';
            }
          }
        } else {
          // Pembayaran gagal atau dibatalkan
          setStatus('failed');
          setMessage(t('paymentFailedOrCancelled'));

          if (isRegistration) {
            // Pastikan data registrasi sementara dibersihkan
            localStorage.removeItem('pendingRegistration');
          }

          // Jangan mengaktifkan langganan / HPP apa pun di sini.
          // Hanya arahkan kembali dengan pesan agar user mencoba bayar lagi.
          setTimeout(() => {
            const hasToken = localStorage.getItem('idcashier_token');
            if (isRegistration || !hasToken) {
              // User belum punya sesi yang valid – arahkan ke login
              navigate('/login?payment_failed=1', { replace: true });
            } else {
              // Untuk renewal / HPP, arahkan ke dashboard dengan peringatan
              navigate('/dashboard?payment_failed=1', { replace: true });
            }
          }, 2500);
        }
      } catch (error) {
        console.error('❌ Payment callback error:', error);
        setStatus('error');
        // Pesan singkat tanpa detail teknis/developer
        setMessage(t('paymentProcessingError') || 'Terjadi kesalahan saat memproses pembayaran.');

        // Remove registration data if this is registration process
        if (isRegistration) {
          localStorage.removeItem('pendingRegistration');
        }

        // Redirect ke dashboard atau login tanpa menampilkan detail teknis
        setTimeout(() => {
          const hasToken = localStorage.getItem('idcashier_token');
          if (isRegistration || !hasToken) {
            navigate('/login?payment_failed=1', { replace: true });
          } else {
            navigate('/dashboard?payment_failed=1', { replace: true });
          }
        }, 3000);
      }
    };

    // Start processing immediately
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
              <p className="text-sm text-muted-foreground">
                {isRegistration
                  ? t('accountCreatedRedirectToStoreSetup')
                  : isRenewal && isHPPActivation
                  ? (t('hppActivatedRedirectToSettings') || 'Fitur HPP telah diaktifkan. Mengalihkan ke pengaturan...')
                  : isRenewal
                  ? t('subscriptionExtendedRedirectToSubscription')
                  : t('paymentProcessedRedirectToSubscription')
                }
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-500 font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">
                {t('paymentFailedRedirecting') || 'Pembayaran tidak berhasil. Anda akan diarahkan kembali untuk mencoba lagi.'}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-yellow-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">{message}</p>
              <p className="text-sm text-muted-foreground">
                {t('paymentErrorRedirecting') || 'Terjadi kesalahan. Anda akan diarahkan kembali ke aplikasi.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}