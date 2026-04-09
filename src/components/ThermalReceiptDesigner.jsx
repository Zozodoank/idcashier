import React, { useState, useEffect } from 'react';
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
import { Save, X, Settings, Layout, FileText, Table, Palette, MoreHorizontal } from 'lucide-react';
import { storeSettingsAPI } from '@/lib/api';
import PrintReceipt from './PrintReceipt';
import { getDefaultThermalMargin } from '@/lib/thermalReceiptLayout';

const createDefaultDesignSettings = (paperSize) => ({
  // Header & Footer
  headerText: '',
  footerText: 'Terima kasih atas kunjungan Anda',
  showHeader: true,
  showFooter: true,
  showAddress: true,
  showPhone: true,
  showEmail: false,

  // Receipt Info
  showDateTime: true,
  showCashier: true,
  showTransactionId: true,

  // Items Table
  showItemCode: false,
  showItemName: true,
  showQuantity: true,
  showPrice: true,
  showSubtotal: true,
  itemSeparator: 'none',

  // Financial
  showSubtotalLine: true,
  showDiscount: true,
  showTax: true,
  showTotal: true,
  showPayment: true,
  showChange: true,

  // Layout & Styling
  alignment: 'center',
  fontSize: 'normal',
  lineSpacing: 'normal',
  boldHeader: true,
  boldTotal: true,

  // Margin & Spacing
  margin: getDefaultThermalMargin(paperSize),
  topMargin: 0,
  bottomMargin: 0,

  // Additional
  showLogo: false,
  showBarcode: false,
  showQRCode: false,
  showNotes: true,
  customNote: '',

  // Language & Format
  language: 'id',
  dateFormat: 'DD/MM/YYYY HH:mm',
  currency: 'IDR',
  decimalPlaces: 0,
});

const ThermalReceiptDesigner = ({ paperSize, storeSettings, initialSettings, onSave }) => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  
  // Design settings state
  const [designSettings, setDesignSettings] = useState(() => createDefaultDesignSettings(paperSize));

  // Settings are now passed via props, so internal loading is removed.
  useEffect(() => {
    // When initialSettings prop changes, update the internal state
    if (initialSettings) {
      setDesignSettings(prev => ({ ...prev, ...createDefaultDesignSettings(paperSize), ...initialSettings }));
    }
  }, [initialSettings, paperSize]);

  const handleSaveDesign = async () => {
    setIsSaving(true);
    try {
      // Call the onSave callback from props to handle saving in the parent
      if (onSave) {
        await onSave(designSettings);
      }
      toast({ title: t('success'), description: t('designSaved') || 'Desain berhasil disimpan.' });
      handleExitDesign();
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
        const settingsKey = `receipt${paperSize}Design`;
        if (allSettings[settingsKey]) {
          setDesignSettings(prev => ({ ...prev, ...allSettings[settingsKey] }));
        }
      } catch (error) {
        console.error('Error loading design settings:', error);
      }
    };
    loadDesignSettings();
    handleExitDesign();
  };

  const handleStartDesign = () => {
    setIsDesignMode(true);
    document.body.classList.add('design-mode-active');
  };

  const handleExitDesign = () => {
    setIsDesignMode(false);
    document.body.classList.remove('design-mode-active');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('design-mode-active');
    };
  }, []);

  // Modular onChange handlers
  const handleHeaderChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleContentChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLayoutChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleOtherChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  // Mock transaction data for preview
  const mockTransaction = {
    id: 'TRX-001234',
    created_at: new Date().toISOString(),
    cashier_name: 'Kasir Demo',
    items: [
      { id: 1, product_name: 'Laptop ASUS ROG', name: 'Laptop ASUS ROG', quantity: 1, price: 15000000, barcode: 'LP001' },
      { id: 2, product_name: 'Mouse Wireless', name: 'Mouse Wireless', quantity: 2, price: 250000, barcode: 'MS001' },
      { id: 3, product_name: 'Keyboard Mechanical', name: 'Keyboard Mechanical', quantity: 1, price: 1500000, barcode: 'KB001' }
    ],
    cart: [
      { id: 1, product_name: 'Laptop ASUS ROG', name: 'Laptop ASUS ROG', quantity: 1, price: 15000000, barcode: 'LP001' },
      { id: 2, product_name: 'Mouse Wireless', name: 'Mouse Wireless', quantity: 2, price: 250000, barcode: 'MS001' },
      { id: 3, product_name: 'Keyboard Mechanical', name: 'Keyboard Mechanical', quantity: 1, price: 1500000, barcode: 'KB001' }
    ],
    subtotal: 17000000,
    discount_amount: 500000,
    discountAmount: 500000,
    discountPercent: 0,
    tax_amount: 0,
    taxAmount: 0,
    taxPercent: 0,
    total_amount: 16500000,
    total: 16500000,
    payment_amount: 17000000,
    paymentAmount: 17000000,
    change_amount: 500000,
    change: 500000,
    customer: { name: 'Customer Demo' },
    notes: 'Terima kasih'
  };

  const receiptTitle = paperSize === '58mm' ? '58mm' : '80mm';

  return (
    <div className="space-y-4">
      {!isDesignMode ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('thermalReceiptDesign') || `Design Struk Thermal ${receiptTitle}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('thermalReceiptDesignDesc') || `Kustomisasi tampilan struk thermal ${receiptTitle} sesuai kebutuhan Anda`}
            </p>
            <Button onClick={handleStartDesign}>
              <Settings className="w-4 h-4 mr-2" />
              {t('startDesign') || 'Mulai Design'}
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                  {t('thermalReceiptDesign') || `Pengaturan Struk ${receiptTitle}`}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleExitDesign}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Settings Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-4">
                <TabsList className={`grid w-full grid-cols-5 ${theme === 'dark' ? 'bg-gray-700' : ''}`}>
                  <TabsTrigger value="header" title={t('headerFooter') || 'Header & Footer'}>
                    <Layout className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="content" title={t('content') || 'Konten'}>
                    <FileText className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="table" title={t('itemsTable') || 'Tabel Items'}>
                    <Table className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="layout" title={t('layout') || 'Layout'}>
                    <Palette className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="other" title={t('others') || 'Lainnya'}>
                    <MoreHorizontal className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Settings Content */}
              <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  {/* Header & Footer Settings */}
                  <TabsContent value="header" className="space-y-4">
                    <div>
                      <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('headerFooter') || 'Header & Footer'}</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('headerText') || 'Teks Header'}</Label>
                          <Input 
                            value={designSettings.headerText} 
                            onChange={(e) => handleHeaderChange('headerText', e.target.value)}
                            placeholder={t('headerTextPlaceholder') || 'Nama Toko / Pesan Header'}
                            className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('footerText') || 'Teks Footer'}</Label>
                          <Input 
                            value={designSettings.footerText} 
                            onChange={(e) => handleHeaderChange('footerText', e.target.value)}
                            placeholder={t('footerTextPlaceholder') || 'Terima kasih'}
                            className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showAddress') || 'Tampilkan Alamat'}</Label>
                          <Switch 
                            checked={designSettings.showAddress} 
                            onCheckedChange={(checked) => handleHeaderChange('showAddress', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPhone') || 'Tampilkan Telepon'}</Label>
                          <Switch 
                            checked={designSettings.showPhone} 
                            onCheckedChange={(checked) => handleHeaderChange('showPhone', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showEmail') || 'Tampilkan Email'}</Label>
                          <Switch 
                            checked={designSettings.showEmail} 
                            onCheckedChange={(checked) => handleHeaderChange('showEmail', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showLogo') || 'Tampilkan Logo'}</Label>
                          <Switch 
                            checked={designSettings.showLogo} 
                            onCheckedChange={(checked) => handleHeaderChange('showLogo', checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Content Settings */}
                  <TabsContent value="content" className="space-y-4">
                    <div>
                      <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('receiptContent') || 'Konten Struk'}</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDateTime') || 'Tanggal & Waktu'}</Label>
                          <Switch 
                            checked={designSettings.showDateTime} 
                            onCheckedChange={(checked) => handleContentChange('showDateTime', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showCashier') || 'Nama Kasir'}</Label>
                          <Switch 
                            checked={designSettings.showCashier} 
                            onCheckedChange={(checked) => handleContentChange('showCashier', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showTransactionId') || 'ID Transaksi'}</Label>
                          <Switch 
                            checked={designSettings.showTransactionId} 
                            onCheckedChange={(checked) => handleContentChange('showTransactionId', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSubtotalLine') || 'Garis Subtotal'}</Label>
                          <Switch 
                            checked={designSettings.showSubtotalLine} 
                            onCheckedChange={(checked) => handleContentChange('showSubtotalLine', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDiscount') || 'Tampilkan Diskon'}</Label>
                          <Switch 
                            checked={designSettings.showDiscount} 
                            onCheckedChange={(checked) => handleContentChange('showDiscount', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showTax') || 'Tampilkan Pajak'}</Label>
                          <Switch 
                            checked={designSettings.showTax} 
                            onCheckedChange={(checked) => handleContentChange('showTax', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showTotal') || 'Tampilkan Total'}</Label>
                          <Switch 
                            checked={designSettings.showTotal} 
                            onCheckedChange={(checked) => handleContentChange('showTotal', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPayment') || 'Bayar'}</Label>
                          <Switch 
                            checked={designSettings.showPayment} 
                            onCheckedChange={(checked) => handleContentChange('showPayment', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showChange') || 'Kembali'}</Label>
                          <Switch 
                            checked={designSettings.showChange} 
                            onCheckedChange={(checked) => handleContentChange('showChange', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showNotes') || 'Catatan'}</Label>
                          <Switch 
                            checked={designSettings.showNotes} 
                            onCheckedChange={(checked) => handleContentChange('showNotes', checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Items Table Settings */}
                  <TabsContent value="table" className="space-y-4">
                    <div>
                      <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('itemsTable') || 'Tabel Barang'}</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showItemCode') || 'Kode Barang'}</Label>
                          <Switch 
                            checked={designSettings.showItemCode} 
                            onCheckedChange={(checked) => handleContentChange('showItemCode', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showItemName') || 'Nama Barang'}</Label>
                          <Switch 
                            checked={designSettings.showItemName} 
                            onCheckedChange={(checked) => handleContentChange('showItemName', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showQuantity') || 'Quantity'}</Label>
                          <Switch 
                            checked={designSettings.showQuantity} 
                            onCheckedChange={(checked) => handleContentChange('showQuantity', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPrice') || 'Harga'}</Label>
                          <Switch 
                            checked={designSettings.showPrice} 
                            onCheckedChange={(checked) => handleContentChange('showPrice', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSubtotal') || 'Subtotal per Item'}</Label>
                          <Switch 
                            checked={designSettings.showSubtotal} 
                            onCheckedChange={(checked) => handleContentChange('showSubtotal', checked)}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Layout Settings */}
                  <TabsContent value="layout" className="space-y-4">
                    <div>
                      <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('layoutStyling') || 'Layout & Styling'}</h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('alignment') || 'Perataan Teks'}</Label>
                          <Select value={designSettings.alignment} onValueChange={(value) => handleLayoutChange('alignment', value)}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">{t('left') || 'Kiri'}</SelectItem>
                              <SelectItem value="center">{t('center') || 'Tengah'}</SelectItem>
                              <SelectItem value="right">{t('right') || 'Kanan'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('fontSize') || 'Ukuran Font'}</Label>
                          <Select value={designSettings.fontSize} onValueChange={(value) => handleLayoutChange('fontSize', value)}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">{t('small') || 'Kecil'}</SelectItem>
                              <SelectItem value="normal">{t('normal') || 'Normal'}</SelectItem>
                              <SelectItem value="large">{t('large') || 'Besar'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('lineSpacing') || 'Jarak Baris'}</Label>
                          <Select value={designSettings.lineSpacing} onValueChange={(value) => handleLayoutChange('lineSpacing', value)}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compact">{t('compact') || 'Rapat'}</SelectItem>
                              <SelectItem value="normal">{t('normal') || 'Normal'}</SelectItem>
                              <SelectItem value="relaxed">{t('relaxed') || 'Renggang'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('boldHeader') || 'Header Tebal'}</Label>
                          <Switch 
                            checked={designSettings.boldHeader} 
                            onCheckedChange={(checked) => handleLayoutChange('boldHeader', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('boldTotal') || 'Total Tebal'}</Label>
                          <Switch 
                            checked={designSettings.boldTotal} 
                            onCheckedChange={(checked) => handleLayoutChange('boldTotal', checked)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('margin') || 'Margin'}: {designSettings.margin}px</Label>
                          <input 
                            type="range" 
                            min="0" 
                            max="20" 
                            value={designSettings.margin} 
                            onChange={(e) => handleLayoutChange('margin', parseInt(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Other Settings */}
                  <TabsContent value="other" className="space-y-4">
                    <div>
                      <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('otherSettings') || 'Pengaturan Lainnya'}</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showBarcode') || 'Barcode'}</Label>
                          <Switch 
                            checked={designSettings.showBarcode} 
                            onCheckedChange={(checked) => handleOtherChange('showBarcode', checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showQRCode') || 'QR Code'}</Label>
                          <Switch 
                            checked={designSettings.showQRCode} 
                            onCheckedChange={(checked) => handleOtherChange('showQRCode', checked)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('customNote') || 'Catatan Kustom'}</Label>
                          <Input 
                            value={designSettings.customNote} 
                            onChange={(e) => handleOtherChange('customNote', e.target.value)}
                            placeholder={t('customNotePlaceholder') || 'Catatan tambahan...'}
                            className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dateFormat') || 'Format Tanggal'}</Label>
                          <Select value={designSettings.dateFormat} onValueChange={(value) => handleOtherChange('dateFormat', value)}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DD/MM/YYYY HH:mm">DD/MM/YYYY HH:mm</SelectItem>
                              <SelectItem value="MM/DD/YYYY HH:mm">MM/DD/YYYY HH:mm</SelectItem>
                              <SelectItem value="YYYY-MM-DD HH:mm">YYYY-MM-DD HH:mm</SelectItem>
                              <SelectItem value="DD MMMM YYYY HH:mm">DD MMMM YYYY HH:mm</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('language') || 'Bahasa'}</Label>
                          <Select value={designSettings.language} onValueChange={(value) => handleOtherChange('language', value)}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="id">Bahasa Indonesia</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="zh">中文</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('decimalPlaces') || 'Jumlah Desimal'}</Label>
                          <Select value={String(designSettings.decimalPlaces)} onValueChange={(value) => handleOtherChange('decimalPlaces', parseInt(value))}>
                            <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 (tanpa desimal)</SelectItem>
                              <SelectItem value="2">2 desimal</SelectItem>
                              <SelectItem value="3">3 desimal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2 border-t mt-4">
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
          <div className="transition-all duration-300 p-8 ml-96 h-screen overflow-y-auto">
            <div className="flex justify-center min-h-full pb-20">
              <div className={`bg-white shadow-2xl rounded-lg ${paperSize === '58mm' ? 'w-[220px]' : 'w-[302px]'}`} style={{ padding: '10px' }}>
                <PrintReceipt 
                  key={JSON.stringify(designSettings)} // Force re-render when designSettings changes
                  {...mockTransaction}
                  settings={{
                    // Default store data for preview
                    name: storeSettings?.name || 'Toko Demo',
                    address: storeSettings?.address || 'Jl. Contoh No. 123, Jakarta',
                    phone: storeSettings?.phone || '021-12345678',
                    email: storeSettings?.email || 'demo@toko.com',
                    logo: storeSettings?.logo || '',
                    // Spread design settings to override defaults
                    ...designSettings
                  }}
                  paperSize={paperSize}
                  hideInternalPrintButton={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThermalReceiptDesigner;
