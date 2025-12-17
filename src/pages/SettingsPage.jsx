import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
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
import { Users, Store, Printer, Settings as SettingsIcon, Image as ImageIcon, Trash2, KeyRound, Plus, Edit, DollarSign, Info, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PrintReceipt from '@/components/PrintReceipt';
import InvoiceA4 from '@/components/InvoiceA4';
import DeliveryNote from '@/components/DeliveryNote';
import DeliveryNoteDesigner from '@/components/DeliveryNoteDesigner';
import InvoiceA4Designer from '@/components/InvoiceA4Designer';
import ThermalReceiptDesigner from '@/components/ThermalReceiptDesigner';
import HPPSettings from '@/components/HPPSettings';
import { supabase } from '@/lib/supabaseClient';
import { usersAPI, customersAPI, storeSettingsAPI } from '@/lib/api';
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
  const { hppEnabled, refreshHPPSetting } = useHPP();
  const logoInputRef = useRef(null);
  // Check URL params for tab (e.g., from store setup redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'toko');

  const [storeSettings, setStoreSettings] = useState({ name: '', address: '', phone: '', logo: '/logo.png', bankAccount: '', bankName: '', accountHolder: '', businessOwnerName: '', position: '', invoicePrefix: '', npwp: '' });
  const [generalSettings, setGeneralSettings] = useState({ timezone: 'Asia/Jakarta', currency: 'IDR' });
  
  // Individual receipt settings for each type
  const [designSettings58mm, setDesignSettings58mm] = useState({});
  const [designSettings80mm, setDesignSettings80mm] = useState({});
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
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [email, setEmail] = useState('');

  // Update email state when user changes
  useEffect(() => {
    if (authUser?.email) setEmail(authUser.email);
  }, [authUser]);

  const handleUpdateEmail = async () => {
    if (!email || email === authUser.email) return;
    try {
      const { error } = await supabase.auth.updateUser({ email: email });
      if (error) throw error;
      toast({ 
        title: t('success'), 
        description: t('emailUpdateConfirmationSent')
      });
    } catch (error) {
      toast({ title: t('error'), description: error.message, variant: 'destructive' });
    }
  };

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

  // Handle navigation parameters and URL params
  useEffect(() => {
    // Check URL params first (e.g., from store setup redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get('tab');
    const hppRefreshed = urlParams.get('hpp_refreshed') === 'true';
    
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
      // Remove tab from URL after setting it
      urlParams.delete('tab');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    } else if (navigationParams && navigationParams.tab) {
      setActiveTab(navigationParams.tab);
      // Clear parameters after use
      clearNavigationParams();
    }
    
    // Force refresh HPP setting if flag is present
    if (hppRefreshed || localStorage.getItem('idcashier_hpp_refresh_needed') === 'true') {
      console.log('🔄 Force refreshing HPP setting in SettingsPage...');
      localStorage.removeItem('idcashier_hpp_refresh_needed');
      if (refreshHPPSetting) {
        // Add small delay to ensure backend has processed the callback
        setTimeout(() => {
          refreshHPPSetting();
        }, 500);
      }
    }
  }, [navigationParams, clearNavigationParams, refreshHPPSetting]);


  // Load settings when component mounts
  useEffect(() => {
    loadAllSettings();
  }, [user, authUser, token]);

  const loadAllSettings = async () => {
    if (!user?.id || !token) return;
    
    try {
      // Load all settings from database
      const allSettings = await storeSettingsAPI.load(token);
      
      // Set store settings from database or use defaults
      setStoreSettings({
        name: allSettings.store?.name || allSettings.storeSettings?.name || '',
        address: allSettings.store?.address || allSettings.storeSettings?.address || '',
        phone: allSettings.store?.phone || allSettings.storeSettings?.phone || '',
        logo: allSettings.store?.logo || allSettings.storeSettings?.logo || '/logo.png',
        bankAccount: allSettings.store?.bankAccount || allSettings.storeSettings?.bankAccount || '',
        bankName: allSettings.store?.bankName || allSettings.storeSettings?.bankName || '',
        accountHolder: allSettings.store?.accountHolder || allSettings.storeSettings?.accountHolder || '',
        businessOwnerName: allSettings.store?.businessOwnerName || allSettings.storeSettings?.businessOwnerName || '',
        position: allSettings.store?.position || allSettings.storeSettings?.position || '',
        invoicePrefix: allSettings.store?.invoicePrefix || allSettings.storeSettings?.invoicePrefix || '',
        npwp: allSettings.store?.npwp || allSettings.storeSettings?.npwp || ''
      });

      // Set receipt settings from database or use defaults
      // Load design settings for thermal printers, fallback to empty object
      setDesignSettings58mm(allSettings.receipt58mmDesign || {});
      setDesignSettings80mm(allSettings.receipt80mmDesign || {});

      // Keep legacy settings for A4 and delivery note for now
      const defaultReceiptSettingsWithPrefix = { headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10, invoicePrefix: '' };
      setReceiptSettingsA4(allSettings.receipt_A4 || defaultReceiptSettingsWithPrefix);
      setReceiptSettingsDeliveryNote(allSettings.receipt_delivery_note || defaultReceiptSettingsWithPrefix);
      
      // Set enabled receipt types
      setEnabledReceiptTypes(allSettings.enabled_receipt_types || {
        '58mm': true,
        '80mm': true,
        'A4': true,
        'delivery-note': true
      });

      // Set general settings from database or use defaults
      setGeneralSettings(allSettings.general || { timezone: 'Asia/Jakarta', currency: 'IDR' });
      
    } catch (error) {
      console.error('Error loading settings:', error);
      // If database load fails, try localStorage as fallback
      const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
      
      const savedStoreSettingsRaw = localStorage.getItem(`idcashier_store_settings_${ownerId}`);
      const savedStoreSettings = savedStoreSettingsRaw ? JSON.parse(savedStoreSettingsRaw) : 
                               { name: '', address: '', phone: '', logo: '/logo.png', bankAccount: '', bankName: '', accountHolder: '', businessOwnerName: '', position: '', invoicePrefix: '', npwp: '' };
      setStoreSettings({
        name: savedStoreSettings.name || '',
        address: savedStoreSettings.address || '',
        phone: savedStoreSettings.phone || '',
        logo: savedStoreSettings.logo || '/logo.png',
        bankAccount: savedStoreSettings.bankAccount || '',
        bankName: savedStoreSettings.bankName || '',
        accountHolder: savedStoreSettings.accountHolder || '',
        businessOwnerName: savedStoreSettings.businessOwnerName || '',
        position: savedStoreSettings.position || '',
        invoicePrefix: savedStoreSettings.invoicePrefix || '',
        npwp: savedStoreSettings.npwp || ''
      });

      // Fallback to localStorage for design settings
      const saved58mmDesign = JSON.parse(localStorage.getItem(`idcashier_receipt_58mm_design_${ownerId}`)) || {};
      const saved80mmDesign = JSON.parse(localStorage.getItem(`idcashier_receipt_80mm_design_${ownerId}`)) || {};
      setDesignSettings58mm(saved58mmDesign);
      setDesignSettings80mm(saved80mmDesign);

      // Keep legacy settings for A4 and delivery note for now
      const defaultReceiptSettingsWithPrefix = { headerText: '', footerText: t('receiptFooter'), showAddress: true, showPhone: true, margin: 10, invoicePrefix: '' };
      const savedA4 = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_A4_${ownerId}`)) || defaultReceiptSettingsWithPrefix;
      const savedDeliveryNote = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_delivery_note_${ownerId}`)) || defaultReceiptSettingsWithPrefix;
      setReceiptSettingsA4(savedA4);
      setReceiptSettingsDeliveryNote(savedDeliveryNote);
      
      const savedEnabledTypes = JSON.parse(localStorage.getItem(`idcashier_enabled_receipt_types_${ownerId}`)) || {
        '58mm': true,
        '80mm': true,
        'A4': true,
        'delivery-note': true
      };
      setEnabledReceiptTypes(savedEnabledTypes);

      const savedGeneralSettings = JSON.parse(localStorage.getItem(`idcashier_general_settings_${ownerId}`)) || { timezone: 'Asia/Jakarta', currency: 'IDR' };
      setGeneralSettings(savedGeneralSettings);
      
      // Show warning toast about fallback to localStorage
      toast({
        title: t('warning'),
        description: t('fallbackToLocalStorage'),
        variant: "destructive"
      });
    }
  };
  
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
      toast({ title: t('error'), description: `${t('failedToLoadCustomers')}: ${error.message}`, variant: "destructive" });
    }
  };

  const handleSaveSettings = async (category, data) => {
    if (!token) {
        toast({ title: t('error'), description: t('noAuthToken'), variant: "destructive" });
        return;
    }
    try {
        const settingsToSave = { [category]: data };
        await storeSettingsAPI.save(settingsToSave, token);
        
        const ownerId = user.role === 'cashier' ? user.tenantId : user.id;
        let localStorageKey;
        switch(category) {
            case 'store':
                localStorageKey = `idcashier_store_settings_${ownerId}`;
                break;
            case 'receipt58mmDesign':
                 localStorageKey = `idcashier_receipt_58mm_design_${ownerId}`;
                 break;
            case 'receipt80mmDesign':
                 localStorageKey = `idcashier_receipt_80mm_design_${ownerId}`;
                 break;
            case 'receipt_A4':
                localStorageKey = `idcashier_receipt_settings_A4_${ownerId}`;
                break;
            case 'receipt_delivery_note':
                localStorageKey = `idcashier_receipt_settings_delivery_note_${ownerId}`;
                break;
            case 'enabled_receipt_types':
                localStorageKey = `idcashier_enabled_receipt_types_${ownerId}`;
                break;
            case 'general':
                localStorageKey = `idcashier_general_settings_${ownerId}`;
                break;
            default:
                // Fallback for old receipt settings keys if needed
                if (category.startsWith('receipt_')) {
                    localStorageKey = `idcashier_${category}_settings_${ownerId}`;
                } else {
                    console.warn(`Unhandled settings category: ${category}`);
                    return;
                }
        }
        localStorage.setItem(localStorageKey, JSON.stringify(data));

        // Update state after saving
        if (category === 'receipt58mmDesign') setDesignSettings58mm(data);
        if (category === 'receipt80mmDesign') setDesignSettings80mm(data);
        if (category === 'store') setStoreSettings(data);
        // ... update other states if necessary

        toast({ title: t('success'), description: t('settingsSavedDesc') });
    } catch (error) {
        console.error(`Error saving ${category}:`, error);
        toast({
            title: t('error'),
            description: `${t('settingsSaveFailed')}: ${error.message}`,
            variant: "destructive"
        });
        // Re-throw the error to be caught by the calling function if needed
        throw error;
    }
};

  const handleChangePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: t('error'), description: t('passwordMinLength'), variant: "destructive" });
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
        handleSaveSettings('store', newSettings);
        toast({ title: t('logoUpdated'), description: t('logoUpdatedDesc') });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    const newSettings = {...storeSettings, logo: ''};
    setStoreSettings(newSettings);
    handleSaveSettings('store', newSettings);
    toast({ title: t('logoRemoved'), description: t('logoRemovedDesc') });
  };

  // Customer management functions
  const handleCustomerSubmit = async () => {
    if (!currentCustomer?.name || !currentCustomer?.phone) {
      toast({ title: t('error'), description: t('namePhoneRequired'), variant: "destructive" });
      return;
    }
    
    try {
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      if (currentCustomer.id) {
        // Update existing customer using customersAPI
        const data = await customersAPI.update(currentCustomer.id, {
          name: currentCustomer.name,
          address: currentCustomer.address || null,
          phone: currentCustomer.phone,
          email: currentCustomer.email || null
        }, token);
        
        // Update customer in state
        setCustomers(prev => prev.map(c => c.id === currentCustomer.id ? data : c));
        toast({ title: t('success'), description: t('customerUpdated') });
      } else {
        // Add new customer using customersAPI
        const data = await customersAPI.create({
          name: currentCustomer.name,
          address: currentCustomer.address || null,
          phone: currentCustomer.phone,
          email: currentCustomer.email || null
        }, token);
        
        // Add customer to state
        setCustomers(prev => [...prev, data]);
        toast({ title: t('success'), description: t('customerAdded') });
      }
      
      setIsCustomerDialogOpen(false);
      setCurrentCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({ title: t('error'), description: `${t('failedToSaveCustomer')}: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      await customersAPI.delete(customerId, token);
      
      // Remove customer from state
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      toast({ title: t('deleted'), description: t('customerDeleted') });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({ title: t('error'), description: `${t('failedToDeleteCustomer')}: ${error.message}`, variant: "destructive" });
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
          <TabsList className={`grid w-full grid-cols-2 gap-1 ${(hppEnabled || user?.permissions?.canViewHPP || user?.email === 'demo@idcashier.my.id' || user?.email === 'jho.j80@gmail.com') ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
            <TabsTrigger value="toko" className="text-xs sm:text-sm"><Store className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('store')}</TabsTrigger>
            <TabsTrigger value="akun" className="text-xs sm:text-sm"><Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('account')}</TabsTrigger>
            <TabsTrigger value="pelanggan" className="text-xs sm:text-sm"><Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('customers')}</TabsTrigger>
            <TabsTrigger value="struk" className="text-xs sm:text-sm"><Printer className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('printSetting')}</TabsTrigger>
            {(user?.permissions?.canViewHPP || user?.role === 'owner' || user?.email === 'demo@idcashier.my.id' || user?.email === 'jho.j80@gmail.com') && (
              <TabsTrigger value="hpp" className="text-xs sm:text-sm"><DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('hpp')}</TabsTrigger>
            )}
            <TabsTrigger value="umum" className="text-xs sm:text-sm"><SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />{t('general')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="toko">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('storeSettings')}</CardTitle><CardDescription>{t('storeSettingsDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor="storeName">{t('storeName')}</Label><Input id="storeName" value={storeSettings.name} onChange={e => setStoreSettings({...storeSettings, name: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storeAddress">{t('storeAddress')}</Label><Input id="storeAddress" value={storeSettings.address} onChange={e => setStoreSettings({...storeSettings, address: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="storePhone">{t('storePhone')}</Label><Input id="storePhone" value={storeSettings.phone} onChange={e => setStoreSettings({...storeSettings, phone: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="bankAccount">{t('bankAccount')}</Label><Input id="bankAccount" value={storeSettings.bankAccount || ''} onChange={e => setStoreSettings({...storeSettings, bankAccount: e.target.value})} placeholder={t('bankAccountPlaceholder')} /></div>
                <div className="space-y-2"><Label htmlFor="bankName">{t('bankName')}</Label><Input id="bankName" value={storeSettings.bankName || ''} onChange={e => setStoreSettings({...storeSettings, bankName: e.target.value})} placeholder={t('bankNamePlaceholder')} /></div>
                <div className="space-y-2"><Label htmlFor="accountHolder">{t('accountHolder')}</Label><Input id="accountHolder" value={storeSettings.accountHolder || ''} onChange={e => setStoreSettings({...storeSettings, accountHolder: e.target.value})} placeholder={t('accountHolderPlaceholder')} /></div>
                <div className="space-y-2"><Label htmlFor="businessOwnerName">{t('businessOwnerName')}</Label><Input id="businessOwnerName" value={storeSettings.businessOwnerName || ''} onChange={e => setStoreSettings({...storeSettings, businessOwnerName: e.target.value})} placeholder={t('businessOwnerPlaceholder')} /></div>
                <div className="space-y-2"><Label htmlFor="position">{t('position')}</Label><Input id="position" value={storeSettings.position || ''} onChange={e => setStoreSettings({...storeSettings, position: e.target.value})} placeholder={t('positionPlaceholder')} /></div>
                <div className="space-y-2"><Label>{t('storeLogo')}</Label>
                  <div className="flex items-center gap-4">
                    {storeSettings.logo ? <img src={storeSettings.logo} alt="Logo" className="w-16 h-16 rounded-md border p-1 object-contain" /> : <div className="w-16 h-16 rounded-md border flex items-center justify-center bg-muted"><ImageIcon className="w-8 h-8 text-muted-foreground"/></div>}
                    <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                    <Button variant="outline" onClick={() => logoInputRef.current.click()}><ImageIcon className="w-4 h-4 mr-2" /> {t('changeLogo')}</Button>
                  </div>
                </div>
                <Button onClick={() => handleSaveSettings('store', storeSettings)}>{t('saveChanges')}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="akun">
            <Card className="mt-4">
              <CardHeader><CardTitle>{t('accountManagement')}</CardTitle><CardDescription>{t('accountManagementDesc')}</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">{t('yourAccount')}</h3>
                  
                  {authUser?.new_email && (
                    <Alert className="mb-4 bg-yellow-50 border-yellow-200 text-yellow-800">
                      <Info className="h-4 w-4 text-yellow-600" />
                      <AlertDescription>
                        {t('pendingEmailChange')} {authUser.new_email}. {t('verifyNewEmailDesc')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {(() => {
                    const whitelist = (import.meta.env.VITE_APP_DEMO_DEV_WHITELIST || 'demo@idcashier.my.id,jho.j80@gmail.com')
                      .split(',')
                      .map(e => String(e || '').trim().toLowerCase())
                      .filter(Boolean);
                    const isWhitelisted = whitelist.includes(String(authUser?.email || '').toLowerCase());
                    
                    // Email verification is no longer required - all users are auto-verified
                    // Removed email verification check
                    return null;
                  })()}

                  <div className="space-y-2">
                    <Label htmlFor="owner-email">{t('email')}</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="owner-email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        disabled={user.email === 'demo@idcashier.my.id'} 
                      />
                      <Button 
                        onClick={handleUpdateEmail} 
                        disabled={user.email === 'demo@idcashier.my.id' || email === authUser.email}
                        variant="outline"
                      >
                        {t('update')}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="owner-password">{t('newPassword')}</Label>
                    <div className="relative">
                      <Input 
                        id="owner-password" 
                        type={showNewPassword ? "text" : "password"} 
                        placeholder={t('enterNewPassword')}
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        disabled={user.email === 'demo@idcashier.my.id'} 
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
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
                          handleSaveSettings('enabled_receipt_types', newEnabled);
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
                          handleSaveSettings('enabled_receipt_types', newEnabled);
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
                          handleSaveSettings('enabled_receipt_types', newEnabled);
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
                          handleSaveSettings('enabled_receipt_types', newEnabled);
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
                    ) : selectedReceiptType === 'delivery-note' ? (
                      <DeliveryNoteDesigner 
                        storeSettings={storeSettings}
                        onSave={loadAllSettings}
                      />
                    ) : selectedReceiptType === 'A4' ? (
                      <InvoiceA4Designer 
                        storeSettings={storeSettings}
                        onSave={loadAllSettings}
                      />
                    ) : selectedReceiptType === '58mm' ? (
                      <ThermalReceiptDesigner
                        paperSize="58mm"
                        storeSettings={storeSettings}
                        initialSettings={designSettings58mm}
                        onSave={(newSettings) => handleSaveSettings('receipt58mmDesign', newSettings)}
                      />
                    ) : selectedReceiptType === '80mm' ? (
                      <ThermalReceiptDesigner
                        paperSize="80mm"
                        storeSettings={storeSettings}
                        initialSettings={designSettings80mm}
                        onSave={(newSettings) => handleSaveSettings('receipt80mmDesign', newSettings)}
                      />
                    ) : null}
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
                <Button onClick={() => handleSaveSettings('general')}>{t('saveChanges')}</Button>
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
                placeholder={t('addressPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">{t('phone')}</Label>
              <Input 
                id="customer-phone" 
                value={currentCustomer?.phone || ''} 
                onChange={e => setCurrentCustomer({...currentCustomer, phone: e.target.value})} 
                placeholder={t('phonePlaceholder')}
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
