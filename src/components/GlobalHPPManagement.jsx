import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Info } from 'lucide-react';
import { globalHPPAPI } from '@/lib/api';

const GlobalHPPManagement = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { token } = useAuth();
  
  const [hppItems, setHppItems] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentHPP, setCurrentHPP] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHPPItems();
  }, [selectedYear, selectedMonth]);

  const fetchHPPItems = async () => {
    try {
      setLoading(true);
      const data = await globalHPPAPI.getByMonth(selectedYear, selectedMonth, token);
      setHppItems(data);
    } catch (error) {
      console.error('Error fetching global HPP:', error);
      toast({ 
        title: t('error'), 
        description: error.message || 'Failed to load global HPP', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setCurrentHPP({
      label: '',
      monthly_amount: 0,
      month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (hpp) => {
    setCurrentHPP({ ...hpp });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id, label) => {
    if (!window.confirm(`hapus HPP global "${label}"?`)) return;
    
    try {
      await globalHPPAPI.delete(id, token);
      toast({ 
        title: t('success'), 
        description: 'HPP global berhasil dihapus' 
      });
      fetchHPPItems();
    } catch (error) {
      console.error('Error deleting global HPP:', error);
      toast({ 
        title: t('error'), 
        description: error.message || 'gagal menghapus HPP global', 
        variant: 'destructive' 
      });
    }
  };

  const handleSubmit = async () => {
    if (!currentHPP.label) {
      toast({ 
        title: t('error'), 
        description: 'label harus diisi', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      const hppData = {
        label: currentHPP.label,
        monthly_amount: parseFloat(currentHPP.monthly_amount) || 0,
        month: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      };

      if (currentHPP.id) {
        hppData.id = currentHPP.id;
      }

      await globalHPPAPI.upsert(hppData, token);
      toast({ 
        title: t('success'), 
        description: currentHPP.id ? 'HPP global berhasil diupdate' : 'HPP global berhasil ditambahkan'
      });

      setIsDialogOpen(false);
      setCurrentHPP(null);
      fetchHPPItems();
    } catch (error) {
      console.error('Error saving global HPP:', error);
      toast({ 
        title: t('error'), 
        description: error.message || 'gagal menyimpan HPP global', 
        variant: 'destructive' 
      });
    }
  };

  const totalMonthly = hppItems.reduce((sum, item) => sum + parseFloat(item.monthly_amount || 0), 0);
  const dailyRate = totalMonthly / 30;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>{t('globalHPP') || 'HPP global'}</CardTitle>
              <CardDescription>biaya tetap bulanan</CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-md text-sm"
              >
                {months.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-2 border rounded-md text-sm"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('globalHPPInfo') || 'biaya tetap bulanan (listrik, internet, sewa, dll) dibagi 30 hari untuk perhitungan profit harian'}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              tambah biaya
            </Button>
          </div>

          {loading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : hppItems.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              belum ada HPP global untuk bulan ini
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3 text-left">label</th>
                      <th className="p-3 text-left">{t('monthlyAmount') || 'biaya bulanan'}</th>
                      <th className="p-3 text-left">{t('dailyRate') || 'biaya/hari'}</th>
                      <th className="p-3 text-left">{t('actions') || 'aksi'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hppItems.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{item.label}</td>
                        <td className="p-3">Rp {parseFloat(item.monthly_amount).toLocaleString('id-ID')}</td>
                        <td className="p-3 text-muted-foreground">
                          Rp {(parseFloat(item.monthly_amount) / 30).toLocaleString('id-ID', { 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleDelete(item.id, item.label)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td className="p-3">total</td>
                      <td className="p-3">Rp {totalMonthly.toLocaleString('id-ID')}</td>
                      <td className="p-3">Rp {dailyRate.toLocaleString('id-ID', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}</td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentHPP?.id ? 'edit' : 'tambah'} HPP global
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">label *</Label>
              <Input
                id="label"
                value={currentHPP?.label || ''}
                onChange={(e) => setCurrentHPP({ ...currentHPP, label: e.target.value })}
                placeholder="contoh: listrik, internet, sewa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{t('monthlyAmount') || 'biaya bulanan'}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={currentHPP?.monthly_amount || ''}
                onChange={(e) => setCurrentHPP({ ...currentHPP, monthly_amount: e.target.value })}
                placeholder="0"
              />
              {currentHPP?.monthly_amount > 0 && (
                <p className="text-xs text-muted-foreground">
                  biaya per hari: Rp {(parseFloat(currentHPP.monthly_amount) / 30).toLocaleString('id-ID', { 
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>bulan</Label>
              <Input
                value={`${months[selectedMonth - 1]} ${selectedYear}`}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('cancel') || 'batal'}
            </Button>
            <Button onClick={handleSubmit}>
              {t('save') || 'simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GlobalHPPManagement;