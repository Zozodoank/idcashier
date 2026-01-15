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

          // Payment successful - Activate subscription via auth-register
          // User sudah diregister sebelumnya, tapi perlu call auth-register dengan paymentCompleted=true
          // untuk aktivasi subscription
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
              // No pending data, user might be logged in already (OAuth), just redirect
              toast({
                title: t('paymentSuccessful'),
                description: 'Pembayaran berhasil! Mengarahkan ke setup toko...',
              });

              setTimeout(() => {
                navigate('/store-setup', { replace: true, state: { fromPayment: true } });
              }, 1500);
              return;
            }

            console.log('💳 Processing payment callback - redirecting to setup');
            console.log('📋 Pending registration data:', {
              email: pendingRegistration.email,
              hasPassword: !!pendingRegistration.password,
              oauthProvider: pendingRegistration.oauthProvider
            });

            // Subscription activation is handled by server-side callback (duitku-callback)
            // We just need to ensure the user is logged in here and redirect.
            console.log('ℹ️ Skipping frontend activation (handled by backend)');

            // Check if this is OAuth (no password) or email/password registration
            const isOAuthRegistration = !pendingRegistration.password || pendingRegistration.oauthProvider === 'google';

            if (isOAuthRegistration) {
              // OAuth user - should be logged in via session persistence
              console.log('✅ OAuth user - verifying session...');

              // 1. Check Session
              const { data: { session } } = await supabase.auth.getSession();

              if (!session) {
                // Try to recover from localStorage manual token
                const manualToken = localStorage.getItem('idcashier_token');
                if (manualToken) {
                  console.log('🔄 Recovering session from manual token...');
                  const { error: recoveryError } = await supabase.auth.setSession({
                    access_token: manualToken,
                    refresh_token: manualToken // This might not work if it's just access token, but worth a try or just rely on access token being present implies auth
                  });
                }
              }

              // 2. SAFETY NET: Check & Create Profile if missing
              const currentUser = session?.user || (await supabase.auth.getUser()).data.user;

              if (currentUser) {
                // Direct DB check
                const { data: profile } = await supabase.from('users').select('id').eq('id', currentUser.id).maybeSingle();

                if (!profile) {
                  console.log('⚠️ Profile missing for OAuth User - Invoking Server-Side Rescue...');
                  // Use SERVER-SIDE creation (Bypass RLS) via auth-register
                  const { error: rescueError } = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${localStorage.getItem('idcashier_token') || session?.access_token}`,
                    },
                    body: JSON.stringify({
                      userId: currentUser.id,
                      email: currentUser.email,
                      name: pendingRegistration?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
                      role: 'owner',
                      isPriceCardRegistration: true,
                      paymentCompleted: true
                    })
                  }).then(res => res.json());

                  if (rescueError) {
                    console.error('❌ Rescue failed:', rescueError);
                  } else {
                    console.log('✅ Server-side profile rescue successful.');
                  }
                }
              }

              // Wait a bit for auth context to update
              await new Promise(resolve => setTimeout(resolve, 500));

              localStorage.removeItem('pendingRegistration');

              toast({
                title: t('registrationSuccessful'),
                description: 'Pembayaran berhasil! Mengarahkan ke setup toko...',
              });

              // Use window.location.href instead of navigate to force full page reload
              setTimeout(() => {
                window.location.href = '/store-setup';
              }, 1000);

            } else {
              // Email/Password user - need to login
              console.log('✅ Email/Password user - logging in after payment');
              console.log('📋 Login attempt with email:', pendingRegistration.email);

              try {
                // Login user
                const loginRes = await login(pendingRegistration.email, pendingRegistration.password);

                console.log('📋 Login result:', {
                  success: loginRes.success,
                  hasUser: !!loginRes.user,
                  hasToken: !!loginRes.token,
                  error: loginRes.error
                });

                // If login successful, check profile
                if (loginRes.success && loginRes.user) {
                  // Save token to localStorage
                  if (loginRes.token) {
                    localStorage.setItem('idcashier_token', loginRes.token);
                    console.log('✅ Token saved to localStorage after login');
                  }

                  // Set Supabase session if available
                  if (loginRes.session) {
                    try {
                      await supabase.auth.setSession({
                        access_token: loginRes.session.access_token,
                        refresh_token: loginRes.session.refresh_token
                      });
                      console.log('✅ Supabase session set after login');
                    } catch (sessionError) {
                      console.warn('⚠️ Could not set Supabase session:', sessionError);
                    }
                  }

                  const { data: profile } = await supabase.from('users').select('id').eq('id', loginRes.user.id).maybeSingle();
                  if (!profile) {
                    console.log('⚠️ Profile missing for Email User - Invoking Server-Side Rescue...');
                    const rescueRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
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
                    const rescueData = await rescueRes.json();
                    if (rescueData.success) {
                      console.log('✅ User profile created via rescue');
                    } else {
                      console.error('❌ Rescue failed:', rescueData.error);
                    }
                  } else {
                    console.log('✅ User profile exists');
                  }

                  console.log('✅ Login successful after payment');

                  // Wait a bit for auth context to update
                  await new Promise(resolve => setTimeout(resolve, 500));

                  localStorage.removeItem('pendingRegistration');
                  toast({
                    title: t('registrationSuccessful'),
                    description: 'Pembayaran berhasil! Akun Anda telah aktif. Mengarahkan ke setup toko...',
                  });

                  // Use window.location.href instead of navigate to force full page reload
                  // This ensures auth context is properly refreshed
                  setTimeout(() => {
                    window.location.href = '/store-setup';
                  }, 1000);
                  return; // Early return on success
                }

                if (!loginRes.success) {
                  console.error('❌ Login failed:', loginRes.error);
                  // Don't throw immediately, try fallback session check
                }

              } catch (loginError) {
                console.error('Login attempt error:', loginError);
              }

              // Fallback: Try to get session directly from Supabase
              try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (!sessionError && session) {
                  // Session exists, refresh user profile and redirect
                  console.log('✅ Found existing session after payment');
                  localStorage.setItem('idcashier_token', session.access_token);

                  // Safety profile check here too
                  const { data: profile } = await supabase.from('users').select('id').eq('id', session.user.id).maybeSingle();
                  if (!profile) {
                    console.log('⚠️ Profile missing, creating via auth-register...');
                    const rescueRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-register`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        userId: session.user.id,
                        email: session.user.email,
                        name: pendingRegistration?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
                        role: 'owner',
                        paymentCompleted: true
                      })
                    });
                    const rescueData = await rescueRes.json();
                    if (rescueData.success) {
                      console.log('✅ User profile created via rescue');
                    } else {
                      console.error('❌ Rescue failed:', rescueData.error);
                    }
                  }

                  // Wait a bit for auth context to update
                  await new Promise(resolve => setTimeout(resolve, 500));

                  toast({
                    title: t('registrationSuccessful'),
                    description: 'Pembayaran berhasil! Akun Anda telah aktif. Mengarahkan ke setup toko...',
                  });

                  // Use window.location.href instead of navigate to force full page reload
                  setTimeout(() => {
                    window.location.href = '/store-setup';
                  }, 1000);
                  return;
                } else {
                  console.log('⚠️ No session found, checking localStorage token...');
                  // Try to use token from localStorage
                  const storedToken = localStorage.getItem('idcashier_token');
                  if (storedToken) {
                    console.log('✅ Found token in localStorage, attempting to set session...');
                    try {
                      const { data: { user: userFromToken }, error: userError } = await supabase.auth.getUser(storedToken);
                      if (!userError && userFromToken) {
                        console.log('✅ User found from token, redirecting to store-setup...');
                        // Set session for Supabase
                        try {
                          await supabase.auth.setSession({
                            access_token: storedToken,
                            refresh_token: storedToken
                          });
                        } catch (e) {
                          console.warn('Could not set session from token:', e);
                        }

                        toast({
                          title: t('registrationSuccessful'),
                          description: 'Pembayaran berhasil! Akun Anda telah aktif. Mengarahkan ke setup toko...',
                        });

                        // Wait a bit for auth context to update
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // Use window.location.href instead of navigate to force full page reload
                        setTimeout(() => {
                          window.location.href = '/store-setup';
                        }, 1000);
                        return;
                      }
                    } catch (tokenError) {
                      console.error('❌ Error getting user from token:', tokenError);
                    }
                  }
                }
              } catch (sessionCheckError) {
                console.error('Session check error:', sessionCheckError);
              }

              // If no session found after payment success, try to recover or redirect to store-setup
              // The backend callback should have already created the subscription
              console.log('⚠️ No session found after payment, attempting recovery...');

              // Check if we have pending registration data with email
              if (pendingRegistration?.email) {
                toast({
                  title: t('paymentSuccessful'),
                  description: 'Pembayaran berhasil! Silakan login untuk melanjutkan setup toko.',
                  variant: 'default'
                });

                localStorage.removeItem('pendingRegistration');

                setTimeout(() => {
                  navigate('/login?payment=success&email=' + encodeURIComponent(pendingRegistration.email), { replace: true });
                }, 2000);
              } else {
                // No email found, but payment was successful - redirect to store-setup anyway
                // The user might be logged in via OAuth but session not detected
                toast({
                  title: t('paymentSuccessful'),
                  description: 'Pembayaran berhasil! Mengarahkan ke setup toko...',
                  variant: 'default'
                });

                localStorage.removeItem('pendingRegistration');

                setTimeout(() => {
                  window.location.href = '/store-setup?fromPayment=true';
                }, 2000);
              }
            }

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
        // User-friendly error message dengan spasi yang benar
        const errorMessage = error.message || 'Terjadi kesalahan saat memproses pembayaran.';
        // Ensure error message has proper spacing
        const formattedError = errorMessage.replace(/([a-z])([A-Z])/g, '$1 $2');
        setMessage(t('paymentProcessingError') || formattedError);

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
