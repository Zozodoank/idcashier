import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { invokeFn } from '../lib/invokeFn';
import { subscriptionAPI } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Loader, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import PaymentMethodSelector from '@/components/PaymentMethodSelector';

const RenewalPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [emailInputMode, setEmailInputMode] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const plans = [
    {
      id: '1_month',
      name: t('plan1Month'),
      duration: 1,
      price: 50000,
      pricePerMonth: 50000,
      popular: false
    },
    {
      id: '3_months',
      name: t('plan3Months'),
      duration: 3,
      price: 150000,
      pricePerMonth: 50000,
      popular: false
    },
    {
      id: '6_months',
      name: t('plan6Months'),
      duration: 6,
      price: 250000,
      pricePerMonth: 41666,
      popular: true,
      discount: '17%'
    },
    {
      id: '12_months',
      name: t('plan12Months'),
      duration: 12,
      price: 500000,
      pricePerMonth: 41667,
      popular: false,
      discount: '17%'
    }
  ];

      useEffect(() => {
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('RenewalPage: Force clearing loading state due to timeout');
        setLoading(false);
      }
    }, 10000); // 10 seconds timeout

    const fetchCurrentSubscription = async () => {
      if (token) {
        try {
          // Use centralized API instead of direct invokeFn which was causing issues
          const data = await subscriptionAPI.getCurrentUserSubscription(token);
          
          if (data && data.has_subscription === false) {
            setCurrentSubscription(null);
          } else if (data && data.error) {
            throw new Error(data.error);
          } else {
            setCurrentSubscription(data);
          }
        } catch (error) {
          console.error('Error fetching current subscription:', error);
          toast({
            title: t('error'),
            description: error.message || t('failedLoadSubscriptionData'),
            variant: 'destructive'
          });
          setCurrentSubscription(null);
        } finally {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      } else {
        const emailParam = new URLSearchParams(window.location.search).get('email');
        if (emailParam) {
          setUserEmail(emailParam);
          setEmailInputMode(false);
        } else {
          setEmailInputMode(true);
        }
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    fetchCurrentSubscription();
    
    return () => clearTimeout(safetyTimeout);
  }, [token, toast]);

  const handleRenewal = (planId) => {
    const plan = plans.find(p => p.id === planId);
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  const processPayment = async (paymentMethodCode) => {
    if (!selectedPlan) return;
    const planId = selectedPlan.id;

    // Validate planId before proceeding
    if (!planId || !['1_month', '3_months', '6_months', '12_months'].includes(planId)) {
      console.error('Invalid planId:', planId);
      toast({
        title: t('error'),
        description: t('invalidSubscriptionPackage'),
        variant: 'destructive'
      });
      return;
    }

    // Guard tokenless flow to ensure email is present at call time
    if (!token) {
      const emailFromInput = userEmail || new URLSearchParams(window.location.search).get('email');
      if (!emailFromInput) {
        toast({
          title: t('error'),
          description: t('emailRequiredForPayment'),
          variant: 'destructive'
        });
        return;
      }
    }

    setProcessingPlan(planId);
    try {
      // If no token, use email-based renewal.
      const requestBody = token
        ? { plan_id: planId, paymentMethod: paymentMethodCode }
        : { 
            plan_id: planId, 
            email: userEmail || new URLSearchParams(window.location.search).get('email'),
            paymentMethod: paymentMethodCode,
            returnUrl: `${window.location.origin}/payment-callback?renewal=1`
          };

      // Add returnUrl for authenticated requests too
      if (token) {
        requestBody.returnUrl = `${window.location.origin}/payment-callback?renewal=1`;
      }

      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const data = await invokeFn('renew-subscription-payment', requestBody, { 
        method: 'POST',
        headers
      });

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Renewal payment error:', error);
      // Enhanced error handling with specific messages
      let errorMessage = t('paymentProcessingFailed');
      let errorDescription = error.message || errorMessage;

      // Check for specific error statuses or parse details like in payments.js
      // Special handling for Duitku errors to prevent false positive "Session expired"
      if (error.message?.includes('Duitku') || error.message?.includes('duitku')) {
        errorMessage = t('paymentSystemError');
        errorDescription = `${t('paymentSystemErrorDesc')} Detail: ${error.message}`;
      } else if (error.message?.includes('400') || (error.message && error.message.includes('"code":400'))) {
        errorMessage = t('paymentInvalidParams');
        errorDescription = t('paymentInvalidParamsDesc');
      } else if (error.message?.includes('401') || (error.message && error.message.includes('"code":401'))) {
        errorMessage = t('paymentSessionExpired');
        errorDescription = t('paymentSessionExpiredDesc');
      } else if (error.message?.includes('404') || (error.message && error.message.includes('"code":404'))) {
        errorMessage = t('paymentUserNotFound');
        errorDescription = t('paymentUserNotFoundDesc');
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        errorMessage = t('paymentNetworkError');
        errorDescription = t('paymentNetworkErrorDesc');
      } else {
        // Try to parse structured error from response, similar to payments.js
        try {
          const errorText = error.message || '';
          const jsonMatch = errorText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.error('Parsed error details:', parsed);
            if (parsed.error) {
              errorMessage = parsed.error;
              errorDescription = parsed.details ? JSON.stringify(parsed.details) : t('paymentProcessingError');
            }
          }
        } catch (parseErr) {
          console.error('Could not parse error details:', parseErr);
        }
      }

      toast({
        title: errorMessage,
        description: errorDescription,
        variant: 'destructive'
      });
      setProcessingPlan(null);
    }
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('noData') || 'No data';
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: id });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  const getDaysRemaining = () => {
    if (!currentSubscription?.end_date) return null;
    // Normalize dates to start of day (date-only) to avoid timezone boundary issues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(currentSubscription.end_date);
    endDate.setHours(0, 0, 0, 0);
    return differenceInDays(endDate, today);
  };

  const isExpired = getDaysRemaining() < 0;
  const daysRemaining = Math.abs(getDaysRemaining());

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8" />
        <p className="ml-2">{t('loadingData') || 'Memuat data langganan...'}</p>
      </div>
    );
  }

// ... (previous code)

  // Show email input form if no token and no email in URL
  if (emailInputMode && !token) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('renewSubscription') || 'Perpanjang Langganan'}</h1>
          <p className="text-muted-foreground">{t('enterEmailToContinue') || 'Masukkan email Anda untuk melanjutkan'}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('enterEmail') || 'Masukkan Email'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('email') || 'Email'}</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="nama@email.com"
              />
            </div>
            <Button 
                            onClick={() => {
                if (userEmail) {
                  setEmailInputMode(false);
                } else {
                  toast({
                    title: t('error'),
                    description: t('emailRequired') || 'Email wajib diisi.',
                    variant: 'destructive'
                  });
                }
              }}
              className="w-full"
            >
              {t('continue') || 'Lanjut'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('renewSubscription') || 'Perpanjang Langganan'}</h1>
        <p className="text-muted-foreground">{t('selectPackageForNeeds') || 'Pilih paket yang sesuai dengan kebutuhan Anda'}</p>
      </div>

      {currentSubscription === null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('subscriptionStatus') || 'Status Langganan'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('noActiveSubscription') || 'Anda tidak memiliki langganan aktif. Silakan pilih paket di bawah ini untuk memulai.'}</p>
          </CardContent>
        </Card>
      )}

      {currentSubscription && currentSubscription.has_subscription !== false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('currentSubscriptionStatus') || 'Status Langganan Saat Ini'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('expiryDate') || 'Tanggal Berakhir'}</p>
                <p className="font-semibold">{formatDate(currentSubscription.end_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('status') || 'Status'}</p>
                <Badge variant={isExpired ? 'destructive' : 'default'}>
                  {isExpired ? t('expired') || 'Kadaluwarsa' : t('active') || 'Aktif'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isExpired ? t('expiredDays') || 'Hari Terlewat' : t('daysRemaining') || 'Sisa Hari'}
                </p>
                <p className="font-semibold">{daysRemaining} {t('days') || 'hari'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
            {plan.popular && (
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                {t('mostPopular') || 'Paling Populer'}
              </Badge>
            )}
            {plan.discount && (
              <Badge className="absolute -top-2 right-4 bg-green-500">
                {t('discount') || 'Diskon'} {plan.discount}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-center">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(plan.pricePerMonth)}/{t('month') || 'bulan'}
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t('fullAccessAllFeatures') || 'Akses penuh ke semua fitur'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t('prioritySupport') || 'Dukungan prioritas'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {t('freeUpdates') || 'Pembaruan gratis'}
                </li>
              </ul>
              <Button
                className="w-full"
                onClick={() => handleRenewal(plan.id)}
                disabled={processingPlan === plan.id}
              >
                {processingPlan === plan.id ? (
                  <>
                    <Loader className="animate-spin w-4 h-4 mr-2" />
                    {t('processing') || 'Memproses...'}
                  </>
                ) : (
                  t('selectPackage') || 'Pilih Paket'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" />
          {t('securePaymentViaDuitku') || 'Pembayaran aman via Duitku'}
        </p>
        <Button variant="outline" onClick={() => navigate('/subscription')}>
          {t('back') || 'Kembali'}
        </Button>
      </div>

      <PaymentMethodSelector
        isOpen={isPaymentModalOpen}
        onClose={setIsPaymentModalOpen}
        amount={selectedPlan?.price}
        onSelect={(method) => {
          setIsPaymentModalOpen(false);
          processPayment(method);
        }}
      />
    </div>
  );
};

export default RenewalPage;
