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

const HPPSettings = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { refreshHPPSetting } = useHPP();
  const [hppEnabled, setHppEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [employeeStats, setEmployeeStats] = useState({
    totalActive: 0,
    totalBaseSalary: 0
  });

  useEffect(() => {
    checkSubscriptionStatus();
    loadEmployeeStats();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [isTrialActive]);

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
        setIsTrialActive(isActive);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await settingsAPI.get('hpp_enabled', token);
      const settingEnabled = data?.setting_value?.enabled || false;
      
      // HPP is enabled if either:
      // 1. Explicitly enabled via settings (paid subscription)
      // 2. User is in active trial period
      setHppEnabled(settingEnabled || isTrialActive);
    } catch (error) {
      console.error('Error loading HPP settings:', error);
      // During trial, HPP should be enabled even if no setting exists
      setHppEnabled(isTrialActive);
    } finally {
      setLoading(false);
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
    if (hppEnabled) {
      if (isTrialActive) {
        toast({
          title: 'Info',
          description: 'Fitur HPP aktif selama masa trial Anda'
        });
      } else {
        toast({
          title: 'Info',
          description: 'Fitur HPP sudah aktif di akun Anda'
        });
      }
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // Get selected plan pricing
      const plans = {
        '3': { months: 3, price: 60000, name: '3 Bulan' },
        '6': { months: 6, price: 120000, name: '6 Bulan' },
        '12': { months: 12, price: 200000, name: '1 Tahun' }
      };
      
      const plan = plans[selectedPlan];
      const merchantOrderId = `HPP-${Date.now()}-${user.id}`;
      
      // Create payment request to Duitku
      const response = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentAmount: plan.price,
          merchantOrderId: merchantOrderId,
          productDetails: `Aktivasi HPP - ${plan.name}`,
          customerVaName: user.email,
          customerEmail: user.email,
          paymentMethod: 'ALL',
          hppActivation: true,
          planMonths: plan.months
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to create payment request');
      }

      // Save pending HPP activation
      localStorage.setItem('pendingHPPActivation', JSON.stringify({
        merchantOrderId,
        planMonths: plan.months,
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
        description: error.message || 'Gagal memproses pembayaran',
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
                {hppEnabled ? (
                  isTrialActive ? 'Aktif (Trial 7 Hari)' : 'Fitur HPP sudah aktif'
                ) : (
                  'Fitur HPP belum aktif'
                )}
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
                {isTrialActive ? 'Trial Aktif' : 'Aktif'}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Aktifkan HPP
              </>
            )}
          </Button>
        </div>

        {/* Trial Information */}
        {isTrialActive && (
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  🎉 HPP Trial Aktif!
                </h3>
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p>Fitur HPP aktif selama masa trial 7 hari Anda.</p>
                  <p>Setelah trial berakhir, Anda dapat berlangganan untuk melanjutkan akses ke fitur HPP.</p>
                  {subscriptionData && (
                    <p className="font-medium">
                      Trial berakhir: {new Date(subscriptionData.end_date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
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
            <DialogTitle>Aktifkan Fitur HPP</DialogTitle>
            <DialogDescription>
              Pilih paket berlangganan untuk mengaktifkan fitur HPP
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Paket Berlangganan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">
                    <div className="flex justify-between w-full">
                      <span>3 Bulan</span>
                      <span className="font-semibold">Rp 60.000</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="6">
                    <div className="flex justify-between w-full">
                      <span>6 Bulan</span>
                      <span className="font-semibold">Rp 120.000</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="12">
                    <div className="flex justify-between w-full">
                      <span>1 Tahun</span>
                      <span className="font-semibold text-green-600">Rp 200.000</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {isTrialActive ? (
                  <>💡 Perpanjang akses HPP setelah trial berakhir untuk tetap dapat menggunakan:</>
                ) : (
                  <>💡 Setelah pembayaran berhasil, fitur HPP akan langsung aktif dan Anda dapat mengakses:</>
                )}
              </p>
              <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                <li>• Menu Karyawan untuk manajemen gaji</li>
                <li>• Menu Pengeluaran untuk tracking biaya</li>
                <li>• Kolom HPP di halaman Produk</li>
                <li>• Laporan profit yang detail</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button 
              onClick={handlePayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Bayar Sekarang
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