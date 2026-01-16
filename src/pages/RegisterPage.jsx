import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/lib/api';
import mcpRegisterClient from '@/lib/mcpRegisterClient';
import PaymentMethodSelector from '@/components/PaymentMethodSelector';
import GoogleOAuthButton, { performGoogleOAuth } from '@/components/GoogleOAuthButton';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'google'
  const { t } = useLanguage();
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const planName = searchParams.get('plan');
  const planPrice = searchParams.get('price');
  const planDuration = searchParams.get('duration');
  const isPaymentMode = !!planName;

  // Use the custom logo.png file
  const logoUrl = "/logo.png";

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast({ title: t('error'), description: t('allFieldsRequired'), variant: 'destructive' });
      return;
    }

    setAuthMethod('email');
    if (isPaymentMode) {
      setIsPaymentModalOpen(true);
    } else {
      processRegistration();
    }
  };

  const handleGoogleClick = async () => {
    if (isPaymentMode) {
      setAuthMethod('google');
      setIsPaymentModalOpen(true);
    } else {
      await performGoogleOAuth({ t, toast, mode: 'signup' });
    }
  };

  const processRegistration = async (paymentMethodCode = null) => {
    setIsLoading(true);
    try {
      if (isPaymentMode) {
        // Payment Flow: Register without trial, then pay
        let user;
        // Register user WITHOUT trial - explicitly set skipTrial flag
        const registrationResult = await mcpRegisterClient.registerUser({
          name: name,
          email: email,
          password: password,
          role: 'owner',
          skipTrial: true,
          isPriceCardRegistration: true,
          planDuration: planDuration ? parseInt(planDuration, 10) : 1
        });

        console.log('Registration result:', registrationResult);

        if (!registrationResult.success) {
          // Handle "already registered" case - try to login if password matches
          if (registrationResult.error && (
            registrationResult.error.includes('already been registered') ||
            registrationResult.error.includes('already registered')
          )) {
            // Try to login
            const loginResult = await login(email, password);
            if (loginResult.success && loginResult.user) {
              user = loginResult.user;
              // If we logged in, we can proceed to payment.
              // Note: user object might differ slightly in structure, ensure user.id exists
            } else {
              // Login failed (wrong password or other issue)
              throw new Error(t('emailAlreadyRegistered'));
            }
          } else {
            throw new Error(registrationResult.error || t('registrationFailed'));
          }
        } else {
          // Extract user from registration result
          // auth-register returns: { user, token, session, message }
          user = registrationResult.data.user || registrationResult.data;

          console.log('Extracted user:', user);

          // Verify user has id
          if (!user || !user.id) {
            console.error('Invalid user object:', user);
            console.error('Full registration result:', registrationResult);
            throw new Error('Registration succeeded but user data is invalid. Please try logging in.');
          }
        }

        // Call Payment Gateway
        const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentAmount: parseInt(planPrice, 10),
            productDetails: planName,
            customerVaName: name,
            email: email,
            userId: user.id,
            // Gunakan metode yang dipilih user. Jika tidak ada (seharusnya tidak terjadi
            // karena user memilih dari PaymentMethodSelector), biarkan kosong agar
            // edge function yang memutuskan fallback.
            paymentMethod: paymentMethodCode || undefined,
            isRegistration: true
          })
        });

        const paymentData = await paymentResponse.json();
        if (!paymentResponse.ok) throw new Error(paymentData.error || t('paymentRequestFailed'));

        if (paymentData.paymentUrl) {
          // Save pending registration data for callback
          const duration = planDuration ? parseInt(planDuration, 10) : 1;
          console.log('Saving pending registration with duration:', duration);

          localStorage.setItem('pendingRegistration', JSON.stringify({
            name,
            email,
            password,
            planDuration: duration,
            merchantOrderId: paymentData.merchantOrderId,
            useHPP: false, // Default
            role: 'owner'
          }));

          window.location.href = paymentData.paymentUrl;
        } else {
          const errorMessage = paymentData.Message || paymentData.statusMessage || t('paymentUrlNotReceived');
          throw new Error(`Payment Gateway Error: ${errorMessage}`);
        }

      } else {
        // Standard Trial Flow
        const registrationResult = await mcpRegisterClient.registerUserWithTrial({
          name: name,
          email: email,
          password: password,
          role: 'owner'
        });

        if (!registrationResult.success) {
          throw new Error(registrationResult.error || t('registrationFailed'));
        }

        // Check if email verification is needed (trial users need verification)
        const needsVerification = registrationResult.data?.emailVerificationSent === true;

        if (needsVerification) {
          toast({
            title: t('verifyEmailRequired'),
            description: t('verifyEmailDesc'),
            duration: 5000
          });

          // Redirect to login after delay
          setTimeout(() => {
            navigate('/login?verificationPending=true');
          }, 2000);
        } else {
          // User is already verified (shouldn't happen for trial, but just in case)
          toast({
            title: t('registrationSuccessful'),
            description: t('loginSuccess'),
            duration: 3000
          });

          setTimeout(() => {
            navigate('/login');
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: t('error'),
        description: error.message || t('registrationFailedTryAgain'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('register')} - idCashier</title>
        <meta name="description" content={t('registerMetaDesc')} />
      </Helmet>

      <div className="min-h-screen gradient-bg flex flex-col">
        <header className="p-4 flex justify-between items-center">
          <LanguageSelector />
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="glass-effect rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="inline-block mb-4"
                >
                  <img src={logoUrl} alt="idCashier Logo" className="w-24 h-24" onError={(e) => {
                    // Fallback to a simple div with text if image fails to load
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }} />
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl mx-auto"
                    style={{ display: 'none' }}>
                    IC
                  </div>
                </motion.div>
                <h1 className="text-4xl font-bold text-white mb-2">idCashier</h1>
                <p className="text-white/80">{t('tagline')}</p>
              </div>

              {/* Google OAuth Button - Above email form */}
              <GoogleOAuthButton
                mode="signup"
                planName={planName}
                planPrice={planPrice}
                planDuration={planDuration}
                onClick={handleGoogleClick}
              />

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-white/80">atau</span>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">{t('name')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('namePlaceholder')}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">{t('email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('emailPlaceholder')}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">{t('password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('passwordPlaceholder')}
                      required
                      minLength={6}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? t('registering') : (isPaymentMode ? t('registerAndPay') : t('register'))}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-white/80">
                  {t('alreadyHaveAccount')}{' '}
                  <Link
                    to="/login"
                    className="text-white hover:text-white underline transition-colors"
                  >
                    {t('login')}
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <PaymentMethodSelector
          isOpen={isPaymentModalOpen}
          onClose={setIsPaymentModalOpen}
          amount={planPrice}
          onSelect={(method) => {
            setIsPaymentModalOpen(false);
            if (authMethod === 'google') {
              performGoogleOAuth({
                planName,
                planPrice,
                planDuration,
                paymentMethod: method,
                t,
                toast,
                mode: 'signup'
              });
            } else {
              processRegistration(method);
            }
          }}
        />

        <footer className="p-6 text-center text-white/80 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{t('address')}:</span> {t('footerAddress')}
          </p>
          <p className="text-sm">
            <span className="font-semibold">{t('contact')}:</span> {t('footerContact')}
          </p>
        </footer>
      </div>
    </>
  );
}
