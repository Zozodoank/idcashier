import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { invokeFn } from '../lib/invokeFn';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Loader, Calendar, CreditCard, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const RenewalPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token } = useAuth();
  const { toast } = useToast();
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [emailInputMode, setEmailInputMode] = useState(false);

  const plans = [
    {
      id: '1_month',
      name: '1 Bulan',
      duration: 1,
      price: 50000,
      pricePerMonth: 50000,
      popular: false
    },
    {
      id: '3_months',
      name: '3 Bulan',
      duration: 3,
      price: 150000,
      pricePerMonth: 50000,
      popular: false
    },
    {
      id: '6_months',
      name: '6 Bulan',
      duration: 6,
      price: 270000,
      pricePerMonth: 45000,
      popular: true,
      discount: '10%'
    },
    {
      id: '12_months',
      name: '12 Bulan',
      duration: 12,
      price: 500000,
      pricePerMonth: 41667,
      popular: false,
      discount: '17%'
    }
  ];

      useEffect(() => {
    const fetchCurrentSubscription = async () => {
      // If no token, check for email in URL params or show input form
      if (!token) {
        const emailParam = new URLSearchParams(window.location.search).get('email');
        if (emailParam) {
          setUserEmail(emailParam);
          setEmailInputMode(false);
          // Try to fetch subscription by email (would need a new endpoint)
          setLoading(false);
          return;
        } else {
          setEmailInputMode(true);
          setLoading(false);
          return;
        }
      }
      
      try {
        // Pass token in headers for authenticated requests
        const data = await invokeFn('subscriptions-get-current-user', null, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Check if user has a subscription
        if (data && data.has_subscription === false) {
          // User has no subscription, set to null to show appropriate UI
          setCurrentSubscription(null);
        } else if (data && data.error) {
          // Error occurred in the function
          throw new Error(data.error);
        } else {
          // Valid subscription data
          setCurrentSubscription(data);
        }
      } catch (error) {
        console.error('Error fetching current subscription:', error);
        toast({
          title: 'Error',
          description: error.message || 'Gagal memuat data langganan saat ini.',
          variant: 'destructive'
        });
        // Set subscription to null on error to avoid showing invalid data
        setCurrentSubscription(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentSubscription();
  }, [token, toast]);

      const handleRenewal = async (planId) => {
    // Validate planId before proceeding
    if (!planId || !['1_month', '3_months', '6_months', '12_months'].includes(planId)) {
      console.error('Invalid planId:', planId);
      toast({
        title: 'Error',
        description: 'Paket langganan tidak valid.',
        variant: 'destructive'
      });
      return;
    }

    // Guard tokenless flow to ensure email is present at call time
    if (!token) {
      const emailFromInput = userEmail || new URLSearchParams(window.location.search).get('email');
      if (!emailFromInput) {
        toast({
          title: 'Error',
          description: 'Email diperlukan untuk melanjutkan pembayaran.',
          variant: 'destructive'
        });
        return;
      }
    }

    setProcessingPlan(planId);
    try {
      // If no token, use email-based renewal
      const requestBody = token
        ? { plan_id: planId }  // Use plan_id for consistency
        : { plan_id: planId, email: userEmail || new URLSearchParams(window.location.search).get('email') };

            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const data = await invokeFn('renew-subscription-payment', requestBody, { 
        method: 'POST',
        headers
      });

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Renewal payment error:', error);
      // Enhanced error handling with specific messages
      let errorMessage = 'Gagal memproses pembayaran.';
      let errorDescription = error.message || errorMessage;

      // Check for specific error statuses or parse details like in payments.js
      if (error.message?.includes('400') || (error.message && error.message.includes('"code":400'))) {
        errorMessage = 'Parameter tidak valid. Pastikan paket langganan dipilih dengan benar.';
        errorDescription = 'Periksa kembali data yang Anda masukkan dan coba lagi.';
      } else if (error.message?.includes('401') || (error.message && error.message.includes('"code":401'))) {
        errorMessage = 'Sesi login telah berakhir. Silakan login ulang.';
        errorDescription = 'Anda perlu login kembali untuk melanjutkan pembayaran.';
      } else if (error.message?.includes('404') || (error.message && error.message.includes('"code":404'))) {
        errorMessage = 'Pengguna tidak ditemukan. Periksa email Anda.';
        errorDescription = 'Pastikan email yang Anda masukkan sudah terdaftar.';
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Koneksi bermasalah.';
        errorDescription = 'Periksa koneksi internet Anda dan coba lagi.';
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
              errorDescription = parsed.details ? JSON.stringify(parsed.details) : 'Terjadi kesalahan saat memproses pembayaran.';
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
    if (!dateString) return 'Tidak ada data';
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
        <p className="ml-2">Memuat data...</p>
      </div>
    );
  }

  // Show email input form if no token and no email in URL
  if (emailInputMode && !token) {
    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Perpanjang Langganan</h1>
          <p className="text-muted-foreground">Masukkan email Anda untuk melanjutkan</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Masukkan Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
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
                  setLoading(true);
                  // Reload with email in URL
                  window.history.replaceState({}, '', `?email=${encodeURIComponent(userEmail)}`);
                  window.location.reload();
                } else {
                  toast({
                    title: 'Error',
                    description: 'Email harus diisi',
                    variant: 'destructive'
                  });
                }
              }}
              className="w-full"
            >
              Lanjutkan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Perpanjang Langganan</h1>
        <p className="text-muted-foreground">Pilih paket yang sesuai dengan kebutuhan Anda</p>
      </div>

      {currentSubscription === null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Status Langganan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Anda belum memiliki langganan aktif. Silakan pilih paket di bawah untuk memulai.</p>
          </CardContent>
        </Card>
      )}

      {currentSubscription && currentSubscription.has_subscription !== false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Status Langganan Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tanggal Berakhir</p>
                <p className="font-semibold">{formatDate(currentSubscription.end_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={isExpired ? 'destructive' : 'default'}>
                  {isExpired ? 'Expired' : 'Active'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isExpired ? 'Hari Terlewat' : 'Sisa Hari'}
                </p>
                <p className="font-semibold">{daysRemaining} hari</p>
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
                Paling Populer
              </Badge>
            )}
            {plan.discount && (
              <Badge className="absolute -top-2 right-4 bg-green-500">
                Diskon {plan.discount}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-center">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{formatCurrency(plan.price)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(plan.pricePerMonth)}/bulan
                </p>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Akses penuh semua fitur
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Support prioritas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Update gratis
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
                    Memproses...
                  </>
                ) : (
                  'Pilih Paket'
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" />
          Pembayaran aman melalui Duitku
        </p>
        <Button variant="outline" onClick={() => navigate('/subscription')}>
          Kembali
        </Button>
      </div>
    </div>
  );
};

export default RenewalPage;
