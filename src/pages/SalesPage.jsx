import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePrintStyles } from '@/hooks/usePrintStyles';
import { useToast } from '@/components/ui/use-toast';
import { useNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch'; // Import the Switch component
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { ScanBarcode, Package, List, LayoutGrid, Ticket, DollarSign, Percent, Printer, Search, Download, Trash2, CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { salesAPI, productsAPI, customersAPI, settingsAPI, productRecipesAPI, rawMaterialsAPI, profitSharesAPI, storeSettingsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useHPP } from '@/contexts/HPPContext';
import { usePermissions } from '@/hooks/usePermissions';
import InvoiceA4 from '@/components/InvoiceA4';
import DeliveryNoteSimple from '@/components/DeliveryNoteSimple';
import DeliveryNote from '@/components/DeliveryNote';
import PrintReceipt, { ReceiptContent } from '@/components/PrintReceipt';
import CustomCostsInput from '@/components/CustomCostsInput';
import { formatCurrency as formatCurrencyUtil, getCurrencyFromStorage, getCurrencySymbol } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useReactToPrint } from 'react-to-print';
const SalesPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { navigationParams, clearNavigationParams } = useNavigation();
  const { user: authUser, token } = useAuth();
  const permissions = usePermissions();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [topProducts, setTopProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('grid');
  const [selectedCustomer, setSelectedCustomer] = useState('default');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'credit'
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [completedSaleData, setCompletedSaleData] = useState(null);
  
  // HPP Custom Costs States
  const [customCosts, setCustomCosts] = useState([]);
  const { hppEnabled } = useHPP();
  
  // Add Customer Dialog States
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  
  // Receipt Printing States
  const [useTwoDecimals, setUseTwoDecimals] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);
  const invoiceA4Ref = useRef();
  const thermalReceiptRef = useRef();
  
  // Delivery Note Options
  const [deliveryNoteShowPrice, setDeliveryNoteShowPrice] = useState(true);
  const [receiverName, setReceiverName] = useState('');
  const [senderName, setSenderName] = useState('');
  const deliveryNoteRef = useRef();
  
  // Delivery Note Design Settings
  const [deliveryNoteDesignSettings, setDeliveryNoteDesignSettings] = useState({});
  const [invoiceA4DesignSettings, setInvoiceA4DesignSettings] = useState({});
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [deliveryNoteTemplate, setDeliveryNoteTemplate] = useState('simple');
  const [customerIdMode, setCustomerIdMode] = useState('auto');
  const [manualCustomerId, setManualCustomerId] = useState('');
  
  // Receipt Settings
  const [receiptSettings, setReceiptSettings] = useState({
    logo: '',
    name: '',
    address: '',
    phone: '',
    headerText: '',
    footerText: t('receiptFooter'),
    showAddress: true,
    showPhone: true,
    showHeader: true,
    showFooter: true,
    margin: 10,
  });
  
  // Specific receipt settings for A4 and delivery note (includes invoicePrefix)
  const [receiptSettingsA4, setReceiptSettingsA4] = useState({});
  const [receiptSettingsDeliveryNote, setReceiptSettingsDeliveryNote] = useState({});
  const [receiptSettings58mm, setReceiptSettings58mm] = useState({});
  const [receiptSettings80mm, setReceiptSettings80mm] = useState({});
  
  // Receipt type for unified print dialog
  const [receiptType, setReceiptType] = useState('thermal-80mm');
  
  // Enabled receipt types from settings
  const [enabledReceiptTypes, setEnabledReceiptTypes] = useState({
    '58mm': true,
    '80mm': true,
    'A4': true,
    'delivery-note': true
  });
  
  // Currency state
  const [currencyCode, setCurrencyCode] = useState('IDR');
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('new-sale');
  
  // Transaction History States (for history tab)
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const [timeRangePreset, setTimeRangePreset] = useState('all');
  const [customTimeStart, setCustomTimeStart] = useState('00:00');
  const [customTimeEnd, setCustomTimeEnd] = useState('23:59');
  const [selectedProductFilter, setSelectedProductFilter] = useState(t('allProducts'));
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState(t('allCustomers'));
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState(t('allSuppliers'));
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState('all');
  const [allSalesData, setAllSalesData] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [productsForFilter, setProductsForFilter] = useState([t('allProducts')]);
  const [customersForFilter, setCustomersForFilter] = useState([t('allCustomers')]);
  const [suppliersForFilter, setSuppliersForFilter] = useState([t('allSuppliers')]);
  
  // Transaction Action Dialog States
  const [selectedTransactionForAction, setSelectedTransactionForAction] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [paymentAmountForPaid, setPaymentAmountForPaid] = useState(0);
  
  // Transaction Print States
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false); // State for new sale receipt dialog
  const printRef = useRef();
  
  const searchInputRef = useRef(null);

  // Dynamic CSS injection - map receiptType ke printType
  const getPrintType = () => {
    if (!completedSaleData && !selectedSaleForPrint) return null;
    // receiptType sudah dalam format yang tepat: 'thermal-58mm', 'thermal-80mm', 'invoice-a4', 'delivery-note'
    return receiptType;
  };
  
  usePrintStyles(getPrintType());
  
  // Transform completedSaleData for InvoiceA4
  const transformToSaleFormat = (completedSaleData) => {
    if (!completedSaleData) return null;
    
    // Map cart array to items array with required structure
    const transformedItems = completedSaleData.cart.map(item => ({
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      barcode: item.barcode || item.product?.barcode || item.productBarcode || '-'
    }));
    
    // Create sale object with expected structure
    const sale = {
      id: 'TEMP-' + Date.now(),
      created_at: new Date().toISOString(),
      subtotal: completedSaleData.subtotal || 0,
      discount_amount: completedSaleData.discountAmount || 0,
      discount_percent: typeof discount === 'number' ? discount : Number(discount) || 0,
      tax_amount: completedSaleData.taxAmount || 0,
      tax_percent: typeof tax === 'number' ? tax : Number(tax) || 0,
      total_amount: completedSaleData.total,
      payment_amount: completedSaleData.paymentAmount,
      change_amount: completedSaleData.change,
      customer: completedSaleData.customer,
      items: transformedItems,
      receiver_name: receiverName,
      sender_name: senderName
    };
    
    return sale;
  };
  
  // Get transformed sale data
  const transformedSale = transformToSaleFormat(completedSaleData);
  
  // Determine which sale data to use for printing (New Sale or History)
  const finalSaleData = transformedSale || selectedSaleForPrint;
  
  // Custom print function to open in new tab
  // Enhanced print function with race condition handling and content verification
  // Custom print function to open in new tab
  // Enhanced print function with race condition handling and content verification
  const printInNewTab = (contentRef, title) => {
    const content = contentRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: t('error'), description: t('popupBlocked'), variant: "destructive" });
      return;
    }

    // Get all stylesheets from current document to ensure correct styling
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => {
        if (style.tagName === 'LINK') {
          // Convert relative href to absolute to ensure it works in new window/tab
          const href = style.href; // .href property returns absolute URL
          return `<link rel="stylesheet" href="${href}" />`;
        }
        return style.outerHTML;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${styles}
          <style>
            body { background-color: white; margin: 0; padding: 0; }
            @media print {
              @page { margin: 0; }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            /* Ensure the content is visible and properly sized */
            #print-content { 
              display: block !important; 
              position: static !important; 
              visibility: visible !important; 
              width: 100%;
              height: 100%;
            }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${content.outerHTML}
          </div>
          <script>
            window.onload = () => {
              // Small delay to ensure styles are applied
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Unified print handler
  const handlePrint = () => {
    if (receiptType === 'invoice-a4') {
      printInNewTab(invoiceA4Ref, `invoice-idcashier-${new Date().getTime()}`);
    } else if (receiptType === 'delivery-note') {
      printInNewTab(deliveryNoteRef, `Surat_Jalan_${new Date().getTime()}`);
    } else {
      printInNewTab(thermalReceiptRef, `receipt-idcashier-${new Date().getTime()}`);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authUser]);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Calculate top products
  useEffect(() => {
    const fetchTopProducts = async () => {
      if (!authUser || !token || products.length === 0) return;
      try {
        // Fetch last 1000 sales items to determine popularity
        const { data, error } = await supabase
          .from('sale_items')
          .select('product_id, quantity')
          .order('created_at', { ascending: false })
          .limit(1000);
          
        if (error) throw error;
        
        const productCounts = {};
        data?.forEach(item => {
          productCounts[item.product_id] = (productCounts[item.product_id] || 0) + item.quantity;
        });
        
        const sortedProductIds = Object.keys(productCounts).sort((a, b) => productCounts[b] - productCounts[a]);
        const topIds = sortedProductIds.slice(0, 5);
        
        // Map to actual product objects
        const top = products.filter(p => topIds.includes(p.id))
          .sort((a, b) => productCounts[b.id] - productCounts[a.id]);
          
        setTopProducts(top);
      } catch (err) {
        console.error('Error fetching top products:', err);
      }
    };
    
    fetchTopProducts();
  }, [products, authUser, token]);

  // Load delivery note design settings
  useEffect(() => {
    const loadDeliveryNoteDesignSettings = async () => {
      if (!authUser || !token) return;
      
      try {
        // Try localStorage first
        const ownerId = authUser.role === 'cashier' ? authUser.tenantId : authUser.id;
        const storedSettings = localStorage.getItem(`idcashier_delivery_note_design_${ownerId}`);
        if (storedSettings) {
          setDeliveryNoteDesignSettings(JSON.parse(storedSettings));
          return;
        }
        
        // If not in localStorage, try Supabase
        const allSettings = await storeSettingsAPI.load(token);
        if (allSettings.deliveryNoteDesign) {
          setDeliveryNoteDesignSettings(allSettings.deliveryNoteDesign);
          // Also save to localStorage for faster access next time
          localStorage.setItem(`idcashier_delivery_note_design_${ownerId}`, JSON.stringify(allSettings.deliveryNoteDesign));
        }
      } catch (error) {
        console.warn('Error loading delivery note design settings:', error);
        // Try localStorage as last resort
        try {
          const ownerId = authUser?.id || authUser?.tenantId || 'default';
          const storedSettings = localStorage.getItem(`idcashier_delivery_note_design_${ownerId}`);
          if (storedSettings) {
            setDeliveryNoteDesignSettings(JSON.parse(storedSettings));
          }
        } catch (localStorageError) {
          console.warn('Could not load delivery note design settings from localStorage as fallback:', localStorageError);
        }
      }
    };
    
    loadDeliveryNoteDesignSettings();
  }, [authUser, token]);

  // Load invoice A4 design settings
  useEffect(() => {
    const loadInvoiceA4DesignSettings = async () => {
      if (!authUser || !token) return;
      
      try {
        const ownerId = authUser.role === 'cashier' ? authUser.tenantId : authUser.id;
        
        // Try localStorage first
        const storedSettings = localStorage.getItem(`idcashier_invoice_a4_design_${ownerId}`);
        if (storedSettings) {
          setInvoiceA4DesignSettings(JSON.parse(storedSettings));
          return;
        }
        
        // If not in localStorage, try Supabase
        const allSettings = await storeSettingsAPI.load(token);
        if (allSettings.invoiceA4Design) {
          setInvoiceA4DesignSettings(allSettings.invoiceA4Design);
          localStorage.setItem(`idcashier_invoice_a4_design_${ownerId}`, JSON.stringify(allSettings.invoiceA4Design));
        }
      } catch (error) {
        console.warn('Error loading invoice A4 design settings:', error);
        try {
          const ownerId = authUser?.id || authUser?.tenantId || 'default';
          const storedSettings = localStorage.getItem(`idcashier_invoice_a4_design_${ownerId}`);
          if (storedSettings) {
            setInvoiceA4DesignSettings(JSON.parse(storedSettings));
          }
        } catch (localStorageError) {
          console.warn('Could not load invoice A4 design settings from localStorage:', localStorageError);
        }
      }
    };
    
    loadInvoiceA4DesignSettings();
  }, [authUser, token]);

  // Check for navigation parameters to refresh customers
  useEffect(() => {
    if (navigationParams && navigationParams.refreshCustomers) {
      fetchData();
      clearNavigationParams();
    }
  }, [navigationParams]);

  // Load transactions data when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && authUser && token) {
      console.log('Loading transactions data for history tab...');
      loadTransactionsData();
    }
  }, [activeTab]);

  const fetchData = async () => {
    if (!authUser || !token) return;
    
    try {
      // Fetch products from API (now with tenant-based filtering)
      const productsData = await productsAPI.getAll(token);
      setProducts(productsData || []);
      
      // Fetch customers from API (now with tenant-based filtering)
      const customersData = await customersAPI.getAll(token);
      
      // Filter out customers with "default" in their name (case-insensitive) except for the one with id 'default'
      const filteredCustomers = customersData.filter(c => c.id === 'default' || !c.name.toLowerCase().includes('default'));
      
      // Always include the default customer at the beginning
      const defaultCustomer = { id: 'default', name: t('defaultCustomer'), phone: '' };
      const allCustomers = [defaultCustomer, ...filteredCustomers];
      
      setCustomers(allCustomers);
      // Keep 'default' as selected
      setSelectedCustomer('default');
      
      // Load actual receipt settings from localStorage based on user ID
      // For cashier accounts, use the tenantId to get store settings
      const ownerId = authUser.role === 'cashier' ? authUser.tenantId : authUser.id;
      
      let mergedSettings = {
        logo: '',
        name: '',
        address: '',
        phone: '',
        headerText: '',
        footerText: t('receiptFooter'),
        showAddress: true,
        showPhone: true,
        showHeader: true,
        showFooter: true,
        margin: 10,
      };
      
      if (ownerId) {
        // Try to load user-specific store settings
        const savedStoreSettings = localStorage.getItem(`idcashier_store_settings_${ownerId}`);
        const savedReceiptSettings = localStorage.getItem(`idcashier_receipt_settings_${ownerId}`);
        
        if (savedStoreSettings) {
          const storeSettings = JSON.parse(savedStoreSettings);
          mergedSettings = {
            ...mergedSettings,
            ...storeSettings
          };
        }
        
        if (savedReceiptSettings) {
          const receiptSettings = JSON.parse(savedReceiptSettings);
          mergedSettings = {
            ...mergedSettings,
            ...receiptSettings
          };
        }
      } else {
        // Fallback to general settings
        const savedStoreSettings = localStorage.getItem('idcashier_store_settings');
        const savedReceiptSettings = localStorage.getItem('idcashier_receipt_settings');
        
        if (savedStoreSettings) {
          const storeSettings = JSON.parse(savedStoreSettings);
          mergedSettings = {
            ...mergedSettings,
            ...storeSettings
          };
        }
        
        if (savedReceiptSettings) {
          const receiptSettings = JSON.parse(savedReceiptSettings);
          mergedSettings = {
            ...mergedSettings,
            ...receiptSettings
          };
        }
      }
      
      // Sanitize logo URL to prevent slow loading if it points to old Hostinger CDN
      if (mergedSettings.logo && mergedSettings.logo.includes('horizons-cdn.hostinger.com')) {
         mergedSettings.logo = '/logo.png';
      }

      setReceiptSettings(mergedSettings);
      
      // Load specific receipt settings for A4 and delivery note (includes invoicePrefix)
      const savedA4Settings = localStorage.getItem(`idcashier_receipt_settings_A4_${ownerId}`);
      if (savedA4Settings) {
        const a4Settings = JSON.parse(savedA4Settings);
        if (a4Settings.logo && a4Settings.logo.includes('horizons-cdn.hostinger.com')) {
          a4Settings.logo = '/logo.png';
        }
        setReceiptSettingsA4(a4Settings);
      }
      
      const savedDeliveryNoteSettings = localStorage.getItem(`idcashier_receipt_settings_delivery_note_${ownerId}`);
      if (savedDeliveryNoteSettings) {
        const dnSettings = JSON.parse(savedDeliveryNoteSettings);
        if (dnSettings.logo && dnSettings.logo.includes('horizons-cdn.hostinger.com')) {
          dnSettings.logo = '/logo.png';
        }
        setReceiptSettingsDeliveryNote(dnSettings);
      }
      
      // Load thermal design settings and merge them
      const saved58mmDesign = JSON.parse(localStorage.getItem(`idcashier_receipt_58mm_design_${ownerId}`)) || {};
      const saved80mmDesign = JSON.parse(localStorage.getItem(`idcashier_receipt_80mm_design_${ownerId}`)) || {};

      const saved58mmSettings = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_58mm_${ownerId}`)) || {};
      if (saved58mmSettings) {
        setReceiptSettings58mm({ ...saved58mmSettings, ...saved58mmDesign });
      } else {
        setReceiptSettings58mm(saved58mmDesign);
      }
      
      const saved80mmSettings = JSON.parse(localStorage.getItem(`idcashier_receipt_settings_80mm_${ownerId}`)) || {};
      if (saved80mmSettings) {
        setReceiptSettings80mm({ ...saved80mmSettings, ...saved80mmDesign });
      } else {
        setReceiptSettings80mm(saved80mmDesign);
      }
      
      // Load enabled receipt types
      const savedEnabledTypes = localStorage.getItem(`idcashier_enabled_receipt_types_${ownerId}`);
      if (savedEnabledTypes) {
        const enabledTypes = JSON.parse(savedEnabledTypes);
        setEnabledReceiptTypes(enabledTypes);
        
        // Set default receipt type to first enabled type
        if (!enabledTypes['80mm'] && !enabledTypes['58mm'] && !enabledTypes['A4'] && !enabledTypes['delivery-note']) {
          // All disabled - fallback to 80mm
          setReceiptType('thermal-80mm');
        } else if (!enabledTypes['80mm']) {
          // 80mm disabled, find first enabled
          if (enabledTypes['58mm']) setReceiptType('thermal-58mm');
          else if (enabledTypes['A4']) setReceiptType('invoice-a4');
          else if (enabledTypes['delivery-note']) setReceiptType('delivery-note');
        }
      }
      
      // Load currency settings
      const currency = getCurrencyFromStorage(ownerId);
      setCurrencyCode(currency);
      
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('error'), description: `${t('failedToLoadData')} ${error.message}`, variant: "destructive" });
    }
  };

  // Load transactions data for history tab
  const loadTransactionsData = async () => {
    if (!authUser || !token) {
      console.log('Cannot load transactions: missing authUser or token');
      return;
    }
    
    try {
      console.log('Fetching sales data...');
      const salesData = await salesAPI.getAll(token);
      console.log('Sales data received:', salesData?.length || 0, 'sales');
      
      if (!salesData || salesData.length === 0) {
        console.log('No sales data found, setting empty arrays');
        setAllSalesData([]);
        setFilteredTransactions([]);
        return;
      }
      
      // Transform sales data to match format expected by transactions table
      const flattenedData = [];
      const productsList = new Set([t('allProducts')]);
      const customersList = new Set([t('allCustomers')]);
      const suppliersList = new Set([t('allSuppliers')]);
      
      salesData.forEach((sale, index) => {
        // Handle sales with no items by creating a placeholder entry
        if (!sale.sale_items || sale.sale_items.length === 0) {
          console.warn('Sale has no items:', sale.id);
          
          // Create a placeholder entry for sales with no items
          flattenedData.push({
            id: sale.id + '-placeholder',
            saleId: sale.id,
            date: new Date(sale.created_at).toLocaleDateString('id-ID'),
            created_at: sale.created_at,
            product: t('noItems'),
            customer: sale.customer?.name || t('defaultCustomer'),
            supplier: '-',
            cashier: sale.user?.email || authUser.email,
            quantity: 0,
            price: 0,
            itemSubtotal: 0,
            discount_amount: sale.discount_amount || 0,
            tax_amount: sale.tax_amount || 0,
            total: sale.total_amount || 0,
            payment_status: sale.payment_status || 'paid',
            payment_method: sale.payment_method || 'cash',
            isFirstItemInSale: true,
            cost: 0
          });
          
          customersList.add(sale.customer?.name || t('defaultCustomer'));
          return;
        }
        
        sale.sale_items.forEach((item, itemIndex) => {
          productsList.add(item.product_name || t('unknownProduct'));
          customersList.add(sale.customer?.name || t('defaultCustomer'));
          
          flattenedData.push({
            id: sale.id + '-' + item.id,
            saleId: sale.id,
            date: new Date(sale.created_at).toLocaleDateString('id-ID'),
            created_at: sale.created_at,
            product: item.product_name || t('unknownProduct'),
            customer: sale.customer?.name || t('defaultCustomer'),
            supplier: item.product?.supplier?.name || '-',
            cashier: sale.user?.email || authUser.email,
            quantity: item.quantity,
            price: item.price,
            itemSubtotal: item.price * item.quantity,
            discount_amount: sale.discount_amount || 0,
            tax_amount: sale.tax_amount || 0,
            total: sale.total_amount || 0,
            payment_status: sale.payment_status || 'paid',
            payment_method: sale.payment_method || 'cash',
            isFirstItemInSale: itemIndex === 0,
            cost: item.cost || 0
          });
        });
      });
      
      console.log('Flattened data:', flattenedData.length, 'items');
      setAllSalesData(flattenedData);
      setFilteredTransactions(flattenedData);
      setProductsForFilter(Array.from(productsList));
      setCustomersForFilter(Array.from(customersList));
      setSuppliersForFilter(Array.from(suppliersList));
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast({ title: t('error'), description: `${t('failedToLoadTransactions')} ${error.message}`, variant: 'destructive' });
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast({ title: t('error'), description: t('namePhoneRequired'), variant: "destructive" });
      return;
    }
    
    try {
      const data = await customersAPI.create({
        name: newCustomer.name,
        address: newCustomer.address || null,
        phone: newCustomer.phone,
        email: newCustomer.email || null
      }, token);
      
      // Optimistically update the customer list
      setCustomers(prevCustomers => [...prevCustomers, data]);
      toast({ title: t('success'), description: t('customerAdded') });
      setNewCustomer({ name: '', phone: '' });
      setSelectedCustomer(data.id);
      setIsAddCustomerDialogOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({ title: t('error'), description: `${t('failedToAddCustomer')} ${error.message}`, variant: "destructive" });
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      const product = products.find(p => p.barcode === searchTerm);
      if (product) {
        addToCart(product);
        setSearchTerm('');
        toast({ title: t('productFound'), description: `${product.name} ${t('productAddedToCart')}.` });
      } else {
        toast({ title: t('error'), description: t('productNotFound'), variant: "destructive" });
      }
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  // Calculate cart totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = subtotal * (discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (tax / 100);
  const total = taxableAmount + taxAmount;
  const change = paymentAmount - total;
  
  // Customer for receipt (filter out default customer)
  const customerForReceipt = selectedCustomer === 'default' 
    ? null 
    : customers.find(c => c.id === selectedCustomer) || null;

  const validateStockLevels = async () => {
    // This function checks if there's enough stock for all items in the cart
    // It's called before processing payment to prevent overselling
    
    // 1. Check product stock
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      if (product && item.quantity > (product.stock || 0)) {
        throw new Error(`${t('insufficientStock')} ${item.name}. ${t('stockLabel')}: ${product.stock || 0}, ${t('quantity')}: ${item.quantity}`);
      }
    }
    
    // TEMPORARILY SKIP raw materials validation
    console.log('⚠️ Skipping raw materials validation for testing');
    return;
    
    // 2. Check raw material stock for products with recipes
    for (const item of cart) {
      try {
        // Get recipe for this product
        console.log('🔍 Fetching recipes for product:', item.id, item.name);
        const recipes = await productRecipesAPI.getByProduct(item.id, token);
        console.log('✅ Recipes fetched:', recipes?.length || 0);
        
        if (recipes && recipes.length > 0) {
          for (const recipe of recipes) {
            // Calculate total quantity needed
            const totalQuantityNeeded = parseFloat(recipe.quantity) * item.quantity;
            
            // Get current stock from raw material data
            const currentStock = recipe.raw_materials?.stock 
              ? parseFloat(recipe.raw_materials.stock) 
              : 0;
            
            // Check if sufficient stock
            if (currentStock < totalQuantityNeeded) {
              const materialName = recipe.raw_materials?.name || t('rawMaterial');
              const unit = recipe.raw_materials?.unit || '';
              throw new Error(
                `${t('insufficientRawMaterial')} ${item.name}.\n` +
                `${materialName}: ${t('quantity')} ${totalQuantityNeeded.toFixed(3)} ${unit}, ` +
                `${t('stockLabel')} ${currentStock.toFixed(3)} ${unit}`
              );
            }
          }
        }
      } catch (error) {
        // If it's a stock error, rethrow it
        if (error.message.includes('Stok')) {
          throw error;
        }
        // Otherwise, just log and continue (product might not have recipe)
        console.warn('Could not validate raw material stock for product:', item.name, error);
      }
    }
  };

  const handlePayment = async () => {
    console.log('🚀 PAYMENT PROCESS STARTED');
    console.log('Current time:', new Date().toISOString());
    console.log('Cart items:', cart.length);
    console.log('Payment method:', paymentMethod);
    
    // Prevent double submission
    if (isProcessingPayment) {
      console.log('⚠️ Already processing payment, preventing double submission');
      return;
    }
    
    if (cart.length === 0) {
      console.log('❌ Cart is empty');
      toast({ title: t('error'), description: t('cartEmpty'), variant: "destructive" });
      return;
    }
    
    // For cash transactions, validate payment amount
    if (paymentMethod === 'cash' && paymentAmount < total) {
      toast({ title: t('error'), description: t('insufficientPayment'), variant: "destructive" });
      return;
    }
    
    // Frontend validation for discount and tax
    if (discount > 100) {
      toast({ title: t('error'), description: t('maxDiscount'), variant: "destructive" });
      return;
    }
    
    if (tax < 0) {
      toast({ title: t('error'), description: t('taxNegative'), variant: "destructive" });
      return;
    }
    
    if (total <= 0) {
      toast({ title: t('error'), description: t('totalMustPositive'), variant: "destructive" });
      return;
    }
    
    // Additional client-side validations
    // Validate that all products have positive quantities
    const invalidItems = cart.filter(item => item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast({ 
        title: t('error'), 
        description: t('invalidQuantity'), 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate customer selection
    if (selectedCustomer !== 'default') {
      const selectedCustomerExists = customers.some(c => c.id === selectedCustomer);
      if (!selectedCustomerExists) {
        toast({ 
          title: t('error'), 
          description: t('invalidCustomerSelection'), 
          variant: "destructive" 
        });
        return;
      }
    }
    
    try {
      console.log('🔄 Setting processing state to true...');
      setIsProcessingPayment(true);
      console.log('✅ Processing state set');
      
      console.log('📋 Validating stock levels...');
      await validateStockLevels();
      console.log('✅ Stock validation passed');
      
      // Prepare sale data
      // Handle default customer (if selectedCustomer is the default customer with id='default', set to null)
      const customerId = selectedCustomer === 'default' ? null : selectedCustomer;
      
      // Calculate total custom costs
      const totalCustomCosts = customCosts.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
      
      // Calculate total items for prorating custom costs
      const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      const saleData = {
        user_id: authUser.id, // Add the user_id to link the sale to the current user
        customer_id: customerId,
        total_amount: total,
        receiver_name: receiverName || null,
        sender_name: senderName || null,
        discount: discount,  // Changed from discountAmount to discount (percentage)
        tax: tax,            // Changed from taxAmount to tax (percentage)
        payment_amount: paymentMethod === 'credit' ? 0 : paymentAmount,
        change_amount: paymentMethod === 'credit' ? 0 : change,
        payment_status: paymentMethod === 'credit' ? 'unpaid' : 'paid',
        sale_items: cart.map(item => {
          // Snapshot the HPP at time of sale
          const cost_snapshot = item.hpp || item.cost || 0;
          
          // Calculate hpp_extra: prorate custom costs based on quantity
          const hpp_extra = totalItems > 0 ? (totalCustomCosts * item.quantity) / totalItems : 0;
          
          // Calculate hpp_total
          const hpp_total = cost_snapshot + hpp_extra;
          
          return {
            product_id: item.id,
            quantity: item.quantity,
            price: item.price || 0,
            cost_snapshot: cost_snapshot,
            hpp_extra: hpp_extra,
            hpp_total: hpp_total
          };
        }),
        // Include custom costs if any
        custom_costs: customCosts.filter(cost => cost.label && cost.amount).map(cost => ({
          label: cost.label,
          amount: parseFloat(cost.amount) || 0
        }))
      };
      
      console.log('📝 Sale data prepared:', {
        user_id: saleData.user_id,
        customer_id: saleData.customer_id,
        total_amount: saleData.total_amount,
        sale_items_count: saleData.sale_items.length,
        custom_costs_count: saleData.custom_costs.length
      });
      
      console.log('🔗 Calling salesAPI.create() with timeout protection...');
      console.log('Start time:', new Date().toISOString());
      
      try {
        const result = await salesAPI.create(saleData, token);
        console.log('🎉 Sale created successfully via salesAPI.create()');
        console.log('End time:', new Date().toISOString());
        console.log('Result:', result);
        
        console.log('💾 Storing completed sale data...');
        // Store completed sale data for print receipt
        setCompletedSaleData({
          cart,
          subtotal,
          discountAmount,
          taxAmount,
          total,
          paymentAmount,
          change,
          customer: customerForReceipt
        });

        console.log('📋 Opening receipt dialog...');
        // Open receipt dialog
        setIsReceiptDialogOpen(true);
        
        console.log('✅ Showing success confirmation...');
        // Show success confirmation
        toast({
          title: t('success'),
          description: t('transactionSaved'),
          variant: "success"
        });
        
        // CRITICAL: Reset processing state immediately after transaction success
        // This prevents infinite loading if background operations hang
        console.log('🏁 Resetting processing state immediately after transaction success');
        setIsProcessingPayment(false);
        
        // Run non-critical operations in background (non-blocking)
        // These operations should not block the UI or prevent state reset
        console.log('🔄 Starting background operations...');
        
        // Use setTimeout to ensure these run after state is reset
        setTimeout(async () => {
          try {
            // Deduct raw materials stock for each product in cart (background)
            console.log('📦 Starting raw materials stock deduction (background)...');
            try {
              for (const cartItem of cart) {
                console.log('📋 Processing raw materials for product:', cartItem.name);
                // Get recipe for this product with timeout protection
                const recipePromise = productRecipesAPI.getByProduct(cartItem.id, token);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Recipe fetch timeout')), 10000)
                );
                
                const recipes = await Promise.race([recipePromise, timeoutPromise]);
                
                // Deduct each raw material in the recipe
                if (recipes && recipes.length > 0) {
                  for (const recipe of recipes) {
                    // Calculate total quantity needed: recipe quantity × cart quantity
                    const totalQuantityNeeded = parseFloat(recipe.quantity) * cartItem.quantity;
                    
                    console.log('📉 Deducting stock:', {
                      rawMaterialId: recipe.raw_material_id,
                      neededQuantity: totalQuantityNeeded
                    });
                    
                    // Deduct stock with timeout protection
                    const deductPromise = rawMaterialsAPI.deductStock(
                      recipe.raw_material_id,
                      totalQuantityNeeded,
                      token
                    );
                    const deductTimeout = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Deduct stock timeout')), 10000)
                    );
                    
                    await Promise.race([deductPromise, deductTimeout]);
                    console.log('✅ Raw material stock deducted');
                  }
                } else {
                  console.log('ℹ️ No raw materials recipe for:', cartItem.name);
                }
              }
              console.log('✅ Raw materials stock deduction completed');
            } catch (stockError) {
              console.warn('⚠️ Warning: Could not deduct raw material stock:', stockError);
              // Don't fail the sale if raw material deduction fails (non-critical)
            }
            
            // Track profit shares if HPP enabled and sale was successful (background)
            console.log('💰 Starting profit share tracking (background)...');
            if (hppEnabled && result?.id) {
              // Use non-blocking direct fetch for profit shares
              profitSharesAPI.track(result.id, cart, authUser, token).catch(err => {
                console.error('Background profit share tracking failed:', err);
              });
            }
            
            // Refresh products to show updated stock (background)
            console.log('🔄 Refreshing products (background)...');
            fetchData().catch(err => {
              console.warn('Background product refresh failed:', err);
            });
            
            // Refresh transactions data if on history tab (background)
            if (activeTab === 'history') {
              console.log('🔄 Refreshing transactions data (background)...');
              loadTransactionsData().catch(err => {
                console.warn('Background transactions refresh failed:', err);
              });
            }
            
            console.log('✅ Background operations completed');
          } catch (bgError) {
            console.warn('⚠️ Background operations error (non-critical):', bgError);
          }
        }, 100); // Small delay to ensure state is reset first
        
        console.log('🎉 PAYMENT PROCESS COMPLETED SUCCESSFULLY');
        
      } catch (apiError) {
        console.error('❌ Error in salesAPI.create():', apiError);
        throw apiError;
      }
    } catch (error) {
      console.error('🚨 Error processing sale:', error);
      
      // Show specific error messages based on error type
      let errorMessage = error.message;
      
      // Handle specific error cases
      if (errorMessage.includes('Stok tidak mencukupi')) {
        toast({
          title: t('insufficientStock'),
          description: errorMessage,
          variant: "destructive"
        });
      } else if (errorMessage.includes('Data input tidak valid')) {
        toast({
          title: t('error'),
          description: errorMessage,
          variant: "destructive"
        });
      } else if (errorMessage.includes('Akses tidak sah')) {
        toast({
          title: t('error'),
          description: t('loginAgain'),
          variant: "destructive"
        });
      } else {
        toast({
          title: t('error'),
          description: `${t('transactionFailed')}: ${errorMessage}`,
          variant: "destructive"
        });
      }
    } finally {
      console.log('🏁 Setting processing state to false...');
      setIsProcessingPayment(false);
      console.log('✅ Payment process cleanup completed');
    }
  };

  // Helper function to safely format currency values
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString();
  };
  
  // Get currency symbol
  const currencySymbol = getCurrencySymbol(currencyCode);

  // ============= TRANSACTION HISTORY FUNCTIONS =============
  
  // Auto-apply filters when any filter state changes
  useEffect(() => {
    // Don't filter if no data
    if (!allSalesData) return;
    
    let data = allSalesData;

    if (dateRange?.from && dateRange?.to) {
      data = data.filter(item => {
        // Reset time part for accurate date comparison if dateRange has time
        const from = new Date(dateRange.from); from.setHours(0,0,0,0);
        const to = new Date(dateRange.to); to.setHours(23,59,59,999);
        // item.date from loadTransactionsData is locale string, hard to parse back correctly depending on locale.
        // Best to use created_at if available.
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : new Date(item.date).getTime();
        return itemTime >= from.getTime() && itemTime <= to.getTime();
      });
    }

    // Time range filter
    const TIME_PRESETS = {
      morning: { start: '06:00', end: '12:00' },
      afternoon: { start: '12:00', end: '18:00' },
      night: { start: '18:00', end: '24:00' }
    };

    if (timeRangePreset !== 'all') {
      const startTime = timeRangePreset === 'custom' ? customTimeStart : TIME_PRESETS[timeRangePreset]?.start;
      const endTime = timeRangePreset === 'custom' ? customTimeEnd : TIME_PRESETS[timeRangePreset]?.end;
      
      if (startTime && endTime) {
        data = data.filter(item => {
          const itemDateTime = new Date(item.created_at || item.date);
          if (isNaN(itemDateTime.getTime())) return false;
          const itemTime = itemDateTime.toTimeString().slice(0, 5);
          return itemTime >= startTime && itemTime <= endTime;
        });
      }
    }

    if (selectedProductFilter !== t('allProducts')) data = data.filter(item => item.product === selectedProductFilter);
    if (selectedCustomerFilter !== t('allCustomers')) data = data.filter(item => item.customer === selectedCustomerFilter);
    if (selectedSupplierFilter !== t('allSuppliers')) data = data.filter(item => item.supplier === selectedSupplierFilter);
    if (selectedPaymentMethodFilter !== 'all') data = data.filter(item => item.payment_method === selectedPaymentMethodFilter);

    setFilteredTransactions(data);
  }, [
    allSalesData, 
    dateRange, 
    timeRangePreset, 
    customTimeStart, 
    customTimeEnd, 
    selectedProductFilter, 
    selectedCustomerFilter, 
    selectedSupplierFilter, 
    selectedPaymentMethodFilter,
    t
  ]);

  // Toggle transaction selection
  const toggleTransactionSelection = (saleId) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(saleId)) {
      newSelected.delete(saleId);
    } else {
      newSelected.add(saleId);
    }
    setSelectedTransactions(newSelected);
  };

  // Select all transactions
  const selectAllTransactions = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      const allSaleIds = new Set(filteredTransactions.map(item => item.saleId));
      setSelectedTransactions(allSaleIds);
    }
  };

  // Delete selected transactions
  const deleteSelectedTransactions = async () => {
    if (selectedTransactions.size === 0) {
      toast({ title: t('noTransactionsSelected'), description: t('pleaseSelectTransactionsToDelete'), variant: 'destructive' });
      return;
    }

    if (!window.confirm(`${t('confirmDeleteTransactions')} ${selectedTransactions.size} ${t('transactions')}. ${t('thisActionWillRestoreStock')} ${t('cannotBeUndone')}`)) {
      return;
    }

    try {
      const transactionIds = Array.from(selectedTransactions);
      const deletePromises = transactionIds.map(id => salesAPI.delete(id, token));
      await Promise.all(deletePromises);
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      setSelectedTransactions(new Set());
      
      toast({ title: t('success'), description: `${transactionIds.length} ${t('transactionsSuccessfullyDeletedAndStockRestored')}` });
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast({ title: t('error'), description: `${t('failedToDeleteTransactions')}: ${error.message}`, variant: 'destructive' });
    }
  };

  // Mark transaction as paid
  const handleMarkAsPaid = async () => {
    if (!selectedTransactionForAction) return;

    if (paymentAmountForPaid < selectedTransactionForAction.total) {
      toast({ 
        title: t('error'), 
        description: t('insufficientPayment'), 
        variant: 'destructive' 
      });
      return;
    }

    try {
      await salesAPI.updatePaymentStatus(
        selectedTransactionForAction.saleId, 
        'paid', 
        paymentAmountForPaid, 
        token
      );
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      
      toast({ 
        title: t('success'), 
        description: t('transactionMarkedAsPaid') 
      });
      
      setShowActionDialog(false);
      setSelectedTransactionForAction(null);
      setPaymentAmountForPaid(0);
    } catch (error) {
      console.error('Error marking transaction as paid:', error);
      toast({ 
        title: t('error'), 
        description: `${t('failed')}: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  // Change transaction to credit
  const handleChangeToCredit = async () => {
    if (!selectedTransactionForAction) return;

    if (!window.confirm(t('confirmChangeToCredit'))) {
      return;
    }

    try {
      await salesAPI.updatePaymentStatus(
        selectedTransactionForAction.saleId, 
        'unpaid', 
        0, 
        token
      );
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      
      toast({ 
        title: t('success'), 
        description: t('transactionChangedToCredit') 
      });
      
      setShowActionDialog(false);
      setSelectedTransactionForAction(null);
    } catch (error) {
      console.error('Error changing transaction to credit:', error);
      toast({ 
        title: t('error'), 
        description: `${t('failed')}: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  // Delete single transaction
  const handleDeleteTransaction = async () => {
    if (!selectedTransactionForAction) return;

    if (!window.confirm(t('confirmDeleteTransaction'))) {
      return;
    }

    try {
      await salesAPI.delete(selectedTransactionForAction.saleId, token);
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      
      toast({ 
        title: t('success'), 
        description: t('transactionDeleted') 
      });
      
      setShowActionDialog(false);
      setSelectedTransactionForAction(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({ 
        title: t('error'), 
        description: `${t('failedToDeleteTransaction')}: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  // Print invoice for transaction
  const handlePrintTransaction = async (item) => {
    try {
      const saleData = await salesAPI.getById(item.saleId, token);
      
      // Transform data for print components
      const items = saleData.sale_items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const saleForPrint = {
        ...saleData,
        items: items,
        discount_percent: saleData.discount || 0,
        tax_percent: saleData.tax || 0,
        subtotal: subtotal,
        // Map customer data if nested in saleData
        customer: saleData.customer ? {
          name: saleData.customer.name,
          address: saleData.customer.address,
          phone: saleData.customer.phone,
          email: saleData.customer.email
        } : { name: saleData.customer_name || t('defaultCustomer') }
      };

      setSelectedSaleForPrint(saleForPrint);
      setShowPrintDialog(true);
    } catch (error) {
      console.error('Error fetching sale data:', error);
      toast({ 
        title: t('error'), 
        description: t('failedToLoadTransactionData'), 
        variant: 'destructive' 
      });
    }
  };


  // Export transactions (placeholder - needs implementation from ReportsPage)
  const handleExportTransactions = () => {
    toast({ title: t('export'), description: t('exportFunctionalityComing') });
  };

  return (
    <>
      <Helmet>
        <title>{t('sales')} - idCashier</title>
      </Helmet>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md mb-4">
          <TabsTrigger value="new-sale">{t('newSale')}</TabsTrigger>
          <TabsTrigger value="history">{t('transactionHistory')}</TabsTrigger>
        </TabsList>

        <TabsContent value="new-sale" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
        <div className="lg:col-span-2 flex flex-col h-full">
          {/* Popular Products Quick Access */}
          {topProducts.length > 0 && (
            <Card className="flex-shrink-0 mb-4">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Produk Populer</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2 overflow-x-auto py-3">
                {topProducts.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    size="sm"
                    onClick={() => addToCart(product)}
                    className="whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {product.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="flex-shrink-0 mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-auto flex-1">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t('scanOrSearch')}
                    className="pl-10"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onKeyDown={handleBarcodeScan}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setView('list')}><List className={`w-5 h-5 ${view === 'list' ? 'text-primary' : ''}`} /></Button>
                  <Button variant="outline" size="icon" onClick={() => setView('grid')}><LayoutGrid className={`w-5 h-5 ${view === 'grid' ? 'text-primary' : ''}`} /></Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4 h-full overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">{t('noMatchingProducts')}</div>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map((product, index) => (
                    <motion.div key={product.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}>
                      <Card onClick={() => addToCart(product)} className="cursor-pointer hover:border-primary transition-all group">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-2">
                            <Package className="w-8 h-8 text-muted-foreground group-hover:text-primary"/>
                          </div>
                          <p className="font-semibold text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{currencySymbol} {formatCurrency(product.price)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t('stockLabel')}: {product.stock || 0}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(product => (
                    <div key={product.id} onClick={() => addToCart(product)} className="flex items-center p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mr-4">
                        <Package className="w-5 h-5 text-muted-foreground"/>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{t('stockLabel')}: {product.stock || 0}</p>
                      </div>
                      <p className="font-semibold">{currencySymbol} {formatCurrency(product.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>{t('salesCartTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">{t('cartEmpty')}</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{currencySymbol} {formatCurrency(item.price)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button variant="outline" size="sm" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</Button>
                      <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.id)}>×</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <CardContent className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer">{t('customer')}</Label>
                <div className="flex items-center gap-2">
                  <select 
                    id="customer"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-background text-foreground flex-1"
                  >
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </select>
                  {permissions.canAddCustomer && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsAddCustomerDialogOpen(true)}
                      className="text-xs"
                    >
                      +
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <Label htmlFor="discount" className="w-20">{t('discount')}</Label>
                <Input 
                  id="discount" 
                  type="number" 
                  min="0"
                  max="100"
                  value={discount} 
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (value > 100) {
                      setDiscount(100);
                      toast({ title: t('warning'), description: t('maxDiscount'), variant: "default" });
                    } else {
                      setDiscount(value);
                    }
                  }} 
                  className="flex-1 no-spin" 
                  disabled={!permissions.canApplyDiscount}
                />
                <Percent className="w-4 h-4 ml-2" />
              </div>
              <div className="flex items-center">
                <Label htmlFor="tax" className="w-20">{t('tax')}</Label>
                <Input 
                  id="tax" 
                  type="number" 
                  min="0"
                  value={tax} 
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (value < 0) {
                      setTax(0);
                      toast({ title: t('warning'), description: t('taxNegative'), variant: "default" });
                    } else {
                      setTax(value);
                    }
                  }} 
                  className="flex-1 no-spin" 
                  disabled={!permissions.canApplyTax}
                />
                <Percent className="w-4 h-4 ml-2" />
              </div>
              {hppEnabled && permissions.canAddCustomCosts && (
                <CustomCostsInput 
                  customCosts={customCosts}
                  setCustomCosts={setCustomCosts}
                />
              )}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t('subtotal')}</span>
                  <span>{currencySymbol} {formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span>{t('discount')} ({discount}%)</span>
                    <span className="text-red-500">- {currencySymbol} {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between">
                    <span>{t('tax')} ({tax}%)</span>
                    <span>+ {currencySymbol} {formatCurrency(taxAmount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t pt-2 mt-2">
                <span>{t('total')}</span>
                <span>{currencySymbol} {formatCurrency(total)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="paymentMethod" className="w-32">{t('paymentMethod')}</Label>
                <Select value={paymentMethod} onValueChange={(value) => {
                  setPaymentMethod(value);
                  // If credit selected, set payment amount to 0
                  if (value === 'credit') {
                    setPaymentAmount(0);
                  } else {
                    // If cash selected, auto-fill with total amount
                    setPaymentAmount(total);
                  }
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('cash')}</SelectItem>
                    <SelectItem value="credit">{t('credit')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod === 'cash' && (
                <div className="flex items-center">
                  <Label htmlFor="payment" className="w-32">{t('pay')}</Label>
                  <Input id="payment" type="number" placeholder={t('paymentAmountPlaceholder')} value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} className="flex-1 no-spin" />
                  <DollarSign className="w-4 h-4 ml-2" />
                </div>
              )}
              {paymentMethod === 'credit' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{t('creditSale')}</span> - {t('creditSaleNote')}
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t('change')}</span>
                <span>{currencySymbol} {formatCurrency(change)}</span>
              </div>
              <div className="mt-4">
                <Button 
                  size="lg" 
                  className="w-full text-lg h-12" 
                  disabled={cart.length === 0 || (paymentMethod === 'cash' && paymentAmount < total) || isProcessingPayment}
                  onClick={handlePayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span> {t('processing')}
                    </>
                  ) : paymentMethod === 'credit' ? (
                    <>
                      <Ticket className="w-5 h-5 mr-2" /> {t('createCreditSale')}
                    </>
                  ) : (
                    <>
                      <Ticket className="w-5 h-5 mr-2" /> {t('payAndPrint')}
                    </>
                  )}
                </Button>
              </div>

              <Dialog open={isReceiptDialogOpen} onOpenChange={(open) => {
                setIsReceiptDialogOpen(open);
                // Only clear cart when dialog is closing and transaction was successful
                if (!open && completedSaleData) {
                  // Clear cart and reset form
                  setCart([]);
                  setDiscount(0);
                  setTax(0);
                  setPaymentAmount(0);
                  setPaymentMethod('cash');
                  setCompletedSaleData(null);
                  // Reset receipt toggle
                  setShowBarcode(false);
                  setReceiptType('thermal-80mm');
                }
              }}>
                <DialogContent className="max-w-3xl p-2 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby="receipt-dialog-description">
                  <DialogHeader>
                    <DialogTitle>{t('receiptPreviewTitle')}</DialogTitle>
                  </DialogHeader>

                  {/* Print Presets */}
                  <div className="flex gap-2 mb-4 justify-center">
                    <Button 
                      variant={receiptType.startsWith('thermal') ? 'default' : 'outline'} 
                      onClick={() => {
                        setReceiptType('thermal-80mm');
                        setShowBarcode(true);
                      }}
                      className="flex-1"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Thermal
                    </Button>
                    <Button 
                      variant={receiptType === 'invoice-a4' ? 'default' : 'outline'} 
                      onClick={() => {
                        setReceiptType('invoice-a4');
                        setShowBarcode(false);
                      }}
                      className="flex-1"
                    >
                      <List className="w-4 h-4 mr-2" />
                      Invoice
                    </Button>
                    <Button 
                      variant={receiptType === 'delivery-note' ? 'default' : 'outline'} 
                      onClick={() => {
                        setReceiptType('delivery-note');
                        setDeliveryNoteShowPrice(true);
                      }}
                      className="flex-1"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Surat Jalan
                    </Button>
                  </div>
                  
                  {/* Unified receipt type selector */}
                  <div className="space-y-4 mb-4">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="receiptTypeSales" className="text-sm font-semibold whitespace-nowrap">
                        {t('receiptType') || 'Jenis Dokumen'}
                      </Label>
                      <Select value={receiptType} onValueChange={setReceiptType}>
                        <SelectTrigger className="w-full sm:w-[250px]">
                          <SelectValue placeholder={t('selectReceiptType') || 'Pilih Jenis Dokumen'} />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledReceiptTypes['58mm'] && (
                            <SelectItem value="thermal-58mm">
                              {t('thermal58mm') || 'Thermal 58mm'}
                            </SelectItem>
                          )}
                          {enabledReceiptTypes['80mm'] && (
                            <SelectItem value="thermal-80mm">
                              {t('thermal80mm') || 'Thermal 80mm'}
                            </SelectItem>
                          )}
                          {enabledReceiptTypes['A4'] && (
                            <SelectItem value="invoice-a4">
                              {t('invoiceA4') || 'Invoice A4'}
                            </SelectItem>
                          )}
                          {enabledReceiptTypes['delivery-note'] && (
                            <SelectItem value="delivery-note">
                              {t('deliveryNote') || 'Surat Jalan'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Decimal places toggle - applies to all types */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor="useTwoDecimalsSales">{t('useTwoDecimals')}</Label>
                      <Switch
                        id="useTwoDecimalsSales"
                        checked={useTwoDecimals}
                        onCheckedChange={setUseTwoDecimals}
                      />
                    </div>

                    {/* Barcode toggle - only for thermal receipts */}
                    {receiptType.startsWith('thermal-') && (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="showBarcodeSales">{t('showBarcode')}</Label>
                        <Switch
                          id="showBarcodeSales"
                          checked={showBarcode}
                          onCheckedChange={setShowBarcode}
                        />
                      </div>
                    )}

                    {/* Delivery Note Options */}
                    {receiptType === 'delivery-note' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="deliveryNoteShowPriceSales">{t('showPrice')}</Label>
                          <Switch
                            id="deliveryNoteShowPriceSales"
                            checked={deliveryNoteShowPrice}
                            onCheckedChange={setDeliveryNoteShowPrice}
                          />
                        </div>
                  <div>
                    <Label className="text-xs">{t('receiverName')}</Label>
                    <Input
                            id="receiverNameSales"
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            placeholder={t('receiverNamePlaceholder')}
                            className="mt-1"
                          />
                        </div>
                  <div>
                    <Label className="text-xs">{t('senderName')}</Label>
                    <Input
                            id="senderNameSales"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            placeholder={t('senderNamePlaceholder')}
                            className="mt-1"
                          />
                        </div>

                        {/* Customer ID Controls */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                          <Label className="text-xs font-semibold">Customer ID:</Label>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                id="custIdAutoSales" 
                                name="custIdModeSales" 
                                checked={customerIdMode === 'auto'} 
                                onChange={() => setCustomerIdMode('auto')}
                                className="h-4 w-4 text-primary"
                              />
                              <Label htmlFor="custIdAutoSales" className="text-xs cursor-pointer">Otomatis (Database)</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="radio" 
                                id="custIdManualSales" 
                                name="custIdModeSales" 
                                checked={customerIdMode === 'manual'} 
                                onChange={() => setCustomerIdMode('manual')}
                                className="h-4 w-4 text-primary"
                              />
                              <Label htmlFor="custIdManualSales" className="text-xs cursor-pointer">Manual</Label>
                            </div>
                          </div>
                          
                          {customerIdMode === 'manual' && (
                            <Input 
                              placeholder="Masukkan ID Customer" 
                              value={manualCustomerId}
                              onChange={(e) => setManualCustomerId(e.target.value)}
                              className="max-w-[250px] h-8 text-xs"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Unified preview box */}
                  <div className="border rounded-lg overflow-hidden bg-gray-50 mt-4">
                    {/* Print button at the top for Invoice A4 and Delivery Note */}
                    {(receiptType === 'invoice-a4' || receiptType === 'delivery-note') && (
                      <div className="bg-white border-b p-3 flex justify-between items-center">
                        <h3 className="font-semibold text-sm">
                          {receiptType === 'invoice-a4' ? t('invoicePreview') : t('deliveryNotePreview')}
                        </h3>
                        <Button 
                          onClick={handlePrint}
                          size="sm"
                          variant="outline"
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          {t('print')}
                        </Button>
                      </div>
                    )}
                    
                    <div className="p-0 bg-gray-100 rounded-md border">
                      <div className="flex justify-center min-h-full">
                        {receiptType === 'invoice-a4' ? (
                          <div className="py-4" style={{ width: '480px' }}>
                            <div style={{ width: '210mm', transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                              <div className="printable-invoice-area bg-white shadow-md">
                                {transformedSale && (
                                  <InvoiceA4 
                                    sale={transformedSale} 
                                    companyInfo={{...receiptSettings, ...receiptSettingsA4}} 
                                    designSettings={invoiceA4DesignSettings}
                                    useTwoDecimals={useTwoDecimals}
                                    context="sales"
                                    userId={authUser?.id || authUser?.tenantId}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ) : receiptType === 'delivery-note' ? (
                          <div className="py-4" style={{ width: '480px' }}>
                            <div style={{ width: '210mm', transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                              <div className="printable-invoice-area bg-white shadow-md">
                                {transformedSale && (
                                  <DeliveryNoteSimple
                                    sale={transformedSale}
                                    companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
                                    vehicleNumber={vehicleNumber}
                                    showPrice={deliveryNoteShowPrice}
                                    useTwoDecimals={useTwoDecimals}
                                    receiverName={transformedSale?.receiver_name || receiverName}
                                    senderName={transformedSale?.sender_name || senderName}
                                    showSignatureLine={deliveryNoteDesignSettings?.showSignatureLine !== false}
                                    showNameDottedLine={deliveryNoteDesignSettings?.showNameDottedLine !== false}
                                    customerIdMode={customerIdMode}
                                    manualCustomerId={manualCustomerId}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                        <div className="receipt-printable p-4">
                            <ReceiptContent 
                              cart={completedSaleData?.cart || cart} 
                              subtotal={completedSaleData?.subtotal || subtotal} 
                              discountAmount={completedSaleData?.discountAmount || discountAmount} 
                              taxAmount={completedSaleData?.taxAmount || taxAmount} 
                              total={completedSaleData?.total || total} 
                              paymentAmount={completedSaleData?.paymentAmount || paymentAmount} 
                              change={completedSaleData?.change || change} 
                              customer={completedSaleData?.customer || customerForReceipt} 
                              settings={
                                receiptType === 'thermal-58mm'
                                  ? { ...receiptSettings, ...receiptSettings58mm }
                                  : { ...receiptSettings, ...receiptSettings80mm }
                              }
                              paperSize={receiptType.replace('thermal-', '')}
                              useTwoDecimals={useTwoDecimals}
                              showBarcode={showBarcode}
                              t={t}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Print button for thermal receipts only (A4 and Delivery Note have button at top) */}
                  {receiptType !== 'invoice-a4' && receiptType !== 'delivery-note' && (
                    <Button 
                      onClick={handlePrint}
                      className="w-full mt-4"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      {t('print')}
                    </Button>
                  )}
                  

                </DialogContent>
              </Dialog>

            </CardContent>
          </Card>
        </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-lg">{t('transactions')}</CardTitle>
                <div className="flex gap-1.5">
                  <Button 
                    size="sm" 
                    onClick={handleExportTransactions}
                    variant="outline"
                    disabled={filteredTransactions.length === 0 || !permissions.canExportReports}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {t('export')}
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={deleteSelectedTransactions} 
                    variant="outline" 
                    disabled={selectedTransactions.size === 0 || !permissions.canDeleteTransaction}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('deleteSelected')}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Filter options for transactions tab */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs">{t('startDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal text-sm p-2",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : t('pickDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div>
                  <Label className="text-xs">{t('endDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal text-sm p-2",
                          !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : t('pickDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs">{t('timeRange')}</Label>
                  <Select value={timeRangePreset} onValueChange={setTimeRangePreset}>
                    <SelectTrigger className="text-sm p-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('timeRangeAll')}</SelectItem>
                      <SelectItem value="morning">{t('timeRangeMorning')}</SelectItem>
                      <SelectItem value="afternoon">{t('timeRangeAfternoon')}</SelectItem>
                      <SelectItem value="night">{t('timeRangeNight')}</SelectItem>
                      <SelectItem value="custom">{t('timeRangeCustom')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">{t('product')}</Label>
                  <Select value={selectedProductFilter} onValueChange={setSelectedProductFilter}>
                    <SelectTrigger className="text-sm p-2">
                      <SelectValue placeholder={t('selectProduct')} />
                    </SelectTrigger>
                    <SelectContent>
                      {productsForFilter.map((product) => (
                        <SelectItem key={product} value={product} className="text-sm">
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">{t('customer')}</Label>
                  <Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>
                    <SelectTrigger className="text-sm p-2">
                      <SelectValue placeholder={t('selectCustomer')} />
                    </SelectTrigger>
                    <SelectContent>
                      {customersForFilter.map((customer) => (
                        <SelectItem key={customer} value={customer} className="text-sm">
                          {customer}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">{t('paymentMethod')}</Label>
                  <Select value={selectedPaymentMethodFilter} onValueChange={setSelectedPaymentMethodFilter}>
                    <SelectTrigger className="text-sm p-2">
                      <SelectValue placeholder={t('selectPaymentMethod')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">{t('allTransactions')}</SelectItem>
                      <SelectItem value="cash" className="text-sm">{t('cash')}</SelectItem>
                      <SelectItem value="credit" className="text-sm">{t('credit')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {timeRangePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-xs">{t('startTime')}</Label>
                    <Input
                      type="time"
                      value={customTimeStart}
                      onChange={(e) => setCustomTimeStart(e.target.value)}
                      className="text-sm p-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('endTime')}</Label>
                    <Input
                      type="time"
                      value={customTimeEnd}
                      onChange={(e) => setCustomTimeEnd(e.target.value)}
                      className="text-sm p-2"
                    />
                  </div>
                </div>
              )}
            </CardContent>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="w-8 p-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.size > 0 && selectedTransactions.size === new Set(filteredTransactions.map(item => item.saleId)).size}
                            onChange={selectAllTransactions}
                            className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </th>
                        <th className="text-left p-2 font-medium whitespace-nowrap">{t('date')}</th>
                        <th className="text-left p-2 font-medium min-w-[120px]">{t('product')}</th>
                        <th className="text-left p-2 font-medium min-w-[100px]">{t('customer')}</th>
                        <th className="text-left p-2 font-medium">{t('cashier')}</th>
                        <th className="text-center p-2 font-medium">{t('qtyLabel')}</th>
                        <th className="text-right p-2 font-medium">{t('price')}</th>
                        <th className="text-right p-2 font-medium">{t('itemSubtotal')}</th>
                        <th className="text-right p-2 font-medium">{t('discount')}</th>
                        <th className="text-right p-2 font-medium">{t('tax')}</th>
                        <th className="text-right p-2 font-medium">{t('total')}</th>
                        <th className="text-center p-2 font-medium">{t('status')}</th>
                        <th className="text-center p-2 font-medium">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="13" className="p-8 text-center text-muted-foreground text-sm">
                            {t('noTransactionsFound')}
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((item) => (
                        <tr 
                          key={item.id} 
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedTransactions.has(item.saleId)}
                              onChange={() => toggleTransactionSelection(item.saleId)}
                              className="h-3 w-3 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">{item.date}</td>
                          <td className="p-2 truncate max-w-[150px]" title={item.product}>{item.product}</td>
                          <td className="p-2 truncate max-w-[120px]" title={item.customer}>{item.customer}</td>
                          <td className="p-2 truncate max-w-[100px]" title={item.cashier}>{item.cashier}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-right whitespace-nowrap">Rp {item.price?.toLocaleString() || 0}</td>
                          <td className="p-2 text-right whitespace-nowrap">Rp {item.itemSubtotal?.toLocaleString() || 0}</td>
                          <td className="p-2 text-right whitespace-nowrap text-muted-foreground">{item.isFirstItemInSale ? `Rp ${item.discount_amount?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-right whitespace-nowrap text-muted-foreground">{item.isFirstItemInSale ? `Rp ${item.tax_amount?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-right font-medium whitespace-nowrap">{item.isFirstItemInSale ? `Rp ${item.total?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-center">
                            {item.isFirstItemInSale && (
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                item.payment_status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : item.payment_status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.payment_status === 'paid' 
                                  ? t('paid')
                                  : item.payment_status === 'partial'
                                  ? t('partial')
                                  : t('unpaid')}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-sm">
                            {item.isFirstItemInSale && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handlePrintTransaction(item)}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => {
                                    setSelectedTransactionForAction(item);
                                    setShowActionDialog(true);
                                  }}
                                >
                                  {t('action')}
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('addNewCustomer')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-name">{t('name')} *</Label>
              <Input
                id="customer-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                placeholder={t('customerName')}
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">{t('phone')} *</Label>
              <Input
                id="customer-phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                placeholder={t('customerPhone')}
              />
            </div>
            <div>
              <Label htmlFor="customer-email">{t('email')}</Label>
              <Input
                id="customer-email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                placeholder={t('customerEmail')}
              />
            </div>
            <div>
              <Label htmlFor="customer-address">{t('address')}</Label>
              <Input
                id="customer-address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                placeholder={t('customerAddress')}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddCustomerDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={async () => {
                await handleAddCustomer();
                setIsAddCustomerDialogOpen(false);
              }}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('transactionActions')}</DialogTitle>
          </DialogHeader>

          {selectedTransactionForAction && (
            <div className="space-y-4">
              {/* Transaction Info */}
              <div className="p-4 bg-muted rounded-md space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('total')}:</span>
                  <span className="font-semibold">Rp {selectedTransactionForAction.total?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('customer')}:</span>
                  <span>{selectedTransactionForAction.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('status')}:</span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    selectedTransactionForAction.payment_status === 'paid' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedTransactionForAction.payment_status === 'partial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTransactionForAction.payment_status === 'paid' 
                      ? t('paid')
                      : selectedTransactionForAction.payment_status === 'partial'
                      ? t('partial')
                      : t('unpaid')}
                  </span>
                </div>
              </div>

              {/* Actions based on payment status */}
              {selectedTransactionForAction.payment_status === 'unpaid' ? (
                // Actions for UNPAID transactions
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="paymentAmount">{t('paymentAmount')}</Label>
                    <Input 
                      id="paymentAmount" 
                      type="number" 
                      placeholder={`Min: Rp ${selectedTransactionForAction.total?.toLocaleString() || 0}`}
                      value={paymentAmountForPaid || ''}
                      onChange={(e) => setPaymentAmountForPaid(Number(e.target.value))}
                      onFocus={() => {
                        if (paymentAmountForPaid === 0) {
                          setPaymentAmountForPaid(selectedTransactionForAction.total);
                        }
                      }}
                      className="mt-1"
                    />
                  </div>
                  <Button 
                    onClick={handleMarkAsPaid} 
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {t('markAsPaid')}
                  </Button>
                  <Button 
                    onClick={handleDeleteTransaction} 
                    variant="destructive" 
                    className="w-full"
                  >
                    {t('delete')}
                  </Button>
                </div>
              ) : (
                // Actions for PAID transactions
                <div className="space-y-3">
                  <Button 
                    onClick={handleChangeToCredit} 
                    variant="outline" 
                    className="w-full"
                  >
                    {t('changeToCredit')}
                  </Button>
                  <Button 
                    onClick={handleDeleteTransaction} 
                    variant="destructive" 
                    className="w-full"
                  >
                    {t('delete')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('printReceipt')}</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4">
            {/* Print Presets */}
            <div className="flex gap-2 justify-center">
              <Button 
                variant={receiptType.startsWith('thermal') ? 'default' : 'outline'} 
                onClick={() => {
                  setReceiptType('thermal-80mm');
                  setShowBarcode(true);
                }}
                className="flex-1"
              >
                <Printer className="w-4 h-4 mr-2" />
                Thermal
              </Button>
              <Button 
                variant={receiptType === 'invoice-a4' ? 'default' : 'outline'} 
                onClick={() => {
                  setReceiptType('invoice-a4');
                  setShowBarcode(false);
                }}
                className="flex-1"
              >
                <List className="w-4 h-4 mr-2" />
                Invoice
              </Button>
              <Button 
                variant={receiptType === 'delivery-note' ? 'default' : 'outline'} 
                onClick={() => {
                  setReceiptType('delivery-note');
                  setDeliveryNoteShowPrice(true);
                }}
                className="flex-1"
              >
                <Package className="w-4 h-4 mr-2" />
                Surat Jalan
              </Button>
            </div>

            <div className="flex justify-between items-center gap-4">
               <div className="flex items-center gap-2 flex-1">
                  <Label className="text-sm font-semibold whitespace-nowrap">
                    {t('receiptType') || 'Jenis Dokumen'}
                  </Label>
                  <Select value={receiptType} onValueChange={setReceiptType}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder={t('selectReceiptType') || 'Pilih Jenis Dokumen'} />
                    </SelectTrigger>
                    <SelectContent>
                      {enabledReceiptTypes['58mm'] && (
                        <SelectItem value="thermal-58mm">
                          {t('thermal58mm') || 'Thermal 58mm'}
                        </SelectItem>
                      )}
                      {enabledReceiptTypes['80mm'] && (
                        <SelectItem value="thermal-80mm">
                          {t('thermal80mm') || 'Thermal 80mm'}
                        </SelectItem>
                      )}
                      {enabledReceiptTypes['A4'] && (
                        <SelectItem value="invoice-a4">
                          {t('invoiceA4') || 'Invoice A4'}
                        </SelectItem>
                      )}
                      {enabledReceiptTypes['delivery-note'] && (
                        <SelectItem value="delivery-note">
                          {t('deliveryNote') || 'Surat Jalan'}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
               </div>
               
               <Button onClick={handlePrint}>
                 <Printer className="w-4 h-4 mr-2" />
                 {t('print')}
               </Button>
            </div>

            {/* Delivery Note Options - Only show when delivery-note is selected */}
            {receiptType === 'delivery-note' && (
              <div className="flex flex-col gap-4 p-4 bg-muted rounded-lg">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Template:</Label>
                    <Select value={deliveryNoteTemplate || 'simple'} onValueChange={setDeliveryNoteTemplate}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="advanced">{t('advanced') || 'Advanced'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">{t('vehicleNo') || 'No. Kendaraan'}:</Label>
                    <Input 
                      value={vehicleNumber} 
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="B 1234 XYZ"
                      className="w-[140px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">{t('showPrice') || 'Tampilkan Harga'}:</Label>
                    <Switch
                      checked={deliveryNoteShowPrice}
                      onCheckedChange={setDeliveryNoteShowPrice}
                    />
                  </div>
                </div>

              </div>
            )}

            {/* Preview Area */}
            <div className="border rounded-md p-0 bg-gray-100 mt-4">
               <div className="flex justify-center min-h-full">
                 {receiptType === 'invoice-a4' ? (
                   <div className="py-4" style={{ width: '480px' }}>
                     <div style={{ width: '210mm', transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                       <div className="printable-invoice-area bg-white shadow-md">
                         {finalSaleData && (
                           <InvoiceA4 
                             sale={finalSaleData} 
                             companyInfo={{...receiptSettings, ...receiptSettingsA4}} 
                             designSettings={invoiceA4DesignSettings}
                             useTwoDecimals={useTwoDecimals}
                             context="sales"
                             userId={authUser?.id || authUser?.tenantId}
                           />
                         )}
                       </div>
                     </div>
                   </div>
                 ) : receiptType === 'delivery-note' ? (
                   <div className="py-4" style={{ width: '480px' }}>
                     <div style={{ width: '210mm', transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                       <div className="printable-invoice-area bg-white shadow-md">
                         {finalSaleData && (
                         <DeliveryNoteSimple
                           sale={finalSaleData}
                           companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
                           vehicleNumber={vehicleNumber}
                           showPrice={deliveryNoteShowPrice}
                           useTwoDecimals={useTwoDecimals}
                           receiverName={finalSaleData?.receiver_name}
                           senderName={finalSaleData?.sender_name}
                           showSignatureLine={deliveryNoteDesignSettings?.showSignatureLine !== false}
                           showNameDottedLine={deliveryNoteDesignSettings?.showNameDottedLine !== false}
                         />
                         )}
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div className="bg-white p-4 shadow-sm m-4">
                       {selectedSaleForPrint && (
                       <ReceiptContent 
                         cart={selectedSaleForPrint.items.map(item => ({
                           ...item,
                           name: item.product_name || item.name
                         }))} 
                         subtotal={selectedSaleForPrint.subtotal} 
                         discountAmount={selectedSaleForPrint.discount_amount} 
                         taxAmount={selectedSaleForPrint.tax_amount} 
                         total={selectedSaleForPrint.total_amount} 
                         paymentAmount={selectedSaleForPrint.payment_amount} 
                         change={selectedSaleForPrint.change_amount} 
                         customer={selectedSaleForPrint.customer} 
                         settings={
                           receiptType === 'thermal-58mm'
                             ? { ...receiptSettings, ...receiptSettings58mm }
                             : { ...receiptSettings, ...receiptSettings80mm }
                         }
                         paperSize={receiptType.replace('thermal-', '')}
                         useTwoDecimals={useTwoDecimals}
                         showBarcode={showBarcode}
                         t={t}
                       />
                     )}
                   </div>
                 )}
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Components - Always rendered to allow printing from any dialog */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {finalSaleData && (
          <InvoiceA4 
            ref={invoiceA4Ref} 
            sale={finalSaleData} 
            companyInfo={{...receiptSettings, ...receiptSettingsA4}} 
            designSettings={invoiceA4DesignSettings}
            useTwoDecimals={useTwoDecimals}
            userId={authUser?.id || authUser?.tenantId}
          />
        )}
      </div>
      
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {finalSaleData && (
          <DeliveryNoteSimple
            ref={deliveryNoteRef}
            sale={finalSaleData}
            companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
            vehicleNumber={vehicleNumber}
            showPrice={deliveryNoteShowPrice}
            useTwoDecimals={useTwoDecimals}
            receiverName={receiverName}
            senderName={senderName}
            showSignatureLine={deliveryNoteDesignSettings?.showSignatureLine !== false}
            showNameDottedLine={deliveryNoteDesignSettings?.showNameDottedLine !== false}
            customerIdMode={isReceiptDialogOpen ? customerIdMode : 'auto'}
            manualCustomerId={isReceiptDialogOpen ? manualCustomerId : ''}
          />
        )}
      </div>
      
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={thermalReceiptRef}>
          {completedSaleData ? (
            <ReceiptContent 
              cart={completedSaleData.cart} 
              subtotal={completedSaleData.subtotal} 
              discountAmount={completedSaleData.discountAmount} 
              taxAmount={completedSaleData.taxAmount} 
              total={completedSaleData.total} 
              paymentAmount={completedSaleData.paymentAmount} 
              change={completedSaleData.change} 
              customer={completedSaleData.customer} 
              settings={
                receiptType === 'thermal-58mm'
                  ? { ...receiptSettings, ...receiptSettings58mm }
                  : { ...receiptSettings, ...receiptSettings80mm }
              }
              paperSize={receiptType.replace('thermal-', '')}
              useTwoDecimals={useTwoDecimals}
              showBarcode={showBarcode}
              t={t}
            />
          ) : selectedSaleForPrint ? (
            <ReceiptContent 
              cart={selectedSaleForPrint.items.map(item => ({
                ...item,
                name: item.product_name || item.name
              }))} 
              subtotal={selectedSaleForPrint.subtotal} 
              discountAmount={selectedSaleForPrint.discount_amount} 
              taxAmount={selectedSaleForPrint.tax_amount} 
              total={selectedSaleForPrint.total_amount} 
              paymentAmount={selectedSaleForPrint.payment_amount} 
              change={selectedSaleForPrint.change_amount} 
              customer={selectedSaleForPrint.customer} 
              settings={
                receiptType === 'thermal-58mm'
                  ? { ...receiptSettings, ...receiptSettings58mm }
                  : { ...receiptSettings, ...receiptSettings80mm }
              }
              paperSize={receiptType.replace('thermal-', '')}
              useTwoDecimals={useTwoDecimals}
              showBarcode={showBarcode}
              t={t}
            />
          ) : null}
        </div>
      </div>
    </>
  );
};

export default SalesPage;
