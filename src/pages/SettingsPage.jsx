import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Store, Printer, Settings as SettingsIcon, Image as ImageIcon, Trash2, KeyRound, Plus, Edit, DollarSign } from 'lucide-react';
import PrintReceipt from '@/components/PrintReceipt';
import InvoiceA4 from '@/components/InvoiceA4';
import DeliveryNote from '@/components/DeliveryNote';
import HPPSettings from '@/components/HPPSettings';
import { supabase } from '@/lib/supabaseClient';
import { usersAPI, customersAPI } from '@/lib/api';
import { useReactToPrint } from 'react-to-print';
import { useHPP } from '@/contexts/HPPContext';

// 1) Tambahkan helper di atas SettingsPage
const normalizeRole = (role) => {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'owner';
  if (r === 'kasir') return 'cashier';
  if (r === 'owner' || r === 'cashier') return r;
  return r || 'owner';
};

const normalizeId = (id) => (id === null || id === undefined ? '' : String(id));

const extractUsersArray = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.users)) return res.users;
  if (Array.isArray(res?.results)) return res.results;
  return [];
};

const parsePermissions = (val) => {
  const defaults = {
    sales: true,
    products: true,
    reports: true,
    canEditProduct: true,
    canDeleteProduct: false,
    canAddProduct: true,
    canImportProduct: true,
    canAddCustomer: true,
    canAddSupplier: true,
    canApplyDiscount: true,
    canApplyTax: true,
    canDeleteTransaction: false,
    canExportReports: true
  };
  
  if (!val) return defaults;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }
  return { ...defaults, ...val };
};

const SettingsPage = ({ user, onUserUpdate, navigationParams }) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { navigateTo, clearNavigationParams } = useNavigation();
  const { toast } = useToast();
  const { user: authUser, token } = useAuth();
  const { hppEnabled } = useHPP();
  const logoInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('toko');

  const [storeSettings, setStoreSettings] = useState({ name: 'Toko Kopi Senja', address: 'Jl. Kenangan No. 123', phone: '081234567890', logo: 'https://horizons-cdn.hostinger.com/d409a546-26a3-44fa-aa18-825a2b25dd23/d6d01db925de820ca92a4d792edd6c8f8f.png', bankAccount: '', bankName: '', accountHolder: '', businessOwnerName: '', invoicePrefix: '' });
  const [generalSettings, setGeneralSettings] = useState({ timezone: 'Asia/Jakarta', currency: 'IDR' });
  
  // Individual receipt settings for each type
  const [receiptSettings58mm, setReceiptSettings58mm] = useState({ headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10 });
  const [receiptSettings80mm, setReceiptSettings80mm] = useState({ headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10 });
  const [receiptSettingsA4, setReceiptSettingsA4] = useState({ headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10, invoicePrefix: '' });
  const [receiptSettingsDeliveryNote, setReceiptSettingsDeliveryNote] = useState({ headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10, invoicePrefix: '' });
  
  // Enabled receipt types
  const [enabledReceiptTypes, setEnabledReceiptTypes] = useState({
    '58mm': true,
    '80mm': true,
    'A4': true,
    'delivery-note': true
  });
  
  // Selected receipt type for configuration
  const [selectedReceiptType, setSelectedReceiptType] = useState(null);
  
  const [paperSize, setPaperSize] = useState('80mm');
  const [newPassword, setNewPassword] = '';

  // A4 Invoice Preview States
  const invoiceA4Ref = useRef();
  const deliveryNoteRef = useRef();

  // Customer management state
  const [customers, setCustomers] = useState([]);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);

  // Example transaction data for preview
  const exampleTransaction = {
    cart: [{id:1, name:'Contoh Produk', price:10000, quantity:2, barcode:'12345'}],
    subtotal: 20000,
    discountAmount: 1000,
    taxAmount: 2000,
    total: 21000,
    paymentAmount: 25000,
    change: 4000,
    customer: { name: 'Pelanggan Contoh' }
  };

  // Transform the existing exampleTransaction to also work with InvoiceA4 and DeliveryNote format
  const exampleSale = {
    id: 'EXAMPLE-001',
    created_at: new Date().toISOString(),
    subtotal: exampleTransaction.subtotal,
    discount_amount: exampleTransaction.discountAmount,
    tax_amount: exampleTransaction.taxAmount,
    total_amount: exampleTransaction.total,
    payment_amount: exampleTransaction.paymentAmount,
    change_amount: exampleTransaction.change,
    customer: exampleTransaction.customer,
    items: exampleTransaction.cart.map(item => ({
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      barcode: item.barcode
    }))
  };

  // useReactToPrint hook for A4 invoice preview
  const handlePrintInvoiceA4 = useReactToPrint({
    content: () => invoiceA4Ref.current,
    documentTitle: 'invoice-preview-idcashier'
  });

  // useReactToPrint hook for Delivery Note preview
  const handlePrintDeliveryNote = useReactToPrint({
    content: () => deliveryNoteRef.current,
    documentTitle: 'delivery-note-preview-idcashier',
    pageStyle: `@page { size: A4; margin: 0; }`
  });

  // Handle navigation parameters
  useEffect(() => {
    if (navigationParams && navigationParams.tab) {
      setActiveTab(navigationParams.tab);
      // Clear parameters after use
      clearNavigationParams();
    }
  }, [navigationParams, clearNavigationParams]);


  // Load settings when component mounts
  useEffect(() => {
    if (!user || !user.id) return;
    
    // For cashier accounts, use the tenantId to get store settings
    const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
    const savedStoreSettings = JSON.parse(localStorage.getItem(`idcashier_store_settings_${ownerId}`)) || 
                             { name: '', address: '', phone: '', logo: '/logo.png', bankAccount: '', bankName: '', accountHolder: '', businessOwnerName: '', invoicePrefix: '' }; // Default logo fallback
    setStoreSettings(savedStoreSettings);

    // Load individual receipt settings for each type
    const defaultReceiptSettings = { headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10 };
    const defaultReceiptSettingsWithPrefix = { headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10, invoicePrefix: '' };
    const saved58mm = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_58mm_${ownerId}`)) || defaultReceiptSettings;
    const saved80mm = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_80mm_${ownerId}`)) || defaultReceiptSettings;
    const savedA4 = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_A4_${ownerId}`)) || defaultReceiptSettingsWithPrefix;
    const savedDeliveryNote = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_delivery_note_${ownerId}`)) || defaultReceiptSettingsWithPrefix;
    
    setReceiptSettings58mm(saved58mm);
    setReceiptSettings80mm(saved80mm);
    setReceiptSettingsA4(savedA4);
    setReceiptSettingsDeliveryNote(savedDeliveryNote);
    
    // Load enabled receipt types
    const savedEnabledTypes = JSON.parse(localStorage.getItem(`idcashier_enabled_receipt_types_${ownerId}`)) || {
      '58mm': true,
      '80mm': true,
      'A4': true,
      'delivery-note': true
    };
    setEnabledReceiptTypes(savedEnabledTypes);

    const savedGeneralSettings = JSON.parse(localStorage.getItem(`idcashier_general_settings_${ownerId}`)) || { timezone: 'Asia/Jakarta', currency: 'IDR' };
    setGeneralSettings(savedGeneralSettings);
  }, [user, authUser, token]);
  
  // Fetch customers when component mounts
  useEffect(() => {
    fetchCustomers();
  }, [authUser]);

  const fetchCustomers = async () => {
    if (!authUser) return;
    
    try {
      const customersData = await customersAPI.getAll(token);
      
      // Filter out customers with "default" in their name (case-insensitive) except for the one with id 'default'
      const filteredCustomers = customersData.filter(c => c.id === 'default' || !c.name.toLowerCase().includes('default'));
      
      setCustomers(filteredCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({ title: t('error'), description: `Failed to load customers: ${error.message}`, variant: "destructive" });
    }
  };

  const handleSaveSettings = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    toast({ title: t('success'), description: t('settingsSavedDesc') });
  };

  const handleChangePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: t('error'), description: t('passwordMinChar'), variant: "destructive" });
      return;
    }

    if (user.email === 'demo@idcashier.my.id') {
      toast({ title: t('accessDenied'), description: t('passwordChangeFail'), variant: "destructive" });
      return;
    }
    
    const allCustomers = JSON.parse(localStorage.getItem('idcashier_customers')) || [];
    const updatedCustomers = allCustomers.map(c => {
      if (c.email === user.email) {
        return { ...c, password: newPassword };
      }
      return c;
    });

    localStorage.setItem('idcashier_customers', JSON.stringify(updatedCustomers));
    onUserUpdate({ ...user, password: newPassword });
    setNewPassword('');
    toast({ title: t('success'), description: t('passwordChangeSuccess') });
  };
  
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if file size is too large (more than 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: t('error'), description: t('logoTooLarge'), variant: "destructive" });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const newSettings = {...storeSettings, logo: reader.result};
        setStoreSettings(newSettings);
        handleSaveSettings(`idcashier_store_settings_${user.id}`, newSettings);
        toast({ title: t('logoUpdated'), description: t('logoUpdatedDesc') });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    const newSettings = {...storeSettings, logo: ''};
    setStoreSettings(newSettings);
    handleSaveSettings(`idcashier_store_settings_${user.id}`, newSettings);
    toast({ title: t('logoRemoved'), description: t('logoRemovedDesc') });
  };

  // Customer management functions
  const handleCustomerSubmit = async () => {
    if (!currentCustomer?.name || !currentCustomer?.phone) {
      toast({ title: t('error'), description: t('namePhoneRequired'), variant: "destructive" });
      return;
    }
    
    try {
      if (currentCustomer.id) {
        // Update existing customer
        const { data, error } = await supabase
          .from('customers')
          .update({ name: currentCustomer.name, address: currentCustomer.address || null, phone: currentCustomer.phone, email: currentCustomer.email || null })
          .eq('id', currentCustomer.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update customer in state
        setCustomers(prev => prev.map(c => c.id === currentCustomer.id ? data : c));
        toast({ title: t('success'), description: t('customerUpdated') });
      } else {
        // Add new customer
        const { data, error } = await supabase
          .from('customers')
          .insert([{ id: crypto.randomUUID(), user_id: authUser.id, ...currentCustomer }])
          .select()
          .single();
        
        if (error) throw error;
        
        // Add customer to state
        setCustomers(prev => [...prev, data]);
        toast({ title: t('success'), description: t('customerAdded') });
      }
      
      setIsCustomerDialogOpen(false);
      setCurrentCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: t('error'), description: `Failed to save customer: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);
      
      if (error) throw error;
      
      // Remove customer from state
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      toast({ title: t('deleted'), description: t('customerDeleted') });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({ title: t('error'), description: `Failed to delete customer: ${error.message}`, variant: "destructive" });
    }
  };

  const openCustomerDialog = (customer) => {
    if (customer) {
      setCurrentCustomer({ ...customer });
    } else {
      setCurrentCustomer({ name: '', phone: '', email: '' });
    }
    setIsCustomerDialogOpen(true);
  };

  // Example function showing how to use navigateTo with parameters
  const navigateToReportsWithTab = (tabName) => {
    navigateTo('reports', { activeTab: tabName });
  };

  return (
    <>
      <Helmet><title>{t('settings')} - idCashier</title></Helmet>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">{t('settings')}</h1><p className="text-muted-foreground">{t('settingsSubtitle')}</p></div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-2 ${(hppEnabled || user?.permissions?.canViewHPP || user?.email === 'demo@idcashier.my.id' || user?.email === 'jho.j80@gmail.com') ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
            <TabsTrigger value="toko"><Store className="w-4 h-4 mr-2" />{t('store')}</TabsTrigger>
            <TabsTrigger value="akun"><Users className="w-4 h-4 mr-2" />{t('account')}</TabsTrigger>
            <TabsTrigger value="pelanggan"><Users className="w-4 h-4 mr-2" />{t('customers')}</TabsTrigger>
            <TabsTrigger value="struk"><Printer className="w-4 h-4 mr-2" />{t('receipt')}</TabsTrigger>
            {(user?.permissions?.canViewHPP || user?.role === 'owner' || user?.email === 'demo@idcashier.my.id' || user?.email === 'jho.j80@gmail.com') && (
              <TabsTrigger value="hpp"><DollarSign className="w-4 h-4 mr-2" />{t('hpp')}</TabsTrigger>
            )}
            <TabsTrigger value="umum"><SettingsIcon className="w-4 h-4 mr-2" />{t('general')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="toko">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('storeSettings')}</CardTitle><CardDescription>{t('storeSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="storeName">{t('storeName')}</Label><Input id="storeName" value={storeSettings.name} onChange={e => setStoreSettings({...storeSettings, name: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storeAddress">{t('storeAddress')}</Label><Input id="storeAddress" value={storeSettings.address} onChange={e => setStoreSettings({...storeSettings, address: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storePhone">{t('storePhone')}</Label><Input id="storePhone" value={storeSettings.phone} onChange={e => setStoreSettings({...storeSettings, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="bankAccount">{t('bankAccount')}</Label><Input id="bankAccount" value={storeSettings.bankAccount || ''} onChange={e => setStoreSettings({...storeSettings, bankAccount: e.target.value})} placeholder="1234567890" /></div>
                <div className="space-y-2"><Label htmlFor="bankName">{t('bankName')}</Label><Input id="bankName" value={storeSettings.bankName || ''} onChange={e => setStoreSettings({...storeSettings, bankName: e.target.value})} placeholder="Bank BCA, Bank Mandiri, dll" /></div>
                <div className="space-y-2"><Label htmlFor="accountHolder">{t('accountHolder')}</Label><Input id="accountHolder" value={storeSettings.accountHolder || ''} onChange={e => setStoreSettings({...storeSettings, accountHolder: e.target.value})} placeholder="Nama pemilik rekening" /></div>
                <div className="space-y-2"><Label htmlFor="businessOwnerName">{t('businessOwnerName')}</Label><Input id="businessOwnerName" value={storeSettings.businessOwnerName || ''} onChange={e => setStoreSettings({...storeSettings, businessOwnerName: e.target.value})} placeholder="Nama pemilik/pengelola usaha" /></div>
                <div className="space-y-2"><Label>{t('storeLogo')}</Label>
                  <div className="flex items-center gap-4">
                    {storeSettings.logo ? <img src={storeSettings.logo} alt="Logo" className="w-16 h-16 rounded-md border p-1 object-contain" /> : <div className="w-16 h-16 rounded-md border flex items-center justify-center bg-muted"><ImageIcon className="w-8 h-8 text-muted-foreground"/></div>}
                    <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                    <Button variant="outline" onClick={() => logoInputRef.current.click()}><ImageIcon className="w-4 h-4 mr-2" /> {t('changeLogo')}</Button>
                  </div>
                </div>
                <Button onClick={() => handleSaveSettings(`idcashier_store_settings_${user.id}`, storeSettings)}>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="akun">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('accountManagement')}</CardTitle><CardDescription>{t('accountManagementDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">{t('yourAccount')}</h3>
                  <div className="space-y-2"><Label htmlFor="owner-email">{t('email')}</Label><Input id="owner-email" value={user.email} disabled /></div>
                  <div className="space-y-2 mt-4"><Label htmlFor="owner-password">{t('newPassword')}</Label><Input id="owner-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={user.email === 'demo@idcashier.my.id'} /></div>
                  <Button className="mt-4" onClick={handleChangePassword} disabled={user.email === 'demo@idcashier.my.id'}><KeyRound className="w-4 h-4 mr-2" /> {t('changePassword')}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pelanggan">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t('customerManagement')}</CardTitle>
                <CardDescription>{t('customerManagementDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Back to Sales button if navigationParams.returnTo === 'sales' */}
                {navigationParams && navigationParams.returnTo === 'sales' && (
                  <Button onClick={() => navigateTo('sales', { refreshCustomers: true })}>
                    {t('backToSales')}
                  </Button>
                )}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{t('customers')}</h3>
                  <Button onClick={() => openCustomerDialog(null)}>
                    <Plus className="w-4 h-4 mr-2" /> {t('addCustomer')}
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">{t('name')}</th>
                        <th className="text-left p-3">{t('address')}</th>
                        <th className="text-left p-3">{t('phone')}</th>
                        <th className="text-left p-3">{t('email')}</th>
                        <th className="text-right p-3">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center p-6 text-muted-foreground">
                            {t('noCustomers')}
                          </td>
                        </tr>
                      ) : (
                        customers.map(customer => (
                          <tr key={customer.id} className="border-b hover:bg-muted/50">
                            <td className="p-3">{customer.name}</td>
                            <td className="p-3">{customer.address || '-'}</td>
                            <td className="p-3">{customer.phone}</td>
                            <td className="p-3">{customer.email || '-'}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openCustomerDialog(customer)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteCustomer(customer.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="struk">
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t('receiptSettings')}</CardTitle>
                <CardDescription>{t('receiptSettingsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-[300px_1fr] gap-6">
                  {/* Left sidebar - Receipt type buttons */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">
                      {t('receiptTypeSettings')}
                    </h3>
                    
                    {/* 58mm Thermal Button */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedReceiptType === '58mm' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedReceiptType('58mm')}
                    >
                      <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5" />
                        <span className="font-medium">{t('thermal58mm')}</span>
                      </div>
                      <Switch 
                        checked={enabledReceiptTypes['58mm']} 
                        onCheckedChange={(checked) => {
                          const newEnabled = {...enabledReceiptTypes, '58mm': checked};
                          setEnabledReceiptTypes(newEnabled);
                          const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
                          localStorage.setItem(`idcashier_enabled_receipt_types_${ownerId}`, JSON.stringify(newEnabled));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* 80mm Thermal Button */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedReceiptType === '80mm' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedReceiptType('80mm')}
                    >
                      <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5" />
                        <span className="font-medium">{t('thermal80mm')}</span>
                      </div>
                      <Switch 
                        checked={enabledReceiptTypes['80mm']} 
                        onCheckedChange={(checked) => {
                          const newEnabled = {...enabledReceiptTypes, '80mm': checked};
                          setEnabledReceiptTypes(newEnabled);
                          const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
                          localStorage.setItem(`idcashier_enabled_receipt_types_${ownerId}`, JSON.stringify(newEnabled));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* A4 Invoice Button */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedReceiptType === 'A4' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedReceiptType('A4')}
                    >
                      <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5" />
                        <span className="font-medium">{t('invoiceA4')}</span>
                      </div>
                      <Switch 
                        checked={enabledReceiptTypes['A4']} 
                        onCheckedChange={(checked) => {
                          const newEnabled = {...enabledReceiptTypes, 'A4': checked};
                          setEnabledReceiptTypes(newEnabled);
                          const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
                          localStorage.setItem(`idcashier_enabled_receipt_types_${ownerId}`, JSON.stringify(newEnabled));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Delivery Note Button */}
                    <div 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedReceiptType === 'delivery-note' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedReceiptType('delivery-note')}
                    >
                      <div className="flex items-center gap-3">
                        <Printer className="w-5 h-5" />
                        <span className="font-medium">{t('deliveryNote')}</span>
                      </div>
                      <Switch 
                        checked={enabledReceiptTypes['delivery-note']} 
                        onCheckedChange={(checked) => {
                          const newEnabled = {...enabledReceiptTypes, 'delivery-note': checked};
                          setEnabledReceiptTypes(newEnabled);
                          const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
                          localStorage.setItem(`idcashier_enabled_receipt_types_${ownerId}`, JSON.stringify(newEnabled));
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  
                  {/* Right panel - Settings form and preview */}
                  <div>
                    {selectedReceiptType === null ? (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">
                        <p>{t('noReceiptTypeSelected')}</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Settings Form */}
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">
                            {selectedReceiptType === '58mm' && t('thermal58mm')}
                            {selectedReceiptType === '80mm' && t('thermal80mm')}
                            {selectedReceiptType === 'A4' && t('invoiceA4')}
                            {selectedReceiptType === 'delivery-note' && t('deliveryNote')}
                          </h3>
                          
                          {(() => {
                            // Get current settings and setter based on selected type
                            let currentSettings, setCurrentSettings;
                            if (selectedReceiptType === '58mm') {
                              currentSettings = receiptSettings58mm;
                              setCurrentSettings = setReceiptSettings58mm;
                            } else if (selectedReceiptType === '80mm') {
                              currentSettings = receiptSettings80mm;
                              setCurrentSettings = setReceiptSettings80mm;
                            } else if (selectedReceiptType === 'A4') {
                              currentSettings = receiptSettingsA4;
                              setCurrentSettings = setReceiptSettingsA4;
                            } else if (selectedReceiptType === 'delivery-note') {
                              currentSettings = receiptSettingsDeliveryNote;
                              setCurrentSettings = setReceiptSettingsDeliveryNote;
                            }
                            
                            return (
                              <>
                                <div className="space-y-2">
                                  <Label htmlFor="receiptHeader">{t('headerText')}</Label>
                                  <Input 
                                    id="receiptHeader" 
                                    value={currentSettings.headerText} 
                                    onChange={e => setCurrentSettings({...currentSettings, headerText: e.target.value})} 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="receiptFooter">{t('footerText')}</Label>
                                  <Input 
                                    id="receiptFooter" 
                                    value={currentSettings.footerText} 
                                    onChange={e => setCurrentSettings({...currentSettings, footerText: e.target.value})} 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="receiptMargin">{t('margin')}</Label>
                                  <Input 
                                    id="receiptMargin" 
                                    type="number" 
                                    value={currentSettings.margin} 
                                    onChange={e => setCurrentSettings({...currentSettings, margin: Number(e.target.value)})} 
                                  />
                                </div>
                                
                                {/* Invoice Prefix - Only for A4 and Delivery Note */}
                                {(selectedReceiptType === 'A4' || selectedReceiptType === 'delivery-note') && (
                                  <div className="space-y-2">
                                    <Label htmlFor="invoicePrefix">{t('invoicePrefix')}</Label>
                                    <Input 
                                      id="invoicePrefix" 
                                      value={currentSettings.invoicePrefix || ''} 
                                      onChange={e => setCurrentSettings({...currentSettings, invoicePrefix: e.target.value})} 
                                      placeholder="INV-MGK"
                                    />
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                  <Label>{t('showAddress')}</Label>
                                  <Switch 
                                    checked={currentSettings.showAddress} 
                                    onCheckedChange={v => setCurrentSettings({...currentSettings, showAddress: v})} 
                                  />
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                  <Label>{t('showPhone')}</Label>
                                  <Switch 
                                    checked={currentSettings.showPhone} 
                                    onCheckedChange={v => setCurrentSettings({...currentSettings, showPhone: v})} 
                                  />
                                </div>
                                <Button 
                                  onClick={() => {
                                    const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
                                    const key = `idcashier_receipt_settings_${selectedReceiptType}_${ownerId}`;
                                    handleSaveSettings(key, currentSettings);
                                  }}
                                >
                                  {t('saveChanges')}
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                        
                        {/* Preview */}
                        <div>
                          <Label>{t('receiptPreview')}</Label>
                          <div className="mt-2 border rounded-lg overflow-hidden bg-gray-50">
                            {selectedReceiptType === '58mm' || selectedReceiptType === '80mm' ? (
                              <div className="bg-gray-200 p-4 overflow-auto">
                                <PrintReceipt 
                                  {...exampleTransaction} 
                                  settings={{
                                    ...storeSettings, 
                                    ...(selectedReceiptType === '58mm' ? receiptSettings58mm : receiptSettings80mm)
                                  }} 
                                  paperSize={selectedReceiptType} 
                                />
                              </div>
                            ) : selectedReceiptType === 'A4' ? (
                              <>
                                <div className="bg-white border-b p-3 flex justify-between items-center">
                                  <h3 className="font-semibold text-sm">{t('invoicePreview')}</h3>
                                  <Button onClick={handlePrintInvoiceA4} size="sm" variant="outline">
                                    <Printer className="w-4 h-4 mr-2" />
                                    {t('print')}
                                  </Button>
                                </div>
                                <div className="bg-gray-200 p-4 overflow-auto">
                                  <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                                    <div className="printable-invoice-area">
                                      <InvoiceA4 
                                        ref={invoiceA4Ref} 
                                        sale={exampleSale} 
                                        companyInfo={{...storeSettings, ...receiptSettingsA4, logoUrl: storeSettings.logo}} 
                                        userId={user?.id}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : selectedReceiptType === 'delivery-note' ? (
                              <>
                                <div className="bg-white border-b p-3 flex justify-between items-center">
                                  <h3 className="font-semibold text-sm">{t('deliveryNotePreview')}</h3>
                                  <Button onClick={handlePrintDeliveryNote} size="sm" variant="outline">
                                    <Printer className="w-4 h-4 mr-2" />
                                    {t('print')}
                                  </Button>
                                </div>
                                <div className="bg-gray-200 p-4 overflow-auto">
                                  <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
                                    <div className="printable-invoice-area">
                                      <DeliveryNote
                                        ref={deliveryNoteRef}
                                        sale={exampleSale}
                                        companyInfo={{...storeSettings, ...receiptSettingsDeliveryNote, logoUrl: storeSettings.logo}}
                                        showPrice={true}
                                        receiverName=""
                                        senderName=""
                                        context="settings"
                                        userId={user?.id}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {(user?.permissions?.canViewHPP || user?.role === 'owner' || user?.email === 'demo@idcashier.my.id' || user?.email === 'jho.j80@gmail.com') && (
            <TabsContent value="hpp">
              <div className="mt-4">
                <HPPSettings />
              </div>
            </TabsContent>
          )}

          <TabsContent value="umum">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('generalSettings')}</CardTitle><CardDescription>{t('generalSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3"><Label>{t('darkMode')}</Label><Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} /></div>
                <div className="space-y-2"><Label>{t('language')}</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="id">Indonesia</SelectItem><SelectItem value="zh">中文</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>{t('timezone')}</Label><Select value={generalSettings.timezone} onValueChange={v => setGeneralSettings({...generalSettings, timezone: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Asia/Jakarta">Asia/Jakarta (WIB)</SelectItem><SelectItem value="Asia/Makassar">Asia/Makassar (WITA)</SelectItem><SelectItem value="Asia/Jayapura">Asia/Jayapura (WIT)</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>{t('currency')}</Label><Select value={generalSettings.currency} onValueChange={v => setGeneralSettings({...generalSettings, currency: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IDR">IDR (Rupiah)</SelectItem><SelectItem value="USD">USD (Dollar)</SelectItem><SelectItem value="CNY">CNY (Yuan)</SelectItem></SelectContent></Select></div>
                <Button onClick={() => handleSaveSettings(`idcashier_general_settings_${user.id}`, generalSettings)}>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCustomer?.id ? t('edit') : t('add')} {t('customers')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">{t('name')}</Label>
              <Input 
                id="customer-name" 
                value={currentCustomer?.name || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, name: e.target.value})} 
                placeholder={t('customerNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-address">{t('address')}</Label>
              <Input 
                id="customer-address" 
                value={currentCustomer?.address || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, address: e.target.value})} 
                placeholder={t('address')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">{t('phone')}</Label>
              <Input 
                id="customer-phone" 
                value={currentCustomer?.phone || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} 
                placeholder={t('phone')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">{t('email')}</Label>
              <Input 
                id="customer-email" 
                value={currentCustomer?.email || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, email: e.target.value})} 
                placeholder={t('emailPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCustomerSubmit}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SettingsPage;