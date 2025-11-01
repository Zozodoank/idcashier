import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, CheckCircle, CreditCard, Loader } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

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
        const { data, error } = await supabase.functions.invoke('subscriptions-get-current-user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (error) throw error;
        
        setCurrentSubscription(data);
      } catch (error) {
        console.error('Error fetching current subscription:', error);
        toast({
          title: 'Error',
          description: 'Gagal memuat data langganan saat ini.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentSubscription();
  }, [token, toast]);

  const handleRenewal = async (planId) => {
    // Validate planId before proceeding
    if (!planId || !['3_months', '6_months', '12_months'].includes(planId)) {
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
        ? { plan: planId }
        : { plan: planId, email: userEmail || new URLSearchParams(window.location.search).get('email') };

      const headers = token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

      console.log('Sending renewal request:', { requestBody, headers });
      // Log supabase functions configuration for debugging
      console.log('Supabase functions config:', { supabaseUrl: supabase.supabaseUrl, functions: supabase.functions });

      const { data, error } = await supabase.functions.invoke(
        'renew-subscription-payment',
        {
          body: JSON.stringify(requestBody),  // Stringify body for consistency with DeveloperPage.jsx
          headers: headers
        }
      );

      // Log response for debugging
      console.log('Renewal API response:', { data, error });

      if (error) throw error;

      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error('Renewal payment error:', error);
      // Enhanced error handling with specific messages
      let errorMessage = 'Gagal memproses pembayaran.';
      let errorDescription = error.message || errorMessage;

      // Check for specific error statuses or parse details like in payments.js
      if (error.status === 400 || error.message?.includes('400')) {
        errorMessage = 'Parameter tidak valid. Pastikan paket langganan dipilih dengan benar.';
      } else if (error.status === 401 || error.message?.includes('401')) {
        errorMessage = 'Sesi login telah berakhir. Silakan login ulang.';
      } else if (error.status === 404 || error.message?.includes('404')) {
        errorMessage = 'Pengguna tidak ditemukan. Periksa email Anda.';
      } else {
        // Try to parse structured error from response, similar to payments.js
        try {
          const errorText = error.message || '';
          const jsonMatch = errorText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.error('Parsed error details:', parsed);
            if (parsed.details) {
              errorDescription = `${parsed.message || errorMessage} | ${JSON.stringify(parsed.details)}`;
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

      {currentSubscription && (
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
