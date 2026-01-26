import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { settingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHPP } from '@/contexts/HPPContext';
import { supabase } from '@/lib/supabaseClient';
import { Users, DollarSign, CreditCard, CheckCircle, Info } from 'lucide-react';
import PaymentMethodSelector from '@/components/PaymentMethodSelector';

const HPPSettings = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { hppEnabled, loading, hppStatus, refreshHPPSetting } = useHPP();

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('3_months');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [employeeStats, setEmployeeStats] = useState({
    totalActive: 0,
    totalBaseSalary: 0
  });

  useEffect(() => {
    checkSubscriptionStatus();
    loadEmployeeStats();
  }, []);

  // HAPUS: Tidak perlu lagi loadSettings manual HPP, cukup context!

  const checkSubscriptionStatus = async () => {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      if (subscription) {
        setSubscriptionData(subscription);
        const endDate = new Date(subscription.end_date);
        const now = new Date();
        const isActive = endDate > now;
        setIsSubscriptionActive(isActive);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const loadEmployeeStats = async () => {
    try {
      // Fetch active employees for current user/tenant
      const tenantId = user?.role === 'cashier' ? user.tenantId : user?.id;
      const { data: employees, error } = await supabase
        .from('employees')
        .select('base_salary, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) throw error;

      // Calculate total active and total base salary
      const totalActive = employees?.length || 0;
      const totalBaseSalary = employees?.reduce((sum, emp) => sum + (emp.base_salary || 0), 0) || 0;

      setEmployeeStats({
        totalActive,
        totalBaseSalary
      });
    } catch (error) {
      console.error('Error loading employee stats:', error);
      // Don't show error toast, just log it
    }
  };

  const handleActivateHPP = () => {
    // Check if user is demo or developer (whitelisted accounts)
    const isWhitelistedAccount = user?.email === 'demo@idcashier.com' || user?.email === 'jho.j80@gmail.com';

    if (isWhitelistedAccount) {
      toast({
        title: 'Info',
        description: 'Fitur HPP sudah aktif untuk akun demo dan developer.'
      });
      return;
    }

    if (hppEnabled) {
      if (isSubscriptionActive) {
        toast({
          title: 'Info',
          description: `Fitur HPP aktif hingga ${new Date(subscriptionData?.end_date).toLocaleDateString('id-ID')}.`
        });
      } else {
        toast({
          title: 'Info',
          description: 'Fitur HPP sudah aktif di akun Anda.'
        });
      }
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast({
        title: t('paymentMethodRequired') || 'Metode Pembayaran Diperlukan',
        description: t('pleaseSelectPaymentMethod') || 'Silakan pilih metode pembayaran terlebih dahulu.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Use same pricing as RenewalPage
      const plans = {
        '1_month': { months: 1, price: 50000, name: '1 Bulan' },
        '3_months': { months: 3, price: 150000, name: '3 Bulan' },
        '6_months': { months: 6, price: 250000, name: '6 Bulan', popular: true, discount: '17%' },
        '12_months': { months: 12, price: 500000, name: '12 Bulan', discount: '17%' }
      };

      const plan = plans[selectedPlan];
      if (!plan) {
        throw new Error('Invalid plan selected');
      }

      // Use create-renewal-payment edge function (protected; requires user token)
      const { invokeFn } = await import('@/lib/invokeFn');
      const requestBody = {
        plan_id: selectedPlan,
        email: user.email,
        paymentMethod: paymentMethod, // Removed ALL check since we removed the option
        hppActivation: true, // Flag for HPP activation
        returnUrl: `${window.location.origin}/payment-callback?renewal=1&hpp=1`
      };

      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const result = await invokeFn('create-renewal-payment', requestBody, {
        method: 'POST',
        headers
      });

      if (result.error) {
        throw new Error(result.error || result.message || 'Failed to create payment request');
      }

      // Save pending HPP activation flag
      localStorage.setItem('pendingHPPActivation', JSON.stringify({
        planId: selectedPlan,
        planMonths: plan.duration,
        userId: user.id
      }));

      // Redirect to payment page
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        throw new Error('Payment URL not received');
      }
    } catch (error) {
      console.error('HPP payment error:', error);
      toast({
        title: t('error'),
        description: error.message || 'Gagal memproses pembayaran.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan HPP (Harga Pokok Penjualan)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Memuat pengaturan...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengaturan HPP (Harga Pokok Penjualan)</CardTitle>
        <CardDescription>
          Aktifkan fitur ini untuk melacak biaya produksi dan menghitung profit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* HPP Explanation */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Apa itu HPP (Harga Pokok Penjualan)?
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>
                  <strong>HPP</strong> adalah total biaya yang dikeluarkan untuk memproduksi atau memperoleh barang yang dijual.
                  Fitur ini membantu Anda:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Menghitung profit margin yang akurat</li>
                  <li>Melacak biaya produksi per item</li>
                  <li>Menganalisis profitabilitas produk</li>
                  <li>Membuat keputusan harga yang tepat</li>
                  <li>Mengelola biaya karyawan dan operasional</li>
                </ul>
                <p className="mt-3">
                  <strong>Contoh:</strong> Jika Anda menjual kopi seharga Rp 15.000 dengan HPP Rp 8.000,
                  maka profit Anda adalah Rp 7.000 (46.7% margin).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Activation Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {hppEnabled ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <DollarSign className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <Label className="text-base font-medium">
                Status Fitur HPP
              </Label>
              <p className="text-sm text-muted-foreground">
                {(() => {
                  if (!hppEnabled) return 'Belum aktif';

                  if (hppStatus?.isTrial) {
                    return hppStatus.trialEndDate ?
                      `Aktif (Trial hingga ${new Date(hppStatus.trialEndDate).toLocaleDateString('id-ID')})` :
                      'Aktif (Trial)';
                  }

                  if (isSubscriptionActive && subscriptionData?.end_date) {
                    return `Aktif (Berlaku hingga ${new Date(subscriptionData.end_date).toLocaleDateString('id-ID')})`;
                  }

                  const isWhitelistedAccount = user?.email === 'demo@idcashier.com' || user?.email === 'jho.j80@gmail.com';
                  return isWhitelistedAccount ? 'Aktif' : 'Sudah aktif';
                })()}
              </p>
            </div>
          </div>
          <Button
            onClick={handleActivateHPP}
            disabled={hppEnabled}
            className={hppEnabled ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            {hppEnabled ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {(user?.email === 'demo@idcashier.com' || user?.email === 'jho.j80@gmail.com') ? 'Whitelist' :
                  (isSubscriptionActive ? 'Langganan Aktif' : 'Aktif')}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Aktifkan HPP
              </>
            )}
          </Button>
        </div>

        {/* Trial Information - Removed as HPP is now paid-only add-on */}

        {hppEnabled && (
          <>
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                ✨ Fitur HPP Aktif
              </h3>
              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                <p>• Kolom HPP tersedia di halaman Produk</p>
                <p>• Margin profit dihitung otomatis</p>
                <p>• Menu Karyawan dan Pengeluaran tersedia</p>
                <p>• Laporan menampilkan analisis profit detail</p>
                <p>• Kasir dapat menambahkan biaya kustom (jika diberi izin)</p>
              </div>
            </div>

            {/* Employee Costs Summary */}
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Biaya Karyawan Bulanan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Active Employees */}
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        Karyawan Aktif
                      </p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {employeeStats.totalActive}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-purple-500" />
                  </div>
                </div>

                {/* Total Base Salary */}
                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Total Gaji Pokok
                      </p>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        Rp {employeeStats.totalBaseSalary.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-500" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Biaya karyawan ini akan dimasukkan ke dalam perhitungan HPP Global bulanan
              </p>
            </div>
          </>
        )}
      </CardContent>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('activateHPPFeature') || 'Activate HPP Feature'}</DialogTitle>
            <DialogDescription>
              {t('selectSubscriptionPackageToActivate') || 'Select a subscription package to activate HPP feature'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan Selection - Same as RenewalPage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: '1_month', name: '1 Bulan', duration: 1, price: 50000, pricePerMonth: 50000, popular: false },
                { id: '3_months', name: '3 Bulan', duration: 3, price: 150000, pricePerMonth: 50000, popular: false },
                { id: '6_months', name: '6 Bulan', duration: 6, price: 250000, pricePerMonth: 41666, popular: true, discount: '17%' },
                { id: '12_months', name: '12 Bulan', duration: 12, price: 500000, pricePerMonth: 41667, popular: false, discount: '17%' }
              ].map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedPlan === plan.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${plan.popular ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2 left-4 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                      {t('popular') || 'Popular'}
                    </span>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {plan.discount && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Hemat {plan.discount}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">Rp {plan.price.toLocaleString('id-ID')}</p>
                      <p className="text-xs text-muted-foreground">
                        Rp {plan.pricePerMonth.toLocaleString('id-ID')}/bulan
                      </p>
                    </div>
                  </div>
                  {selectedPlan === plan.id && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      ✓ {t('selected') || 'Selected'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <Label>{t('paymentMethod') || 'Metode Pembayaran'}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPaymentMethod') || "Pilih Metode Pembayaran"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M2">Mandiri Virtual Account</SelectItem>
                  <SelectItem value="I1">BNI Virtual Account</SelectItem>
                  <SelectItem value="B1">CIMB Niaga Virtual Account</SelectItem>
                  <SelectItem value="BT">Permata Virtual Account</SelectItem>
                  <SelectItem value="A1">ATM Bersama Virtual Account</SelectItem>
                  <SelectItem value="VA">Maybank Virtual Account</SelectItem>
                  <SelectItem value="FT">Alfamart</SelectItem>
                  <SelectItem value="PG">Pegadaian</SelectItem>
                  <SelectItem value="PI">Pos Indonesia</SelectItem>
                  <SelectItem value="OV">OVO</SelectItem>
                  <SelectItem value="SA">ShopeePay</SelectItem>
                  <SelectItem value="DA">DANA</SelectItem>
                  <SelectItem value="GQ">QRIS Nusapay</SelectItem>
                  <SelectItem value="SP">QRIS ShopeePay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {isSubscriptionActive ? (
                  <>💡 {t('extendHPPAccessAfterTrial') || 'Extend HPP access after trial ends to continue using:'}</>
                ) : (
                  <>💡 {t('afterPaymentHPPActive') || 'After successful payment, HPP feature will be active and you can access:'}</>
                )}
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                <li>• {t('employeeMenuForSalary') || 'Employee menu for salary management'}</li>
                <li>• {t('expenseMenuForTracking') || 'Expense menu for cost tracking'}</li>
                <li>• {t('hppColumnInProducts') || 'HPP column in Products page'}</li>
                <li>• {t('detailedProfitReports') || 'Detailed profit reports'}</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isProcessing}
            >
              {t('cancel') || 'Cancel'}
            </Button>
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('processing') || 'Processing...'}
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {t('payNow') || 'Pay Now'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default HPPSettings;