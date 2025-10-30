import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { settingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHPP } from '@/contexts/HPPContext';
import { supabase } from '@/lib/supabaseClient';
import { Users, DollarSign } from 'lucide-react';

const HPPSettings = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { refreshHPPSetting } = useHPP();
  const [hppEnabled, setHppEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employeeStats, setEmployeeStats] = useState({
    totalActive: 0,
    totalBaseSalary: 0
  });

  useEffect(() => {
    loadSettings();
    loadEmployeeStats();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsAPI.get('hpp_enabled', token);
      setHppEnabled(data?.setting_value?.enabled || false);
    } catch (error) {
      console.error('Error loading HPP settings:', error);
      // If setting doesn't exist yet, default to false
      setHppEnabled(false);
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

  const handleToggle = async (checked) => {
    try {
      await settingsAPI.update('hpp_enabled', { enabled: checked }, token);
      setHppEnabled(checked);
      // Refresh global HPP state to update sidebar and other components
      await refreshHPPSetting();
      toast({
        title: t('success'),
        description: checked ? 'Fitur HPP diaktifkan' : 'Fitur HPP dinonaktifkan'
      });
    } catch (error) {
      console.error('Error updating HPP settings:', error);
      toast({
        title: t('error'),
        description: 'Gagal mengubah pengaturan HPP',
        variant: 'destructive'
      });
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
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="hpp-toggle" className="flex flex-col space-y-1">
            <span>Aktifkan Fitur HPP</span>
            <span className="font-normal text-sm text-muted-foreground">
              Menampilkan kolom HPP di halaman produk dan laporan
            </span>
          </Label>
          <Switch
            id="hpp-toggle"
            checked={hppEnabled}
            onCheckedChange={handleToggle}
          />
        </div>
        
        {hppEnabled && (
          <>
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>✨ Fitur HPP Aktif</strong>
                <br />
                • Kolom HPP akan muncul di halaman Produk
                <br />
                • Margin profit akan dihitung otomatis
                <br />
                • Kasir dapat menambahkan biaya kustom saat checkout (jika diberi izin)
                <br />
                • Laporan akan menampilkan analisis profit
              </p>
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
    </Card>
  );
};

export default HPPSettings;

