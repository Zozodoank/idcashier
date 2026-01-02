import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Settings, Layout, FileText, Truck, Table, PenTool, Palette, MoreHorizontal } from 'lucide-react';
import { storeSettingsAPI } from '@/lib/api';
import DeliveryNoteSimple from './DeliveryNoteSimple';

const DeliveryNoteDesigner = ({ storeSettings, onSave }) => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  const [vehicleNumber, setVehicleNumber] = useState('B 1234 XYZ');
  
  // Design settings state
  const [designSettings, setDesignSettings] = useState({
    // Header settings
    showLogo: true,
    showCompanyInfo: true,
    showBorder: false,
    titleAlign: 'right',
    
    // Document settings
    showDocNumber: true,
    invoiceFormat: 'SJ/2024/001234',
    showDate: true,
    dateFormat: 'DD MMMM YYYY',
    showPO: true,
    showDueDate: false,
    
    // Shipping info
    showDriver: true,
    showSender: true,
    showReceiver: true,
    
    // Table columns
    colNumber: true,
    colBarcode: true,
    colItem: true,
    colQty: true,
    colUnit: true,
    colNotes: true,
    colPrice: false,
    colWeight: false,
    
    // Signatures
    showSignatures: true,
    signSender: true,
    signReceiver: true,
    signDriver: false,
    signWarehouse: false,
    signFinance: false,
    signaturePosition: 'relative',
    namePosition: 'below-field',
    showSignatureLine: true,
    showNameDottedLine: true,
    
    // Other
    showNotes: true,
    borderColor: '#000000',
    bgColor: '#ffffff',
    tableHeaderBg: '#000000',
    tableHeaderText: '#ffffff',
    tableBorderColor: '#000000',
    fontColor: '#000000',
    // Default: hitam putih, user bisa ubah
    fontFamily: 'Inter',
    fontSize: 14,
    language: 'id',
    currency: 'IDR',
    decimalSeparator: ',',
    thousandSeparator: '.',
    decimalPlaces: 0
  });

  // Load saved design settings
  useEffect(() => {
    const loadDesignSettings = async () => {
      if (!user?.id || !token) return;
      
      try {
        const allSettings = await storeSettingsAPI.load(token);
        if (allSettings.deliveryNoteDesign) {
          // Use functional update to avoid stale closure
          setDesignSettings(prev => ({ ...prev, ...allSettings.deliveryNoteDesign }));
        }
      } catch (error) {
        console.error('Error loading design settings:', error);
      }
    };
    
    loadDesignSettings();
  }, [user, token]);

  const handleSaveDesign = async () => {
    if (!user?.id || !token) {
      toast({ title: t('error'), description: t('userNotAuthenticated'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
      
      // Save design settings
      await storeSettingsAPI.save(
        {},
        {},
        { deliveryNoteDesign: designSettings },
        ownerId,
        token
      );
      
      // Also save to localStorage
      localStorage.setItem(`idcashier_delivery_note_design_${ownerId}`, JSON.stringify(designSettings));
      
      toast({ title: t('success'), description: t('designSaved') || 'Desain berhasil disimpan.' });
      handleExitDesign();
      
      if (onSave) {
        onSave(designSettings);
      }
    } catch (error) {
      console.error('Error saving design:', error);
      toast({ 
        title: t('error'), 
        description: error.message || t('designSaveFailed') || 'Gagal menyimpan desain.',
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDesign = () => {
    // Reload settings to discard changes
    const loadDesignSettings = async () => {
      if (!user?.id || !token) return;
      try {
        const allSettings = await storeSettingsAPI.load(token);
        if (allSettings.deliveryNoteDesign) {
          setDesignSettings(prev => ({ ...prev, ...allSettings.deliveryNoteDesign }));
        }
      } catch (error) {
        console.error('Error loading design settings:', error);
      }
    };
    loadDesignSettings();
    handleExitDesign();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('design-mode-active');
    };
  }, []);

  const handleStartDesign = () => {
    setIsDesignMode(true);
    // Hide sidebar by adding class to body
    document.body.classList.add('design-mode-active');
  };

  const handleExitDesign = () => {
    setIsDesignMode(false);
    // Remove class from body
    document.body.classList.remove('design-mode-active');
  };

  // Modular onChange handlers
  const handleHeaderChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleShippingChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleTableChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSignatureChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleColorChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleOtherChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  // Mock sale data for preview
  const mockSale = {
    id: 'SJ/2024/001234',
    created_at: new Date().toISOString(),
    customer: {
      id: 'CUST-001',
      name: 'Pelanggan Contoh',
      address: 'Jl. Contoh No. 123',
      phone: '081234567890'
    },
    items: [
      { name: 'Produk A', barcode: '8991001', quantity: 10, unit: 'pcs', price: 50000, notes: 'Catatan produk A' },
      { name: 'Produk B', barcode: '8991002', quantity: 5, unit: 'box', price: 100000, notes: 'Catatan produk B' }
    ],
    notes: 'Catatan tambahan untuk surat jalan ini'
  };

  return (
    <div className="space-y-4">
      {!isDesignMode ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('deliveryNoteDesign') || 'Design Surat Jalan'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('deliveryNoteDesignDesc') || 'Kustomisasi tampilan surat jalan sesuai kebutuhan Anda'}
            </p>
            <Button onClick={handleStartDesign}>
              <Settings className="w-4 h-4 mr-2" />
              {t('startDesign') || 'Mulai Design'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Clean Design Mode - No navbar, sidebar layout like template_surat_jalan.html */
        <div className={`fixed inset-0 z-50 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {/* Settings Panel - Left Sidebar - Always Visible */}
          <div 
            className={`fixed left-0 top-0 h-screen w-96 shadow-2xl z-40 overflow-y-auto ${
              theme === 'dark' ? 'bg-gray-800 border-r border-gray-700' : 'bg-white'
            }`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 pb-3 border-b">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                  {t('deliveryNoteDesign') || 'Pengaturan Surat Jalan'}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleExitDesign}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Kendaraan */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('vehicleSettings') || 'Kendaraan'}</h3>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('vehicleNo') || 'Nomor Kendaraan (Preview)'}</Label>
                    <Input 
                      value={vehicleNumber} 
                      onChange={(e) => setVehicleNumber(e.target.value)} 
                      placeholder="B 1234 XYZ"
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                </div>
              </div>

              {/* Header & Judul */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('headerTitle') || 'Header & Judul'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showLogo') || 'Tampilkan Logo'}</span>
                    <Switch checked={designSettings.showLogo} onCheckedChange={(checked) => handleHeaderChange('showLogo', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showCompanyInfo') || 'Tampilkan Info Perusahaan'}</span>
                    <Switch checked={designSettings.showCompanyInfo} onCheckedChange={(checked) => handleHeaderChange('showCompanyInfo', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showBorder') || 'Tampilkan Border / Frame'}</span>
                    <Switch checked={designSettings.showBorder} onCheckedChange={(checked) => handleHeaderChange('showBorder', checked)} />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('titleAlign') || 'Posisi Judul'}</Label>
                    <Select value={designSettings.titleAlign} onValueChange={(value) => handleHeaderChange('titleAlign', value)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t('left') || 'Kiri'}</SelectItem>
                        <SelectItem value="center">{t('center') || 'Tengah'}</SelectItem>
                        <SelectItem value="right">{t('right') || 'Kanan'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Informasi Dokumen */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('documentInfo') || 'Informasi Dokumen'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDocNumber') || 'Tampilkan Nomor Surat Jalan'}</span>
                    <Switch checked={designSettings.showDocNumber} onCheckedChange={(checked) => handleDocumentChange('showDocNumber', checked)} />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('invoiceFormat') || 'Format Nomor'}</Label>
                    <Input 
                      value={designSettings.invoiceFormat} 
                      onChange={(e) => handleDocumentChange('invoiceFormat', e.target.value)} 
                      placeholder="SJ/2024/001234"
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDate') || 'Tampilkan Tanggal'}</span>
                    <Switch checked={designSettings.showDate} onCheckedChange={(checked) => handleDocumentChange('showDate', checked)} />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dateFormat') || 'Format Tanggal'}</Label>
                    <Input 
                      value={designSettings.dateFormat} 
                      onChange={(e) => handleDocumentChange('dateFormat', e.target.value)} 
                      placeholder="DD MMMM YYYY"
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPO') || 'Tampilkan Nomor PO'}</span>
                    <Switch checked={designSettings.showPO} onCheckedChange={(checked) => handleDocumentChange('showPO', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDueDate') || 'Tampilkan Tanggal Jatuh Tempo'}</span>
                    <Switch checked={designSettings.showDueDate} onCheckedChange={(checked) => handleDocumentChange('showDueDate', checked)} />
                  </label>
                </div>
              </div>

              {/* Info Pengiriman */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('shippingInfo') || 'Info Pengiriman'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDriver') || 'Tampilkan Driver & Kendaraan'}</span>
                    <Switch checked={designSettings.showDriver} onCheckedChange={(checked) => handleShippingChange('showDriver', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSender') || 'Tampilkan Alamat Pengirim'}</span>
                    <Switch checked={designSettings.showSender} onCheckedChange={(checked) => handleShippingChange('showSender', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showReceiver') || 'Tampilkan Alamat Penerima'}</span>
                    <Switch checked={designSettings.showReceiver} onCheckedChange={(checked) => handleShippingChange('showReceiver', checked)} />
                  </label>
                </div>
              </div>

              {/* Kolom Tabel */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('tableColumns') || 'Kolom Tabel'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colNumber') || 'Kolom Nomor'}</span>
                    <Switch checked={designSettings.colNumber} onCheckedChange={(checked) => handleTableChange('colNumber', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colBarcode') || 'Kolom Barcode'}</span>
                    <Switch checked={designSettings.colBarcode} onCheckedChange={(checked) => handleTableChange('colBarcode', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colItem') || 'Kolom Nama Barang'}</span>
                    <Switch checked={designSettings.colItem} onCheckedChange={(checked) => handleTableChange('colItem', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colQty') || 'Kolom Jumlah'}</span>
                    <Switch checked={designSettings.colQty} onCheckedChange={(checked) => handleTableChange('colQty', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colUnit') || 'Kolom Satuan'}</span>
                    <Switch checked={designSettings.colUnit} onCheckedChange={(checked) => handleTableChange('colUnit', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colNotes') || 'Kolom Keterangan'}</span>
                    <Switch checked={designSettings.colNotes} onCheckedChange={(checked) => handleTableChange('colNotes', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colPrice') || 'Kolom Harga'}</span>
                    <Switch checked={designSettings.colPrice} onCheckedChange={(checked) => handleTableChange('colPrice', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colWeight') || 'Kolom Berat'}</span>
                    <Switch checked={designSettings.colWeight} onCheckedChange={(checked) => handleTableChange('colWeight', checked)} />
                  </label>
                </div>
              </div>

              {/* Tanda Tangan */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('signatures') || 'Tanda Tangan'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSignatures') || 'Tampilkan Tanda Tangan'}</span>
                    <Switch checked={designSettings.showSignatures} onCheckedChange={(checked) => handleSignatureChange('showSignatures', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSignatureLine') || 'Tampilkan Garis Tanda Tangan'}</span>
                    <Switch 
                      checked={designSettings.showSignatureLine !== false} 
                      onCheckedChange={(checked) => handleSignatureChange('showSignatureLine', checked)} 
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showNameDottedLine') || 'Tampilkan Titik-Titik Nama'}</span>
                    <Switch 
                      checked={designSettings.showNameDottedLine !== false} 
                      onCheckedChange={(checked) => handleSignatureChange('showNameDottedLine', checked)} 
                    />
                  </label>
                  {designSettings.showSignatures && (
                    <div className={`p-3 rounded space-y-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
                      <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('signatureDesc') || 'Pilih penandatangan yang akan ditampilkan:'}</p>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signSender') || 'Pengirim'}</span>
                        <Switch checked={designSettings.signSender} onCheckedChange={(checked) => handleSignatureChange('signSender', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signReceiver') || 'Penerima'}</span>
                        <Switch checked={designSettings.signReceiver} onCheckedChange={(checked) => handleSignatureChange('signReceiver', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signDriver') || 'Driver'}</span>
                        <Switch checked={designSettings.signDriver} onCheckedChange={(checked) => handleSignatureChange('signDriver', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signWarehouse') || 'Staff Gudang'}</span>
                        <Switch checked={designSettings.signWarehouse} onCheckedChange={(checked) => handleSignatureChange('signWarehouse', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signFinance') || 'Keuangan'}</span>
                        <Switch checked={designSettings.signFinance} onCheckedChange={(checked) => handleSignatureChange('signFinance', checked)} />
                      </label>
                      <div className="mt-2">
                        <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('signaturePosition') || 'Posisi Tanda Tangan'}</Label>
                        <Select value={designSettings.signaturePosition} onValueChange={(value) => handleSignatureChange('signaturePosition', value)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relative">{t('relative') || 'Relatif (Fleksibel)'}</SelectItem>
                            <SelectItem value="fixed">{t('fixed') || 'Tetap di Bawah'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-2">
                        <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('namePosition') || 'Posisi Nama'}</Label>
                        <Select value={designSettings.namePosition} onValueChange={(value) => handleSignatureChange('namePosition', value)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="below-field">{t('belowField') || 'Di Bawah Garis'}</SelectItem>
                            <SelectItem value="below-content">{t('belowContent') || 'Di Bawah Kolom'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warna & Styling */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('colorStyling') || 'Warna & Tampilan'}</h3>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('borderColor') || 'Warna Border'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.borderColor} onChange={(e) => handleColorChange('borderColor', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.borderColor} onChange={(e) => handleColorChange('borderColor', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('bgColor') || 'Warna Latar Belakang'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.bgColor} onChange={(e) => handleColorChange('bgColor', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.bgColor} onChange={(e) => handleColorChange('bgColor', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('fontColor') || 'Warna Teks'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.fontColor} onChange={(e) => handleColorChange('fontColor', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.fontColor} onChange={(e) => handleColorChange('fontColor', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('tableHeaderBg') || 'Warna Header Tabel'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.tableHeaderBg} onChange={(e) => handleColorChange('tableHeaderBg', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.tableHeaderBg} onChange={(e) => handleColorChange('tableHeaderBg', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('tableHeaderText') || 'Warna Teks Header Tabel'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.tableHeaderText} onChange={(e) => handleColorChange('tableHeaderText', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.tableHeaderText} onChange={(e) => handleColorChange('tableHeaderText', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('tableBorderColor') || 'Warna Border Tabel'}</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={designSettings.tableBorderColor} onChange={(e) => handleColorChange('tableBorderColor', e.target.value)} className="w-12 h-8 border rounded cursor-pointer" />
                      <Input value={designSettings.tableBorderColor} onChange={(e) => handleColorChange('tableBorderColor', e.target.value)} className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('fontFamily') || 'Jenis Font'}</Label>
                    <Select value={designSettings.fontFamily} onValueChange={(value) => handleColorChange('fontFamily', value)}>
                      <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Roboto">Roboto</SelectItem>
                        <SelectItem value="Poppins">Poppins</SelectItem>
                        <SelectItem value="Lato">Lato</SelectItem>
                        <SelectItem value="Open Sans">Open Sans</SelectItem>
                        <SelectItem value="Montserrat">Montserrat</SelectItem>
                        <SelectItem value="Nunito">Nunito</SelectItem>
                        <SelectItem value="Raleway">Raleway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('fontSize') || 'Ukuran Font'}: {designSettings.fontSize || 14}px</Label>
                    <input type="range" min="10" max="18" value={designSettings.fontSize || 14} onChange={(e) => handleColorChange('fontSize', parseInt(e.target.value))} className="w-full" />
                  </div>
                </div>
              </div>

              {/* Pengaturan Lainnya */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('otherSettings') || 'Pengaturan Lainnya'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showNotes') || 'Tampilkan Catatan'}</span>
                    <Switch checked={designSettings.showNotes} onCheckedChange={(checked) => handleOtherChange('showNotes', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPrice') || 'Tampilkan Harga'}</span>
                    <Switch 
                      checked={designSettings.showPrice !== false} 
                      onCheckedChange={(checked) => handleOtherChange('showPrice', checked)} 
                    />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('currency') || 'Mata Uang'}</Label>
                    <Select value={designSettings.currency} onValueChange={(value) => handleOtherChange('currency', value)}>
                      <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IDR">Rp (Rupiah)</SelectItem>
                        <SelectItem value="USD">$ (US Dollar)</SelectItem>
                        <SelectItem value="EUR">€ (Euro)</SelectItem>
                        <SelectItem value="CNY">¥ (Yuan)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('decimalSeparator') || 'Pemisah Desimal'}</Label>
                    <Input 
                      value={designSettings.decimalSeparator || ','} 
                      onChange={(e) => handleOtherChange('decimalSeparator', e.target.value)} 
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('thousandSeparator') || 'Pemisah Ribuan'}</Label>
                    <Input 
                      value={designSettings.thousandSeparator || '.'} 
                      onChange={(e) => handleOtherChange('thousandSeparator', e.target.value)} 
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('decimalPlaces') || 'Jumlah Desimal'}</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      max="3"
                      value={designSettings.decimalPlaces ?? 0} 
                      onChange={(e) => handleOtherChange('decimalPlaces', Number(e.target.value))} 
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                </div>
              </div>

              {/* Bahasa */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('language') || 'Bahasa'}</h3>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('selectLanguage') || 'Pilih Bahasa'}</Label>
                    <Select value={designSettings.language} onValueChange={(value) => handleOtherChange('language', value)}>
                      <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id">Bahasa Indonesia</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2">
                <Button onClick={handleSaveDesign} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? t('saving') || 'Menyimpan...' : t('save') || 'Simpan Pengaturan'}
                </Button>
                <Button variant="outline" onClick={handleCancelDesign} disabled={isSaving} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  {t('cancel') || 'Batal'}
                </Button>
              </div>
            </div>
          </div>


          {/* Main Content - Preview */}
          <div className="transition-all duration-300 p-8 ml-96">
            <div className="max-w-4xl mx-auto">
              <div 
                className={`shadow-2xl rounded-lg overflow-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} 
                style={{ 
                  maxHeight: 'calc(100vh - 100px)',
                  minHeight: '148mm' 
                }}
              >
                <div className="p-4 bg-white">
                  <DeliveryNoteSimple
                    key={JSON.stringify(designSettings)} // Force re-render when designSettings changes
                    sale={mockSale}
                    companyInfo={{
                      name: storeSettings?.name || 'Nama Perusahaan/Toko',
                      address: storeSettings?.address || 'Jl. Contoh No. 123, Jakarta',
                      phone: storeSettings?.phone || '021-12345678',
                      logo: storeSettings?.logo || ''
                    }}
                    vehicleNumber={vehicleNumber}
                    showPrice={designSettings.showPrice !== false}
                    receiverName=""
                    senderName=""
                    showSignatureLine={designSettings.showSignatureLine !== false}
                    showNameDottedLine={designSettings.showNameDottedLine !== false}
                    designSettings={designSettings}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryNoteDesigner;
