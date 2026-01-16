import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import ThemeToggle from '@/components/ThemeToggle';
import {
  Smartphone, CreditCard, BarChart3, Users, Shield, Zap,
  Menu, X, Globe, HeadphonesIcon, Calculator, Check, Star
} from 'lucide-react';

const LandingPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const { user, logout, login, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [locale, setLocale] = useState('id');

  // Handle Supabase Auth Redirects (Fallback if server redirect config is missing)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=signup')) {
      // Redirect to login for verification success
      navigate('/login?verified=true');
    } else if (hash && hash.includes('type=recovery')) {
      // Redirect to reset password
      navigate('/reset-password');
    }
  }, [navigate]);

  useEffect(() => {
    // Detect browser locale for pricing
    const browserLocale = navigator.language || 'en';
    if (browserLocale.startsWith('id')) {
      setLocale('id');
    } else if (browserLocale.startsWith('zh')) {
      setLocale('zh');
    } else {
      setLocale('en');
    }
  }, []);

  const handleDemo = async () => {
    // For demo purposes, use the predefined demo user credentials
    setIsDemoLoading(true);
    try {
      // Normalize demo email on client side
      const demoEmail = 'demo@idcashier.com';
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
          description: result.error || t('loginFailedDesc'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Demo login failed:', error);
      toast({
        title: t('loginFailed'),
        description: error.message || 'Failed to login to demo account',
        variant: 'destructive'
      });
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleLogout = async () => {
    // Force logout strategy
    localStorage.removeItem('idcashier_token');
    localStorage.removeItem('idcashier_refresh_token');
    localStorage.removeItem('idcashier_current_page');
    logout().catch(console.error);
    window.location.href = '/login';
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  // Function to handle Duitku payment
  const handleDuitkuPayment = async (plan, paymentMethod = 'VC') => {
    if (!user || !token) {
      toast({
        title: t('loginRequired'),
        description: t('pleaseLoginToContinue'),
        variant: 'destructive'
      });
      navigate('/login');
      return;
    }

    setIsDuitkuProcessing(true);
    try {
      // Create payment request to our edge function
      const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentAmount: plan.price,
          productDetails: plan.name,
          customerVaName: user.name || user.email,
          email: user.email,
          phoneNumber: user.phone || '081234567890',
          userId: user.id,
          paymentMethod: paymentMethod
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to create payment request');
      }

      // Redirect to payment page
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        toast({
          title: t('paymentProcessing'),
          description: t('redirectingToPayment'),
        });

        // Fallback - simulate redirect
        setTimeout(() => {
          alert(t('duitkuPaymentFallback'));
          setIsDuitkuProcessing(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Duitku payment error:', error);
      toast({
        title: t('paymentFailed'),
        description: error.message || 'Failed to process payment',
        variant: 'destructive'
      });
      setIsDuitkuProcessing(false);
    }
  };

  // Pricing plans - All languages use Indonesian Rupiah
  const getPricing = () => {
    return {
      currency: 'Rp',
      plans: [
        {
          name: t('landingPlan1Month'),
          price: 50000,
          duration: 1,
          features: [
            t('landingFeatureMultiBranch'),
            t('landingFeatureUnlimitedProducts'),
            t('landingFeatureSalesReports'),
            t('landingFeatureEmailSupport')
          ]
        },
        {
          name: t('landingPlan3Months'),
          price: 150000,
          duration: 3,
          popular: true,
          features: [
            t('landingFeatureAll1Month'),
            t('landingFeaturePrioritySupport'),
            t('landingFeatureExcelExport'),
            t('landingFeatureBarcodeScanner')
          ]
        },
        {
          name: t('landingPlan6Months'),
          price: 250000,
          duration: 6,
          features: [
            t('landingFeatureAll3Months'),
            t('landingFeatureStockManagement'),
            t('landingFeatureAdvancedAnalytics'),
            t('landingFeatureAPIAccess')
          ]
        },
        {
          name: t('landingPlan1Year'),
          price: 500000,
          duration: 12,
          features: [
            t('landingFeatureAll6Months'),
            t('landingFeaturePaymentIntegration'),
            t('landingFeatureCustomDomain'),
            t('landingFeature247Support')
          ]
        }
      ]
    };
  };

  const pricing = getPricing();

  const features = [
    {
      icon: Smartphone,
      title: t('landingFeatureMobile'),
      description: t('landingFeatureMobileDesc')
    },
    {
      icon: CreditCard,
      title: t('landingFeaturePayment'),
      description: t('landingFeaturePaymentDesc')
    },
    {
      icon: BarChart3,
      title: t('landingFeatureReports'),
      description: t('landingFeatureReportsDesc')
    },
    {
      icon: Users,
      title: t('landingFeatureMultiUser'),
      description: t('landingFeatureMultiUserDesc')
    },
    {
      icon: Shield,
      title: t('landingFeatureSecure'),
      description: t('landingFeatureSecureDesc')
    },
    {
      icon: Zap,
      title: t('landingFeatureFast'),
      description: t('landingFeatureFastDesc')
    },
    {
      icon: Calculator,
      title: t('landingFeatureHPP'),
      description: t('landingFeatureHPPDesc')
    }
  ];

  const testimonials = [
    {
      name: 'Budi Santoso',
      content: t('testimonial1Content'),
      rating: 5
    },
    {
      name: 'Siti Nurhaliza',
      content: t('testimonial2Content'),
      rating: 5
    },
    {
      name: 'Ahmad Wijaya',
      content: t('testimonial3Content'),
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black text-gray-900 dark:text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 dark:bg-yellow-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="idCashier Logo" className="w-8 h-8" />
              <span className="text-xl font-bold">idCashier</span>
            </div>

            <nav className="hidden md:flex items-center space-x-6">
              <button onClick={() => scrollToSection('features')} className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                {t('landingFeatures')}
              </button>
              <button onClick={() => scrollToSection('pricing')} className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                {t('landingPricing')}
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="hover:text-blue-600 dark:hover:text-blue-400 transition">
                {t('landingTestimonials')}
              </button>
              <ThemeToggle />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800"
              >
                <option value="id">🇮🇩 ID</option>
                <option value="en">🇬🇧 EN</option>
                <option value="zh">🇨🇳 ZH</option>
              </select>
            </nav>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden md:inline-flex"
                    onClick={() => navigate('/dashboard')}
                  >
                    {t('dashboard')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                  >
                    {t('logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden md:inline-flex"
                    onClick={() => navigate('/login')}
                  >
                    {t('login')}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? <X /> : <Menu />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 space-y-2">
              <button onClick={() => scrollToSection('features')} className="block w-full text-left py-2 hover:text-blue-600 dark:hover:text-blue-400">
                {t('landingFeatures')}
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left py-2 hover:text-blue-600 dark:hover:text-blue-400">
                {t('landingPricing')}
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="block w-full text-left py-2 hover:text-blue-600 dark:hover:text-blue-400">
                {t('landingTestimonials')}
              </button>
              <div className="flex space-x-2 pt-2">
                <ThemeToggle />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800 flex-1"
                >
                  <option value="id">🇮🇩 ID</option>
                  <option value="en">🇬🇧 EN</option>
                  <option value="zh">🇨🇳 ZH</option>
                </select>
              </div>
              <div className="flex space-x-2 pt-2">
                {user ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate('/dashboard')}
                    >
                      {t('dashboard')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={handleLogout}
                    >
                      {t('logout')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate('/login')}
                  >
                    {t('login')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            🚀 {t('landingModernPOS')}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('landingHeroTitle')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            {t('landingHeroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleDemo}
              disabled={isDemoLoading}
            >
              {isDemoLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('landingLoading')}
                </>
              ) : (
                <>
                  🎮 {t('landingTryDemo')}
                </>
              )}
            </Button>

            {/* Free Trial button - shows for all languages */}
            <Button
              size="lg"
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={() => navigate('/register')}
            >
              🆓 {t('freeTrial')}
            </Button>

            {/* Register button */}
            {!user && (
              <Button
                size="lg"
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                onClick={() => navigate('/register')}
              >
                📝 {t('landingRegister')}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-20 px-4 bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landingFeatures')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('landingFeaturesSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landingPricing')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('landingPricingSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {pricing.plans.map((plan, index) => (
              <Card key={index} className={`relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-600">
                      {t('landingMostPopular')}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold mt-4">
                    {pricing.currency}{plan.price.toLocaleString('id-ID')}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {t('landingPerMonth')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => {
                      // For new registration (price card), always redirect to register page
                      navigate(`/register?plan=${plan.name}&price=${plan.price}&duration=${plan.duration}`);
                    }}
                  >
                    {t('landingSubscribe')}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="relative z-10 py-20 px-4 bg-white/50 dark:bg-gray-800/50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landingTestimonials')}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              {t('landingTestimonialsSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex justify-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 italic text-center">
                    "{testimonial.content}"
                  </p>
                  <p className="font-semibold text-center">- {testimonial.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo.png" alt="idCashier Logo" className="w-8 h-8" />
                <span className="text-xl font-bold">idCashier</span>
              </div>
              <p className="text-gray-400">
                {t('landingHeroSubtitle').slice(0, 50)}...
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">
                {t('landingServices')}
              </h3>
              <ul className="space-y-2 text-gray-400">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition">{t('landingFeatures')}</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition">{t('landingPricing')}</button></li>
                <li><button onClick={() => scrollToSection('testimonials')} className="hover:text-white transition">{t('landingDemo')}</button></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">
                {t('landingCompany')}
              </h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/about" className="hover:text-white transition">{t('landingAbout')}</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition">{t('landingPrivacy')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition">{t('landingTerms')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">
                {t('landingContact')}
              </h3>
              <div className="space-y-2 text-gray-400">
                <p className="flex items-start space-x-2">
                  <Globe className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span>{t('landingAddress')}</span>
                </p>
                <p className="flex items-center space-x-2">
                  <HeadphonesIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{t('landingPhone')}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2024 idCashier. {t('landingRightsReserved')}</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
