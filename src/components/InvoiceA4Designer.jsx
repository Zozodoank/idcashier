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
import { Save, X, Settings, Layout, FileText, DollarSign, Table, Palette, MoreHorizontal } from 'lucide-react';
import { storeSettingsAPI } from '@/lib/api';
import InvoiceA4 from './InvoiceA4';

const InvoiceA4Designer = ({ storeSettings, onSave }) => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  
  // Design settings state
  const [designSettings, setDesignSettings] = useState({
    // Header settings
    showLogo: true,
    showCompanyInfo: true,
    showBorder: true,
    titleAlign: 'center',
    
    // Document settings
    showInvoiceNumber: true,
    invoicePrefix: 'INV',
    showDate: true,
    dateFormat: 'DD MMMM YYYY',
    showDueDate: true,
    showPO: false,
    
    // Customer info
    showCustomerInfo: true,
    showCustomerAddress: true,
    showCustomerEmail: true,
    showCustomerPhone: true,
    
    // Table columns
    colNumber: true,
    colItem: true,
    colQty: true,
    colUnit: true,
    colPrice: true,
    colTotal: true,
    
    // Financial
    showSubtotal: true,
    showDiscount: true,
    showTax: true,
    showTotal: true,
    
    // Payment info
    showBankInfo: true,
    showPaymentMethod: true,
    
    // Notes & Footer
    showNotes: true,
    showFooter: true,
    
    // Signatures
    showSignatures: true,
    signaturePosition: 'relative',
    namePosition: 'below-field',
    signSales: true,
    signCustomer: false,
    signFinance: false,
    
    // Colors & Styling - Default: hitam putih, user bisa ubah
    borderColor: '#000000',
    bgColor: '#ffffff',
    tableHeaderBg: '#000000',
    tableHeaderText: '#ffffff',
    tableBorderColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'Inter',
    fontSize: 14,
    
    // Other
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
        if (allSettings.invoiceA4Design) {
          // Use functional update to avoid stale closure
          setDesignSettings(prev => ({ ...prev, ...allSettings.invoiceA4Design }));
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
        { invoiceA4Design: designSettings },
        ownerId,
        token
      );
      
      // Also save to localStorage
      localStorage.setItem(`idcashier_invoice_a4_design_${ownerId}`, JSON.stringify(designSettings));
      
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
        if (allSettings.invoiceA4Design) {
          setDesignSettings(prev => ({ ...prev, ...allSettings.invoiceA4Design }));
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
    document.body.classList.add('design-mode-active');
  };

  const handleExitDesign = () => {
    setIsDesignMode(false);
    document.body.classList.remove('design-mode-active');
  };

  // Modular onChange handlers
  const handleHeaderChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleTableChange = (field, value) => {
    setDesignSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleFinancialChange = (field, value) => {
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
    id: '001234',
    created_at: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    customer: {
      name: 'PT Pelanggan Contoh',
      address: 'Jl. Contoh No. 123, Jakarta 12345',
      phone: '081234567890'
    },
    items: [
      { product_name: 'Produk 1', quantity: 2, price: 100000, barcode: 'PRD001' },
      { product_name: 'Produk 2', quantity: 5, price: 50000, barcode: 'PRD002' }
    ],
    subtotal: 450000,
    discount_amount: 50000,
    tax_amount: 40000,
    total_amount: 440000,
    payment_amount: 500000,
    change_amount: 60000,
    notes: 'Pembayaran dapat ditransfer ke rekening yang tertera'
  };

  // Mock company info for preview - uses storeSettings from Settings page Toko tab
  const mockCompanyInfo = {
    name: storeSettings?.name || 'Nama Perusahaan/Toko',
    address: storeSettings?.address || 'Jl. Contoh No. 123, Jakarta',
    phone: storeSettings?.phone || '021-12345678',
    email: storeSettings?.email || '',
    logo: storeSettings?.logo || '',
    logoUrl: storeSettings?.logo || '',
    bankAccount: storeSettings?.bankAccount || '1234567890',
    bankName: storeSettings?.bankName || 'Bank Contoh',
    accountHolder: storeSettings?.accountHolder || 'Nama Pemilik Rekening',
    businessOwnerName: storeSettings?.businessOwnerName || 'Nama Pemilik',
    position: storeSettings?.position || 'Direktur',
    invoicePrefix: storeSettings?.invoicePrefix || designSettings.invoicePrefix || 'INV'
  };

  return (
    <div className="space-y-4">
      {!isDesignMode ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceA4Design') || 'Design Invoice A4'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('invoiceA4DesignDesc') || 'Kustomisasi tampilan invoice A4 sesuai kebutuhan Anda'}
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
                  {t('invoiceA4Design') || 'Pengaturan Invoice A4'}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleExitDesign}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Header Settings */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('headerTitle') || 'Header & Logo'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showLogo') || 'Tampilkan Logo'}</span>
                    <Switch checked={designSettings.showLogo} onCheckedChange={(checked) => handleHeaderChange('showLogo', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showCompanyInfo') || 'Info Perusahaan'}</span>
                    <Switch checked={designSettings.showCompanyInfo} onCheckedChange={(checked) => handleHeaderChange('showCompanyInfo', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showBorder') || 'Border / Frame'}</span>
                    <Switch checked={designSettings.showBorder} onCheckedChange={(checked) => handleHeaderChange('showBorder', checked)} />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('titleAlign') || 'Posisi Judul'}</Label>
                    <Select value={designSettings.titleAlign} onValueChange={(value) => handleHeaderChange('titleAlign', value)}>
                      <SelectTrigger className={`w-full ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">{t('left') || 'Kiri'}</SelectItem>
                        <SelectItem value="center">{t('center') || 'Tengah'}</SelectItem>
                        <SelectItem value="right">{t('right') || 'Kanan'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Document Settings */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('documentInfo') || 'Informasi Dokumen'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showInvoiceNumber') || 'Tampilkan Nomor Invoice'}</span>
                    <Switch checked={designSettings.showInvoiceNumber} onCheckedChange={(checked) => handleDocumentChange('showInvoiceNumber', checked)} />
                  </label>
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('invoicePrefix') || 'Prefix Invoice'}</Label>
                    <Input 
                      value={designSettings.invoicePrefix} 
                      onChange={(e) => handleDocumentChange('invoicePrefix', e.target.value)} 
                      placeholder="INV"
                      className={theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}
                    />
                  </div>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDate') || 'Tampilkan Tanggal'}</span>
                    <Switch checked={designSettings.showDate} onCheckedChange={(checked) => handleDocumentChange('showDate', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDueDate') || 'Tampilkan Tanggal Jatuh Tempo'}</span>
                    <Switch checked={designSettings.showDueDate} onCheckedChange={(checked) => handleDocumentChange('showDueDate', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showPO') || 'Tampilkan Nomor PO'}</span>
                    <Switch checked={designSettings.showPO} onCheckedChange={(checked) => handleDocumentChange('showPO', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showCustomerInfo') || 'Tampilkan Info Pelanggan'}</span>
                    <Switch checked={designSettings.showCustomerInfo} onCheckedChange={(checked) => handleDocumentChange('showCustomerInfo', checked)} />
                  </label>
                </div>
              </div>

              {/* Table Columns */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('tableColumns') || 'Kolom Tabel'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colNumber') || 'Kolom Nomor'}</span>
                    <Switch checked={designSettings.colNumber} onCheckedChange={(checked) => handleTableChange('colNumber', checked)} />
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
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colPrice') || 'Kolom Harga'}</span>
                    <Switch checked={designSettings.colPrice} onCheckedChange={(checked) => handleTableChange('colPrice', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('colTotal') || 'Kolom Total'}</span>
                    <Switch checked={designSettings.colTotal} onCheckedChange={(checked) => handleTableChange('colTotal', checked)} />
                  </label>
                </div>
              </div>

              {/* Financial */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('financial') || 'Keuangan'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSubtotal') || 'Tampilkan Subtotal'}</span>
                    <Switch checked={designSettings.showSubtotal} onCheckedChange={(checked) => handleFinancialChange('showSubtotal', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showDiscount') || 'Tampilkan Diskon'}</span>
                    <Switch checked={designSettings.showDiscount} onCheckedChange={(checked) => handleFinancialChange('showDiscount', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showTax') || 'Tampilkan Pajak'}</span>
                    <Switch checked={designSettings.showTax} onCheckedChange={(checked) => handleFinancialChange('showTax', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showTotal') || 'Tampilkan Total'}</span>
                    <Switch checked={designSettings.showTotal} onCheckedChange={(checked) => handleFinancialChange('showTotal', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showBankInfo') || 'Tampilkan Info Bank'}</span>
                    <Switch checked={designSettings.showBankInfo} onCheckedChange={(checked) => handleFinancialChange('showBankInfo', checked)} />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showNotes') || 'Tampilkan Catatan'}</span>
                    <Switch checked={designSettings.showNotes} onCheckedChange={(checked) => handleFinancialChange('showNotes', checked)} />
                  </label>
                </div>
              </div>

              {/* Signatures */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('signatures') || 'Tanda Tangan'}</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('showSignatures') || 'Tampilkan TTD'}</span>
                    <Switch checked={designSettings.showSignatures} onCheckedChange={(checked) => handleOtherChange('showSignatures', checked)} />
                  </label>
                  {designSettings.showSignatures && (
                    <div className={`p-3 rounded space-y-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'}`}>
                      <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{t('signatureDesc') || 'Pilih penandatangan yang akan ditampilkan'}</p>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('sales') || 'Sales'}</span>
                        <Switch checked={designSettings.signSales} onCheckedChange={(checked) => handleOtherChange('signSales', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('customer') || 'Pelanggan'}</span>
                        <Switch checked={designSettings.signCustomer} onCheckedChange={(checked) => handleOtherChange('signCustomer', checked)} />
                      </label>
                      <label className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('finance') || 'Finance'}</span>
                        <Switch checked={designSettings.signFinance} onCheckedChange={(checked) => handleOtherChange('signFinance', checked)} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Colors & Styling */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('colorStyling') || 'Warna & Styling'}</h3>
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
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('fontSize') || 'Ukuran Font'}: {designSettings.fontSize}px</Label>
                    <input type="range" min="10" max="18" value={designSettings.fontSize} onChange={(e) => handleColorChange('fontSize', parseInt(e.target.value))} className="w-full" />
                  </div>
                </div>
              </div>

              {/* Language */}
              <div className={`mb-5 pb-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-lg mb-3 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{t('language') || 'Bahasa'}</h3>
                <div className="space-y-3">
                  <div>
                    <Label className={`text-sm block mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('language') || 'Bahasa'}</Label>
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
          <div className="transition-all duration-300 p-8 ml-96" style={{ height: '100vh', overflowY: 'auto' }}>
            <div className="max-w-4xl mx-auto">
              <div className={`shadow-2xl rounded-lg overflow-hidden ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                <div className="p-8 bg-white">
                  <InvoiceA4
                    key={JSON.stringify(designSettings)} // Force re-render when designSettings changes
                    sale={mockSale}
                    companyInfo={{
                      ...mockCompanyInfo,
                      logoUrl: storeSettings?.logo || ''
                    }}
                    designSettings={designSettings}
                    userId={user?.id || user?.tenantId}
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

export default InvoiceA4Designer;
