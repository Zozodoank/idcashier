import React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';

// Export the logic for reuse
export const performGoogleOAuth = async ({ planName, planPrice, planDuration, paymentMethod, t, toast, mode = 'signup' }) => {
  try {
    // If plan details are provided, store them before redirecting
    if (planName && planPrice && planDuration) {
      const planDetails = { planName, planPrice, planDuration, paymentMethod };
      localStorage.setItem('pendingOAuthPlan', JSON.stringify(planDetails));
      console.log('📝 Storing pending OAuth plan details:', planDetails);
    }

    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    let redirectTo = `${siteUrl}/auth/callback`;

    // Append plan details to redirect URL to persist state across OAuth flow
    // This is more reliable than localStorage which might be cleared or inaccessible
    if (planName) {
      const params = new URLSearchParams();
      params.append('plan', planName);
      if (planPrice) params.append('price', planPrice);
      if (planDuration) params.append('duration', planDuration);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);
      redirectTo = `${redirectTo}?${params.toString()}`;
    }

    console.log('🔐 Initiating Google OAuth with redirect:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }

    // The redirect will happen automatically
    console.log('✅ Google OAuth redirect initiated');
    return true;
  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    if (toast && t) {
      toast({
        title: mode === 'login' ? t('googleLoginError') : t('googleSignUpError'),
        description: error.message || 'An error occurred during Google authentication',
        variant: 'destructive',
      });
    }
    throw error;
  }
};

const GoogleOAuthButton = ({ mode = 'login', planName, planPrice, planDuration, onClick }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      if (onClick) {
        // If external handler provided, use it
        await onClick();
      } else {
        // Use internal logic
        await performGoogleOAuth({ planName, planPrice, planDuration, t, toast, mode });
      }
    } catch (error) {
      // Error already handled in performGoogleOAuth or external handler should handle it
      setIsLoading(false);
    }
  };

  // Google Brand Guidelines compliant button
  // Colors: white background, #4285F4 blue, #34A853 green, #FBBC05 yellow, #EA4335 red
  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      disabled={isLoading}
      className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm py-2.5 px-4 rounded border border-gray-300 shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        fontFamily: 'Roboto, sans-serif',
        minHeight: '40px',
      }}
    >
      {/* Google Logo SVG */}
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span>
        {isLoading 
          ? (mode === 'login' ? t('loggingIn') : t('registering'))
          : (mode === 'login' ? t('loginWithGoogle') : t('signUpWithGoogle'))
        }
      </span>
    </button>
  );
};

export default GoogleOAuthButton;
