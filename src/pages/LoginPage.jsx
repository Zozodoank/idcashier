import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Info, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import GoogleOAuthButton from '@/components/GoogleOAuthButton';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const { login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    // Add a check to prevent redirect loops if the user just logged out
    // If the URL contains an error or verification params, do not auto-redirect
    const params = new URLSearchParams(window.location.search);
    const hasError = window.location.hash.includes('error=') || params.get('error');
    const isVerification = params.get('verificationPending') || params.get('verified');
    
    // Safety delay to ensure state is stable
    const timer = setTimeout(() => {
      if (isAuthenticated && !hasError && !isVerification) {
        console.log('Already authenticated, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate]);

  // Handle email verification redirect
  // Ensure no infinite loops by using navigate replace
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    // Handle Hash Errors (Supabase returns errors in hash)
    if (hash && hash.includes('error=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const error = hashParams.get('error');
  // Remove automatic redirect to prevent double redirect issues
  // User will be redirected manually after successful login
  // useEffect(() => {
  //   if (isAuthenticated) {
  //     navigate('/dashboard', { replace: true });
  //   }
  // }, [isAuthenticated, navigate]);
      const errorDescription = hashParams.get('error_description');
      const errorCode = hashParams.get('error_code');

      if (error) {
        let description = errorDescription?.replace(/\+/g, ' ') || t('errorVerification');
        
        // Translate common error codes (email verification is now disabled)
        if (errorCode === 'otp_expired') {
          description = t('errorOtpExpired');
          // Show resend button for expired OTP
          setShowResend(true);
        }
        // Email verification is no longer required - all users are auto-verified
        // Removed email_not_confirmed error handling

        toast({
          title: t('verificationFailed'),
          description: description,
          variant: "destructive"
        });
        
        // Clear URL but stay on login page
        navigate('/login', { replace: true });
        return; // Stop further processing
      }
    }
    
    if (params.get('verificationPending') === 'true') {
      setVerificationPending(true);
      // Clear param using navigate to ensure router state is clean
      navigate('/login', { replace: true });
    }

    if (params.get('verified') === 'true') {
      toast({
        title: t('verificationSuccess'),
        description: t('verificationSuccessDesc'),
        variant: "default",
        className: "bg-green-600 text-white border-green-600"
      });
      
      // Clean up URL immediately via navigate
      navigate('/login', { replace: true });
    }
  }, []); // Empty dependency array to run once on mount
  
  // Use the custom logo.png file
  const logoUrl = "/logo.png";

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Normalize email on client side
      const normalizedEmail = email.trim().toLowerCase();
      
      const result = await login(normalizedEmail, password);
      
      // Check for subscription expired
      if (!result.success && result.subscriptionExpired) {
        toast({
          title: t('subscriptionExpired'),
          description: result.error || t('subscriptionExpiredDesc'),
          variant: 'destructive',
        });
        
        // Redirect to renewal page after 2 seconds
                setTimeout(() => {
          navigate(`/renewal?email=${encodeURIComponent(normalizedEmail)}`);
        }, 2000);
        
        return;
      }
      
      if (result.success) {
        toast({
          title: `${t('welcome')} ${result.user.name || result.user.email}!`,
          description: t('loginSuccess'),
        });
        // Redirect to dashboard after successful login
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 200);
        // Redirect to dashboard after successful login
        // Increased timeout to ensure state update is complete
        setTimeout(() => {
          console.log('🔄 Redirecting to dashboard after login success');
          navigate('/dashboard', { replace: true });
        }, 500);
      } else {
        // Add hint for user if login fails
        const errorMessage = result.error || '';
        const errorDescription = errorMessage.includes('password') 
          ? `${errorMessage} ${t('loginHint')}`
          : errorMessage;
          
        // Email verification is no longer required - all users are auto-verified
        // Removed email verification error handling

        toast({
          title: t('loginFailed'),
          description: errorDescription,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error.message || '';
      
      // If it's an invalid credentials error, we might want to show a more specific message
      if (errorMessage.includes('Invalid login credentials')) {
        toast({
          title: t('loginFailed'),
          description: `${t('invalidCredentials')} ${t('loginHint')}`,
          variant: 'destructive',
        });
      } else {
        // Email verification is no longer required - all users are auto-verified
        // Removed email verification error handling
        
        toast({
          title: t('loginFailed'),
          description: errorMessage || t('loginFailedDesc'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      toast({
        title: t('emailRequired'),
        description: t('emailRequiredDesc'),
        variant: 'destructive'
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      toast({
        title: t('emailInvalid'),
        description: t('emailInvalidDesc'),
        variant: 'destructive'
      });
      return;
    }

    setResendLoading(true);
    try {
      // Get the current site URL from environment or use default
      const siteUrl = import.meta.env.VITE_SITE_URL || 'https://idcashier.my.id';
      
      console.log('Attempting to resend verification for:', normalizedEmail);
      
      // For existing users, use the signup type to resend confirmation
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${siteUrl}/login`
        }
      });

      if (error) {
        console.error('Resend verification error:', error);
        throw error;
      }

      console.log('Verification email resent successfully');
      
      toast({
        title: t('verificationSent'),
        description: t('verificationSentDesc'),
        variant: 'default',
        duration: 8000,
      });
      setShowResend(false);
    } catch (error) {
      console.error('Failed to resend verification:', error);
      
      // Provide specific error messages
      let errorMessage = t('verificationSendFailed');
      
      if (error.message?.includes('rate_limit') || error.message?.includes('Too many requests')) {
        errorMessage = t('errorTooManyRequests');
      } else if (error.message?.includes('email_not_found') || error.message?.includes('not found')) {
        errorMessage = t('errorEmailNotFound');
      } else if (error.message?.includes('already confirmed')) {
        // Email verification is no longer required - all users are auto-verified
        // Removed already confirmed error handling
      } else if (error.message?.includes('email address')) {
        errorMessage = t('errorEmailInvalid');
      }
      
      toast({
        title: t('sendFailed'),
        description: errorMessage,
        variant: 'destructive',
        duration: 8000,
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleDemo = async () => {
    // For demo purposes, use the predefined demo user credentials
    setIsLoading(true);
    try {
      // Normalize demo email on client side
      const demoEmail = 'demo@idcashier.my.id';
      const normalizedDemoEmail = demoEmail.trim().toLowerCase();
      
      const result = await login(normalizedDemoEmail, 'Demo2025');
      
      if (result.success) {
        toast({
          title: `${t('welcome')} ${result.user.name || result.user.email}!`,
          description: t('loginSuccess'),
        });
        // Redirect to dashboard after successful demo login
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 200);
      } else {
        toast({
          title: t('loginFailed'),
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('loginFailed'),
        description: error.message || t('loginFailedDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('login')} - idCashier</title>
        <meta name="description" content={t('loginMetaDesc')} />
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
              <GoogleOAuthButton mode="login" />

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-white/80">{t('or')}</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
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
                  <div className="text-right">
                    <Link 
                      to="/reset-password" 
                      className="text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {t('forgotPassword')}?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? t('loggingIn') : t('login')}
                </Button>

                {/* Email verification resend button is disabled - all users are auto-verified */}
                {showResend && (
                  <Button
                    type="button"
                    onClick={handleResendVerification}
                    variant="secondary"
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                    disabled={resendLoading || isLoading}
                  >
                    {resendLoading ? t('resending') : t('resendVerification')}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={handleDemo}
                  variant="outline"
                  className="w-full border-white/30 text-white hover:bg-white/10 bg-transparent mt-4"
                  disabled={isLoading}
                >
                  {t('demoMode')}
                </Button>

                <div className="text-center text-white/80 mt-4">
                  {t('noAccount')} {' '}
                  <Link to="/register" className="font-semibold text-white hover:underline">
                    {t('register')}
                  </Link>
                </div>
              </form>
            </div>
          </motion.div>
        </div>

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
};

export default LoginPage;
