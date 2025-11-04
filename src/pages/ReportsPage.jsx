import React, { useState, useEffect, useMemo, useRef } from 'react';

import { Helmet } from 'react-helmet';

import { useLanguage } from '@/contexts/LanguageContext';

import { usePrintStyles } from '@/hooks/usePrintStyles';

import { useToast } from '@/components/ui/use-toast';

import { useNavigation } from '@/contexts/NavigationContext';

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Label } from '@/components/ui/label';

import { Input } from '@/components/ui/input';

import { Switch } from '@/components/ui/switch'; // Import the Switch component

import { Download, Calendar as CalendarIcon, Search, Trash2, RefreshCw, Printer } from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";

import { format } from "date-fns";

import { cn, exportToExcel } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { salesAPI, productsAPI, suppliersAPI, settingsAPI, returnsAPI, authAPI, rawMaterialsAPI } from '@/lib/api';

import { supabase } from '@/lib/supabaseClient';

import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

import { useReactToPrint } from 'react-to-print';

import InvoiceA4 from '@/components/InvoiceA4';

import DeliveryNote from '@/components/DeliveryNote';

import PrintReceipt, { ReceiptContent } from '@/components/PrintReceipt';

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { useHPP } from '@/contexts/HPPContext';

const ReportsPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { navigationParams } = useNavigation();
  const { user, token } = useAuth();
  const { hppEnabled } = useHPP(); // Use HPP context instead of local state
  const permissions = usePermissions();
  
  // HPP feature state - removed local state, using context instead
  const canViewHPP = user?.permissions?.canViewHPP || false;
  
  // Note: Global HPP removed - now managed via Expenses system
  const [globalHPPData] = useState([]);
  const [globalHPPTotal] = useState(0);
  const [returnsData, setReturnsData] = useState([]);

  const [dateRange, setDateRange] = useState({ from: new Date(2025, 9, 20), to: new Date(2025, 9, 26) });

  const [selectedProduct, setSelectedProduct] = useState(t('allProducts'));

  const [selectedCustomer, setSelectedCustomer] = useState(t('allCustomers'));

  const [selectedSupplier, setSelectedSupplier] = useState(t('allSuppliers'));

  const [filteredData, setFilteredData] = useState([]);

  const [allSalesData, setAllSalesData] = useState([]);

  const [products, setProducts] = useState([t('allProducts')]);

  const [customers, setCustomers] = useState([t('allCustomers')]);

  const [suppliers, setSuppliers] = useState([t('allSuppliers')]);

  const [productsMap, setProductsMap] = useState({});

  const [selectedTransactions, setSelectedTransactions] = useState(new Set());

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState(null);

  const [retryCount, setRetryCount] = useState(0);

  const [activeTab, setActiveTab] = useState('overview');

  

  // Stock Opname States
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Payment Method Filter State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');

  // Time Range Filter State
  const [timeRangePreset, setTimeRangePreset] = useState('all'); // 'all', 'morning', 'afternoon', 'night', 'custom'
  const [customTimeStart, setCustomTimeStart] = useState('00:00');
  const [customTimeEnd, setCustomTimeEnd] = useState('23:59');

  // Transaction Action Dialog States
  const [selectedTransactionForAction, setSelectedTransactionForAction] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [paymentAmountForPaid, setPaymentAmountForPaid] = useState(0);

  // Return Dialog States
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnType, setReturnType] = useState('stock'); // 'stock' or 'loss'
  const [returnReason, setReturnReason] = useState('');
  const [returningItems, setReturningItems] = useState([]);

  

  // A4 Invoice Printing States

  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState(null);

  const invoiceRef = useRef();

  const [companyInfo, setCompanyInfo] = useState({ 

    name: 'Toko', 

    address: '', 

    phone: '', 

    logoUrl: '/logo.png',

    logo: '/logo.png',

    headerText: '',

    footerText: '',

    showAddress: true,

    showPhone: true,

    showHeader: true,

    showFooter: true,

    margin: 10

  });
  
  // Specific receipt settings for A4 and delivery note (includes invoicePrefix)
  const [receiptSettingsA4, setReceiptSettingsA4] = useState({});
  const [receiptSettingsDeliveryNote, setReceiptSettingsDeliveryNote] = useState({});

  

  // New states for print dialog

  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const [receiptType, setReceiptType] = useState('thermal-80mm');
  const [useTwoDecimals, setUseTwoDecimals] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);
  const [deliveryNoteShowPrice, setDeliveryNoteShowPrice] = useState(true);
  const [receiverName, setReceiverName] = useState('');
  const [senderName, setSenderName] = useState('');
  
  // Enabled receipt types from settings
  const [enabledReceiptTypes, setEnabledReceiptTypes] = useState({
    '58mm': true,
    '80mm': true,
    'A4': true,
    'delivery-note': true
  });

  const printRef = useRef();

  // Dynamic CSS injection - hanya load CSS untuk tipe yang dipilih
  usePrintStyles(showPrintDialog ? receiptType : null);
  

  // Filter state for corrupt data

  const [hideCorruptData, setHideCorruptData] = useState(false);

  // Time range presets
  const TIME_PRESETS = {
    all: { label: '24 Jam', start: '00:00', end: '23:59' },
    morning: { label: 'Pagi (06:00-12:00)', start: '06:00', end: '12:00' },
    afternoon: { label: 'Siang (12:00-18:00)', start: '12:00', end: '18:00' },
    night: { label: 'Malam (18:00-24:00)', start: '18:00', end: '23:59' }
  };

  // Handle navigation parameters

  useEffect(() => {

    if (navigationParams && navigationParams.activeTab) {

      setActiveTab(navigationParams.activeTab);

    }

  }, [navigationParams]);



  // Load company settings for invoice printing

  const loadCompanySettings = async () => {

    if (!user) return;

    

    try {

      // Get ownerId based on user role

      const ownerId = user.role === 'cashier' ? user.tenantId : user.id;

      

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

      

      console.log('Loading company settings for ownerId:', ownerId);

      

      if (ownerId) {

        // Try to load user-specific store settings

        const savedStoreSettings = localStorage.getItem(`idcashier_store_settings_${ownerId}`);

        const savedReceiptSettings = localStorage.getItem(`idcashier_receipt_settings_${ownerId}`);

        

        console.log('Found user-specific store settings:', savedStoreSettings);

        console.log('Found user-specific receipt settings:', savedReceiptSettings);

        

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

        

        console.log('Found general store settings:', savedStoreSettings);

        console.log('Found general receipt settings:', savedReceiptSettings);

        

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

      

      // Log the merged settings for debugging

      console.log('Loaded company settings:', mergedSettings);

      

      // Set company info state with fallback to default logo

      setCompanyInfo({

        name: mergedSettings.name || 'Toko',

        address: mergedSettings.address || '',

        phone: mergedSettings.phone || '',

        logoUrl: mergedSettings.logo || '/logo.png',

        logo: mergedSettings.logo || '/logo.png',

        headerText: mergedSettings.headerText || '',

        footerText: mergedSettings.footerText || t('receiptFooter'),

        showAddress: mergedSettings.showAddress !== false,

        showPhone: mergedSettings.showPhone !== false,

        showHeader: mergedSettings.showHeader !== false,

        showFooter: mergedSettings.showFooter !== false,

        margin: mergedSettings.margin || 10

      });
      
      // Load specific receipt settings for A4 and delivery note (includes invoicePrefix)
      const savedA4Settings = localStorage.getItem(`idcashier_receipt_settings_A4_${ownerId}`);
      if (savedA4Settings) {
        setReceiptSettingsA4(JSON.parse(savedA4Settings));
      }
      
      const savedDeliveryNoteSettings = localStorage.getItem(`idcashier_receipt_settings_delivery_note_${ownerId}`);
      if (savedDeliveryNoteSettings) {
        setReceiptSettingsDeliveryNote(JSON.parse(savedDeliveryNoteSettings));
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

      

      console.log('Set company info state:', {

        name: mergedSettings.name || 'Toko',

        address: mergedSettings.address || '',

        phone: mergedSettings.phone || '',

        logoUrl: mergedSettings.logo || '/logo.png',

        logo: mergedSettings.logo || '/logo.png',

        headerText: mergedSettings.headerText || '',

        footerText: mergedSettings.footerText || t('receiptFooter'),

        showAddress: mergedSettings.showAddress !== false,

        showPhone: mergedSettings.showPhone !== false,

        showHeader: mergedSettings.showHeader !== false,

        showFooter: mergedSettings.showFooter !== false,

        margin: mergedSettings.margin || 10

      });

    } catch (error) {

      console.error('Error loading company settings:', error);

    }

  };



  // Load company settings when component mounts

  useEffect(() => {

    loadCompanySettings();

  }, [user]);



  // Also load company settings when the component is first mounted

  useEffect(() => {

    // Load company settings immediately when component mounts

    loadCompanySettings();

  }, []);



  // Extract fetchData function to make it accessible from other functions

  const fetchData = async (retryAttempt = 0) => {

    if (!user || !token) {

      // If user or token is missing, show appropriate message

      if (!token) {

        console.warn('No authentication token found. User may need to login.');

        toast({ 

          title: t('authenticationRequired'), 

          description: t('pleaseLoginToViewReports'), 

          variant: 'destructive' 

        });

      } else if (!user) {

        console.warn('No user data found.');

      }

      // Initialize with empty data to prevent app crash

      setAllSalesData([]);

      setFilteredData([]);

      setProducts([t('allProducts')]);

      setCustomers([t('allCustomers')]);

      setSuppliers([t('allSuppliers')]);

      setProductsMap({});

      return;

    }

    

    try {

      setIsLoading(true);

      setError(null);

      

      // Load company settings for invoice printing

      await loadCompanySettings();

      

      // Fetch products data first to get accurate cost and supplier information

      const productsData = await productsAPI.getAll(token);

      

      // Create productsMap from products data: { [product_id]: { name, cost, supplier_name, ... } }

      const productsMapData = {};

      productsData.forEach(product => {

        productsMapData[product.id] = {

          name: product.name,

          cost: product.cost_price || 0,

          supplier_name: product.supplier_name || t('unknownSupplier'),

          type: 'product', // identifier for finished products

          ...product

        };

      });

      

      // Fetch raw materials
      const rawMaterialsData = await rawMaterialsAPI.getAll(token);

      // Add raw materials to productsMap with type identifier
      rawMaterialsData.forEach(material => {
        productsMapData[material.id] = {
          name: material.name,
          cost: material.cost_per_unit || 0,
          supplier_name: material.supplier_name || t('unknownSupplier'),
          stock: material.current_stock || 0,
          unit: material.unit || 'unit',
          type: 'rawMaterial', // identifier
          ...material
        };
      });

      setRawMaterials(rawMaterialsData);

      // Set productsMap state

      setProductsMap(productsMapData);

      

      // Fetch suppliers data

      const suppliersData = await suppliersAPI.getAll(token);

      const uniqueSuppliers = [t('allSuppliers'), ...new Set(suppliersData.map(supplier => supplier.name).filter(name => name))];

      setSuppliers(uniqueSuppliers);

      

      // Fetch sales data using the API

      const salesData = await salesAPI.getAll(token);

      

      // Transform data for the reports

      const transformedData = [];

      

      salesData.forEach(sale => {

        // Handle sales with no items

        if (!sale.sale_items || sale.sale_items.length === 0) {

          // Calculate nominal discount and tax from percentages

          const subtotalForSale = 0;

          const discountNominal = subtotalForSale * ((sale.discount || 0) / 100);

          const taxableAmount = subtotalForSale - discountNominal;

          const taxNominal = taxableAmount * ((sale.tax || 0) / 100);

          // Determine payment method and status
          const paymentMethod = (sale.payment_amount || 0) === 0 || (sale.payment_amount || 0) < sale.total_amount ? 'credit' : 'cash';
          const paymentStatus = sale.payment_status || (paymentMethod === 'credit' ? 'unpaid' : 'paid');

          

          transformedData.push({

            id: sale.id,

            saleId: sale.id,

            itemId: `${sale.id}-0`,

            date: format(new Date(sale.created_at), 'yyyy-MM-dd'),

            product: t('noItems'),

            customer: sale.customer_name || t('unknownCustomer'),

            supplier: t('unknownSupplier'),

            quantity: 0,

            price: 0,

            itemSubtotal: 0,

            cashier: sale.user_name || 'Unknown Cashier',

            payment_amount: sale.payment_amount || 0,

            change_amount: sale.change_amount || 0,

            payment_method: paymentMethod,

            payment_status: paymentStatus,

            subtotal: subtotalForSale,

            discount_amount: discountNominal,

            tax_amount: taxNominal,

            total: sale.total_amount || 0,

            cost: 0,

            isFirstItemInSale: true,

            itemCount: 0,

            sale_items: [],

            hasUnknownProduct: true,

            hasUnknownCustomer: !sale.customer_name || sale.customer_name === t('unknownCustomer'),

            hasUnknownSupplier: true,

            hasNegativeTotal: sale.total_amount < 0

          });

          return;

        }

        

        // Process each item in the sale

        const itemCount = sale.sale_items.length;

        let saleSubtotal = 0;

        

        // Calculate total sale subtotal

        sale.sale_items.forEach(item => {

          saleSubtotal += (item.quantity || 0) * (item.price || 0);

        });

        

        // Calculate nominal discount and tax from percentages

        const discountNominal = saleSubtotal * ((sale.discount || 0) / 100);

        const taxableAmount = saleSubtotal - discountNominal;

        const taxNominal = taxableAmount * ((sale.tax || 0) / 100);

        

        sale.sale_items.forEach((item, index) => {

          const quantity = item.quantity || 0;

          const price = item.price || 0;

          const itemSubtotal = quantity * price;

          

          // Get product info

          const product = item.product_name || t('unknownProduct');

          const supplier = (item.product_id && productsMapData[item.product_id]) 

            ? productsMapData[item.product_id].supplier_name 

            : t('unknownSupplier');

          // Separate MODAL (base cost) and HPP (production cost)
          // Modal = base cost from products table (cost price/purchase price)
          const baseCost = (item.product_id && productsMapData[item.product_id]) 
            ? productsMapData[item.product_id].cost 
            : 0;

          // HPP = production cost (from recipe, custom costs, etc)
          // Use hierarchy: hpp_total (with custom costs) > cost_snapshot > hpp
          const hpp = item.hpp_total || item.cost_snapshot || item.hpp || 0;
          
          // Total cost = Modal + HPP
          const cost = baseCost + hpp;

          // Store individual HPP values for detailed reporting
          const hpp_base = item.hpp || ((item.product_id && productsMapData[item.product_id]) ? productsMapData[item.product_id].hpp : 0);
          const hpp_total = item.hpp_total || 0;
          const cost_snapshot = item.cost_snapshot || 0;
          const hpp_extra = item.hpp_extra || 0;

            

          // Check if product has been deleted (unknown product)

          const hasUnknownProduct = !item.product_name || item.product_name === t('unknownProduct');

          

          // Determine payment method and status
          const paymentMethod = (sale.payment_amount || 0) === 0 || (sale.payment_amount || 0) < sale.total_amount ? 'credit' : 'cash';
          const paymentStatus = sale.payment_status || (paymentMethod === 'credit' ? 'unpaid' : 'paid');

          transformedData.push({

            id: `${sale.id}-${index}`, // Unique ID for this row

            saleId: sale.id, // Original sale ID for operations

            itemId: `${sale.id}-${index}`,

            date: format(new Date(sale.created_at), 'yyyy-MM-dd'),

            product: product,

            customer: sale.customer_name || t('unknownCustomer'),

            supplier: supplier,

            quantity: quantity,

            price: price,

            itemSubtotal: itemSubtotal,

            cashier: sale.user_name || 'Unknown Cashier',

            payment_amount: sale.payment_amount || 0,

            change_amount: sale.change_amount || 0,

            payment_method: paymentMethod,

            payment_status: paymentStatus,

            subtotal: saleSubtotal, // Total sale subtotal for all items

            discount_amount: discountNominal,

            tax_amount: taxNominal,

            total: sale.total_amount || 0,

            // Cost breakdown: Modal + HPP
            baseCost: baseCost, // Modal (base cost from products)
            hpp: hpp, // HPP (production cost)
            cost: cost, // Total = baseCost + hpp

            // HPP breakdown for accurate profit calculation
            hpp_base: hpp_base,
            hpp_total: hpp_total,
            cost_snapshot: cost_snapshot,
            hpp_extra: hpp_extra,

            isFirstItemInSale: index === 0, // Only first item shows sale totals

            itemCount: itemCount,

            sale_items: sale.sale_items, // Keep reference to all sale items

            hasUnknownProduct: hasUnknownProduct,

            hasUnknownCustomer: !sale.customer_name || sale.customer_name === t('unknownCustomer'),

            hasUnknownSupplier: !supplier || supplier === t('unknownSupplier'),

            hasNegativeTotal: sale.total_amount < 0

          });

        });

      });

      

      setAllSalesData(transformedData);

      setFilteredData(transformedData);

      

      // Extract unique products and customers from sales data

      // Filter out unknown products from the product list

      const validProducts = transformedData

        .filter(item => !item.hasUnknownProduct)

        .map(item => item.product);

      const uniqueProducts = [t('allProducts'), ...new Set(validProducts)];

      

      // Filter out unknown customers from the customer list

      const validCustomers = transformedData

        .filter(item => !item.hasUnknownCustomer)

        .map(item => item.customer);

      const uniqueCustomers = [t('allCustomers'), ...new Set(validCustomers)];

      

      setProducts(uniqueProducts);

      setCustomers(uniqueCustomers);

      

      // Fetch returns data
      try {
        // Use the user object from context which already has the database user ID
        if (user && user.id) {
          const { data: returnsDataFetched, error: returnsError } = await supabase
            .from('returns')
            .select(`
              *,
              return_items(*)
            `)
            .eq('user_id', user.id);

          if (returnsError) {
            console.error('Error fetching returns:', returnsError);
          } else {
            setReturnsData(returnsDataFetched || []);
          }
        }
      } catch (error) {
        console.error('Error loading returns data:', error);
        setReturnsData([]);
      }

      // Reset retry count on successful fetch

      setRetryCount(0);

    } catch (error) {

      console.error('Error fetching sales data:', error);

      setError(error.message);

      

      // Check if this is an authentication error

      if (error.message.includes('Akses tidak sah') || error.message.includes('Invalid token') || error.message.includes('401') || error.message.includes('403')) {

        toast({ 

          title: t('authenticationError'), 

          description: t('pleaseLoginAgain'), 

          variant: 'destructive' 

        });

      } else {

        toast({ 

          title: t('error'), 

          description: `${t('failedLoadData')}: ${error.message}`, 

          variant: 'destructive' 

        });

      }

      

      // Retry mechanism - retry up to 3 times with exponential backoff

      if (retryAttempt < 3) {

        const delay = Math.pow(2, retryAttempt) * 1000; // 1s, 2s, 4s

        setTimeout(() => {

          fetchData(retryAttempt + 1);

        }, delay);

        setRetryCount(retryAttempt + 1);

      } else {

        // If there's any error after max retries, initialize with empty data to prevent app crash

        setAllSalesData([]);

        setFilteredData([]);

        setProducts([t('allProducts')]);

        setCustomers([t('allCustomers')]);

        setSuppliers([t('allSuppliers')]);

        setProductsMap({});

        toast({ 

          title: t('error'), 

          description: `${t('failedLoadData')} ${retryAttempt} ${t('attempts')}. ${t('pleaseTryAgain')}`, 

          variant: 'destructive' 

        });

      }

    } finally {

      setIsLoading(false);

    }

  };



  // Load sales data from the backend API

  useEffect(() => {

    fetchData();
    loadHPPSetting();

  }, [user, token, toast]);

  // Note: Global HPP loading removed - now managed via Expenses system
  // useEffect(() => {
  //   loadGlobalHPP();
  // }, [dateRange, token]);

  const loadHPPSetting = async () => {
    if (!token) return;
    
    try {
      const setting = await settingsAPI.get('hpp_enabled', token);
      if (setting && setting.setting_value && setting.setting_value.enabled) {
        setHppEnabled(true);
      }
    } catch (error) {
      console.error('Error loading HPP setting:', error);
      setHppEnabled(false);
    }
  };

  // Note: Global HPP loading removed - now managed via Expenses system
  // Employee salaries and profit shares will be integrated from Expenses system later
  // Data pengeluaran dari Expenses system akan diintegrasikan ke laporan keuangan nanti
  const loadGlobalHPP = async () => {
    // Temporarily disabled - Expenses system will provide this data
    return;
  };

  const applyFilters = () => {

    let data = allSalesData;

    if (dateRange.from && dateRange.to) {

      data = data.filter(item => new Date(item.date) >= dateRange.from && new Date(item.date) <= dateRange.to);

    }

    // Time range filter
    if (timeRangePreset !== 'all') {
      const startTime = timeRangePreset === 'custom' ? customTimeStart : TIME_PRESETS[timeRangePreset].start;
      const endTime = timeRangePreset === 'custom' ? customTimeEnd : TIME_PRESETS[timeRangePreset].end;
      
      data = data.filter(item => {
        const itemDateTime = new Date(item.created_at || item.date);
        const itemTime = itemDateTime.toTimeString().slice(0, 5); // HH:MM format
        return itemTime >= startTime && itemTime <= endTime;
      });
    }

    if (selectedProduct !== t('allProducts')) data = data.filter(item => item.product === selectedProduct);

    if (selectedCustomer !== t('allCustomers')) data = data.filter(item => item.customer === selectedCustomer);

    if (selectedSupplier !== t('allSuppliers')) data = data.filter(item => item.supplier === selectedSupplier);

    if (selectedPaymentMethod !== 'all') data = data.filter(item => item.payment_method === selectedPaymentMethod);

    

    // Apply corrupt data filter

    if (hideCorruptData) {

      data = data.filter(item => !item.hasNegativeTotal);

    }

    

    setFilteredData(data);

    toast({ title: t('filterApplied'), description: t('reportUpdated') });

  };



  const profitLossData = useMemo(() => {

    // Filter out transactions with unknown products AND only include paid transactions for profit calculation

    const validData = filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid');

    

    const dailyData = validData.reduce((acc, sale) => {

      const day = format(new Date(sale.date), 'yyyy-MM-dd');

      if (!acc[day]) acc[day] = { name: format(new Date(day), 'EEE'), revenue: 0, cost: 0, profit: 0, globalHPP: 0 };

      acc[day].revenue += sale.total;

      // sale.cost already contains the total cost for this item in the transaction
      acc[day].cost += sale.cost;

      acc[day].profit += (sale.total - sale.cost);

      return acc;

    }, {});

    // Add daily global HPP to each day
    const dailyGlobalHPP = globalHPPData.reduce((sum, item) => sum + parseFloat(item.monthly_amount || 0), 0) / 30;
    
    Object.keys(dailyData).forEach(day => {
      dailyData[day].globalHPP = dailyGlobalHPP;
      dailyData[day].profit -= dailyGlobalHPP; // Deduct global HPP from profit
    });

    return Object.values(dailyData);

  }, [filteredData, globalHPPData]);

  const financialData = useMemo(() => {
    // 1. PENDAPATAN (Revenue)
    const paidCashSales = filteredData.filter(item => 
      !item.hasUnknownProduct && 
      item.payment_status === 'paid' && 
      item.payment_method === 'cash'
    );
    
    const paidCreditSales = filteredData.filter(item => 
      !item.hasUnknownProduct && 
      item.payment_status === 'paid' && 
      item.payment_method === 'credit'
    );
    
    const unpaidCreditSales = filteredData.filter(item => 
      !item.hasUnknownProduct && 
      item.payment_status === 'unpaid'
    );

    // Group by sale ID to avoid duplicate counting
    const uniquePaidCash = [...new Map(paidCashSales.map(item => [item.saleId, item])).values()];
    const uniquePaidCredit = [...new Map(paidCreditSales.map(item => [item.saleId, item])).values()];
    const uniqueUnpaidCredit = [...new Map(unpaidCreditSales.map(item => [item.saleId, item])).values()];

    const cashRevenue = uniquePaidCash.reduce((sum, item) => sum + item.total, 0);
    const creditPaidRevenue = uniquePaidCredit.reduce((sum, item) => sum + item.total, 0);
    const creditUnpaidRevenue = uniqueUnpaidCredit.reduce((sum, item) => sum + item.total, 0);
    
    const grossSales = cashRevenue + creditPaidRevenue;
    
    // Calculate total discount from paid transactions
    const totalDiscount = [...uniquePaidCash, ...uniquePaidCredit].reduce(
      (sum, item) => sum + (item.discount_amount || 0), 0
    );
    
    const netRevenue = grossSales;

    // 2. BEBAN (Expenses) - Only from PAID transactions
    const paidTransactions = filteredData.filter(item => 
      !item.hasUnknownProduct && item.payment_status === 'paid'
    );
    
    const totalCOGS = paidTransactions.reduce((sum, item) => 
      sum + (item.cost * item.quantity), 0
    );

    // Calculate returns - only for paid transactions
    const stockReturns = returnsData.filter(r => 
      r.return_type === 'stock' &&
      filteredData.some(item => item.saleId === r.sale_id && item.payment_status === 'paid')
    );
    
    const lossReturns = returnsData.filter(r => 
      r.return_type === 'loss' &&
      filteredData.some(item => item.saleId === r.sale_id && item.payment_status === 'paid')
    );

    const totalStockReturns = stockReturns.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
    const totalLossReturns = lossReturns.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);

    // Adjust revenue for stock returns (deduct from gross sales)
    const adjustedGrossSales = grossSales - totalStockReturns;
    const adjustedNetRevenue = adjustedGrossSales;

    // Global HPP (Fixed Costs)
    const globalHPPTotal = globalHPPData.reduce((sum, item) => 
      sum + parseFloat(item.monthly_amount || 0), 0
    );
    
    // Adjust profit for loss returns (add to expenses)
    const totalExpensesWithLoss = totalCOGS + globalHPPTotal + totalLossReturns;

    // 3. LABA/RUGI (Profit/Loss)
    const grossProfit = adjustedNetRevenue - totalCOGS;
    const grossMargin = adjustedGrossSales > 0 ? (grossProfit / adjustedGrossSales) * 100 : 0;
    
    const netProfit = grossProfit - globalHPPTotal - totalLossReturns;
    const netMargin = adjustedNetRevenue > 0 ? (netProfit / adjustedNetRevenue) * 100 : 0;

    // 4. ARUS KAS (Cash Flow)
    const cashInflow = cashRevenue + creditPaidRevenue;

    // 5. RINGKASAN TRANSAKSI
    const totalTransactions = uniquePaidCash.length + uniquePaidCredit.length + uniqueUnpaidCredit.length;
    const totalItemsSold = filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid')
      .reduce((sum, item) => sum + item.quantity, 0);
    const avgTransactionValue = totalTransactions > 0 ? 
      (cashRevenue + creditPaidRevenue + creditUnpaidRevenue) / totalTransactions : 0;

    return {
      revenue: {
        cashSales: cashRevenue,
        creditPaidSales: creditPaidRevenue,
        grossSales: adjustedGrossSales, // After stock returns
        totalDiscount,
        netRevenue: adjustedNetRevenue,
        stockReturns: totalStockReturns // NEW
      },
      expenses: {
        cogs: totalCOGS,
        globalHPP: globalHPPTotal,
        lossReturns: totalLossReturns, // NEW
        globalHPPBreakdown: globalHPPData.map(item => ({
          name: item.name,
          amount: parseFloat(item.monthly_amount || 0)
        })),
        total: totalExpensesWithLoss
      },
      profitLoss: {
        netRevenue: adjustedNetRevenue,
        cogs: totalCOGS,
        grossProfit,
        grossMargin,
        fixedCosts: globalHPPTotal,
        lossReturns: totalLossReturns, // NEW
        netProfit,
        netMargin
      },
      cashFlow: {
        cashSales: cashRevenue,
        creditCollections: creditPaidRevenue,
        totalCashInflow: cashInflow
      },
      receivables: {
        unpaidAmount: creditUnpaidRevenue,
        unpaidCount: uniqueUnpaidCredit.length
      },
      summary: {
        totalTransactions,
        cashTransactions: uniquePaidCash.length,
        creditPaidTransactions: uniquePaidCredit.length,
        creditUnpaidTransactions: uniqueUnpaidCredit.length,
        totalItemsSold,
        avgTransactionValue
      }
    };
  }, [filteredData, globalHPPData, returnsData]); // Add returnsData dependency



  const handleExport = (data, name, type) => {

    let excelData = [];

    let options = {};

    

    if (type === 'transactions') {

      // Transform data for Transactions tab export
      excelData = data.map(item => {
        // Calculate proportional discount and tax per item based on item subtotal
        const itemRatio = item.subtotal > 0 ? (item.itemSubtotal / item.subtotal) : 0;
        const itemDiscount = item.discount_amount * itemRatio;
        const itemTax = item.tax_amount * itemRatio;
        const itemTotal = item.itemSubtotal - itemDiscount + itemTax;

        return {
          'Tanggal': new Date(item.date).toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          'Produk': item.product,
          'Pelanggan': item.customer,
          'Supplier': item.supplier,
          'Kasir': item.cashier,
          'Jumlah': item.quantity,
          'Harga': `Rp ${item.price.toLocaleString()}`,
          'Subtotal Item': `Rp ${item.itemSubtotal.toLocaleString()}`,
          'Diskon': `Rp ${Math.round(itemDiscount).toLocaleString()}`,
          'Pajak': `Rp ${Math.round(itemTax).toLocaleString()}`,
          'Total': `Rp ${Math.round(itemTotal).toLocaleString()}`
        };
      });

      

      options = {

        sheetName: 'Laporan Transaksi',

        columnWidths: [20, 25, 20, 20, 20, 15, 15, 18, 15, 15, 18]

      };

    } else if (type === 'profitloss') {

      // Transform data for Profit/Loss tab export

      const validData = data.filter(item => !item.hasUnknownProduct);

      

      excelData = validData.map(item => {

        const itemTotal = item.itemSubtotal; // Total per item (qty × price)
        // Use item.cost which already contains baseCost + hpp (Modal Produk + Bahan Baku)
        const cost = item.cost * item.quantity; // Total cost per item
        const profit = itemTotal - cost; // Profit per item

        

        return {

          'Tanggal': new Date(item.date).toLocaleString('id-ID', {

            year: 'numeric',

            month: '2-digit',

            day: '2-digit',

            hour: '2-digit',

            minute: '2-digit',

            second: '2-digit'

          }),

          'Produk': item.product,

          'Pelanggan': item.customer,

          'Supplier': item.supplier,

          'Kasir': item.cashier,

          'Jumlah': item.quantity,

          'Total': `Rp ${itemTotal.toLocaleString()}`,

          'Biaya': `Rp ${cost.toLocaleString()}`,

          'Laba': `Rp ${profit.toLocaleString()}`

        };

      });

      

      options = {

        sheetName: 'Laporan Laba Rugi',

        columnWidths: [20, 25, 20, 20, 20, 15, 20, 20, 20]

      };

    } else if (type === 'stockopname') {

      // Transform data for Stock Opname tab export - separate finished products and raw materials

      excelData = data.map(product => {

        const stockValue = (product.price || 0) * (product.stock || 0);
        // Modal = cost (modal produk) + hpp (bahan baku)
        const stockCost = ((product.cost || 0) + (product.hpp || 0)) * (product.stock || 0);
        const potentialProfit = stockValue - stockCost;

        return {

          [t('productName')]: product.name,

          [t('barcode')]: product.barcode || '-',

          'Kategori': product.is_raw_material ? 'Bahan Baku' : 'Produk Jadi',

          'Supplier': product.supplier_name || '-',

          'Stok': product.stock || 0,

          'Stok Minimum': product.min_stock || 0,

          'Harga Jual': `Rp ${(product.price || 0).toLocaleString()}`,

          'Harga Modal (Cost)': `Rp ${(product.cost || 0).toLocaleString()}`,

          'HPP (Bahan Baku)': product.is_raw_material ? `Rp ${(product.hpp || 0).toLocaleString()}` : '-',

          'Total Nilai Jual': `Rp ${stockValue.toLocaleString()}`,

          'Total Modal + HPP': `Rp ${stockCost.toLocaleString()}`,

          'Potensi Laba': `Rp ${potentialProfit.toLocaleString()}`

        };

      });

      

      options = {

        sheetName: 'Stock Opname',

        columnWidths: [25, 15, 15, 20, 10, 12, 15, 15, 15, 18, 18, 18]

      };

    } else if (type === 'financial') {

      // Financial Report Export
      excelData = [
        { 'Section': 'PENDAPATAN', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Penjualan Tunai (Lunas)', 'Jumlah': `Rp ${data.revenue.cashSales.toLocaleString()}` },
        { 'Section': '', 'Item': 'Penjualan Kredit (Lunas)', 'Jumlah': `Rp ${data.revenue.creditPaidSales.toLocaleString()}` },
        { 'Section': '', 'Item': 'Total Penjualan Kotor', 'Jumlah': `Rp ${data.revenue.grossSales.toLocaleString()}` },
        ...(data.revenue.stockReturns > 0 ? [{ 'Section': '', 'Item': 'Retur (Kembalikan Stok)', 'Jumlah': `-Rp ${data.revenue.stockReturns.toLocaleString()}` }] : []),
        { 'Section': '', 'Item': 'Diskon yang Diberikan', 'Jumlah': `-Rp ${data.revenue.totalDiscount.toLocaleString()}` },
        { 'Section': '', 'Item': 'Total Pendapatan Bersih', 'Jumlah': `Rp ${data.revenue.netRevenue.toLocaleString()}` },
        { 'Section': '', 'Item': '', 'Jumlah': '' },
        
        { 'Section': 'BEBAN', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Harga Pokok Penjualan (HPP)', 'Jumlah': `Rp ${data.expenses.cogs.toLocaleString()}` },
        ...(data.expenses.lossReturns > 0 ? [{ 'Section': '', 'Item': 'Retur Rugi (Tidak Dikembalikan)', 'Jumlah': `Rp ${data.expenses.lossReturns.toLocaleString()}` }] : []),
        ...data.expenses.globalHPPBreakdown.map(item => ({
          'Section': '', 'Item': `  - ${item.name}`, 'Jumlah': `Rp ${item.amount.toLocaleString()}`
        })),
        { 'Section': '', 'Item': 'Total Biaya Tetap', 'Jumlah': `Rp ${data.expenses.globalHPP.toLocaleString()}` },
        { 'Section': '', 'Item': 'TOTAL BEBAN', 'Jumlah': `Rp ${data.expenses.total.toLocaleString()}` },
        { 'Section': '', 'Item': '', 'Jumlah': '' },
        
        { 'Section': 'LABA/RUGI', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Pendapatan Bersih', 'Jumlah': `Rp ${data.profitLoss.netRevenue.toLocaleString()}` },
        { 'Section': '', 'Item': 'HPP', 'Jumlah': `-Rp ${data.profitLoss.cogs.toLocaleString()}` },
        { 'Section': '', 'Item': 'Laba Kotor', 'Jumlah': `Rp ${data.profitLoss.grossProfit.toLocaleString()}` },
        { 'Section': '', 'Item': 'Margin Laba Kotor', 'Jumlah': `${data.profitLoss.grossMargin.toFixed(2)}%` },
        { 'Section': '', 'Item': 'Biaya Tetap', 'Jumlah': `-Rp ${data.profitLoss.fixedCosts.toLocaleString()}` },
        ...(data.profitLoss.lossReturns > 0 ? [{ 'Section': '', 'Item': 'Retur Rugi', 'Jumlah': `-Rp ${data.profitLoss.lossReturns.toLocaleString()}` }] : []),
        { 'Section': '', 'Item': 'LABA BERSIH', 'Jumlah': `Rp ${data.profitLoss.netProfit.toLocaleString()}` },
        { 'Section': '', 'Item': 'Margin Laba Bersih', 'Jumlah': `${data.profitLoss.netMargin.toFixed(2)}%` },
        { 'Section': '', 'Item': '', 'Jumlah': '' },
        
        { 'Section': 'ARUS KAS', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Penjualan Tunai', 'Jumlah': `Rp ${data.cashFlow.cashSales.toLocaleString()}` },
        { 'Section': '', 'Item': 'Pelunasan Kredit', 'Jumlah': `Rp ${data.cashFlow.creditCollections.toLocaleString()}` },
        { 'Section': '', 'Item': 'Total Kas Masuk', 'Jumlah': `Rp ${data.cashFlow.totalCashInflow.toLocaleString()}` },
        { 'Section': '', 'Item': '', 'Jumlah': '' },
        
        { 'Section': 'PIUTANG', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Penjualan Kredit Belum Lunas', 'Jumlah': `Rp ${data.receivables.unpaidAmount.toLocaleString()}` },
        { 'Section': '', 'Item': 'Jumlah Transaksi Kredit', 'Jumlah': `${data.receivables.unpaidCount} transaksi` },
        { 'Section': '', 'Item': '', 'Jumlah': '' },
        
        { 'Section': 'RINGKASAN TRANSAKSI', 'Item': '', 'Jumlah': '' },
        { 'Section': '', 'Item': 'Total Transaksi', 'Jumlah': `${data.summary.totalTransactions}` },
        { 'Section': '', 'Item': '  - Tunai', 'Jumlah': `${data.summary.cashTransactions}` },
        { 'Section': '', 'Item': '  - Kredit Lunas', 'Jumlah': `${data.summary.creditPaidTransactions}` },
        { 'Section': '', 'Item': '  - Kredit Belum Lunas', 'Jumlah': `${data.summary.creditUnpaidTransactions}` },
        { 'Section': '', 'Item': 'Total Item Terjual', 'Jumlah': `${data.summary.totalItemsSold} pcs` },
        { 'Section': '', 'Item': 'Rata-rata Nilai Transaksi', 'Jumlah': `Rp ${Math.round(data.summary.avgTransactionValue).toLocaleString()}` },
      ];
      
      options = {
        sheetName: 'Laporan Keuangan',
        columnWidths: [25, 40, 20]
      };

    } else {

      // Default export (backward compatibility)

      excelData = data.map(item => ({

        'ID Transaksi': item.id,

        'Tanggal': new Date(item.date).toLocaleString('id-ID', {

          year: 'numeric',

          month: '2-digit',

          day: '2-digit',

          hour: '2-digit',

          minute: '2-digit',

          second: '2-digit'

        }),

        'Kasir': item.cashier,

        'Total': item.total,

        'Pembayaran': item.payment_amount || 0,

        'Kembalian': item.change_amount || 0

      }));

      

      options = {

        sheetName: 'Laporan Transaksi',

        columnWidths: [20, 25, 20, 15, 15, 15]

      };

    }

    

    // Export with enhanced options

    exportToExcel(excelData, name, options);

    

    toast({ title: t('exportSuccess'), description: `${name}.xlsx ${t('hasBeenDownloaded')}` });

  };



  const toggleTransactionSelection = (saleId) => {

    const newSelected = new Set(selectedTransactions);

    if (newSelected.has(saleId)) {

      newSelected.delete(saleId);

    } else {

      newSelected.add(saleId);

    }

    setSelectedTransactions(newSelected);

  };



  const selectAllTransactions = () => {

    if (selectedTransactions.size === filteredData.length) {

      // If all are selected, deselect all

      setSelectedTransactions(new Set());

    } else {

      // Select all unique sale IDs from filtered data

      const allSaleIds = new Set(filteredData.map(item => item.saleId));

      setSelectedTransactions(allSaleIds);

    }

  };



  const deleteSelectedTransactions = async () => {

    if (selectedTransactions.size === 0) {

      toast({ title: t('noTransactionsSelected'), description: t('pleaseSelectTransactionsToDelete'), variant: 'destructive' });

      return;

    }



    if (!window.confirm(`${t('confirmDeleteTransactions')} ${selectedTransactions.size} ${t('transactions')}. ${t('thisActionWillRestoreStock')} ${t('cannotBeUndone')}`)) {

      return;

    }



    try {

      // Convert Set to Array for easier handling

      const transactionIds = Array.from(selectedTransactions);

      

      // Delete each selected transaction

      const deletePromises = transactionIds.map(id => salesAPI.delete(id, token));

      await Promise.all(deletePromises);

      

      // Refresh data after deletion

      await fetchData();

      

      // Clear selected transactions

      setSelectedTransactions(new Set());

      

      toast({ title: t('success'), description: `${transactionIds.length} ${t('transactionsSuccessfullyDeletedAndStockRestored')}` });

    } catch (error) {

      console.error('Error deleting transactions:', error);

      toast({ title: t('error'), description: `${t('failedToDeleteTransactions')}: ${error.message}`, variant: 'destructive' });

    }

  };

  // Handler for marking transaction as paid
  const handleMarkAsPaid = async () => {
    if (!selectedTransactionForAction) return;

    if (paymentAmountForPaid < selectedTransactionForAction.total) {
      toast({ 
        title: t('error'), 
        description: t('insufficientPayment') || 'Jumlah pembayaran kurang dari total', 
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
      
      await fetchData(); // Refresh data
      
      toast({ 
        title: t('success'), 
        description: t('transactionMarkedAsPaid') || 'Transaksi berhasil ditandai lunas' 
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

  // Handler for changing transaction to credit
  const handleChangeToCredit = async () => {
    if (!selectedTransactionForAction) return;

    if (!window.confirm(t('confirmChangeToCredit') || 'Ubah transaksi ini menjadi kredit?')) {
      return;
    }

    try {
      await salesAPI.updatePaymentStatus(
        selectedTransactionForAction.saleId, 
        'unpaid', 
        0, 
        token
      );
      
      await fetchData(); // Refresh data
      
      toast({ 
        title: t('success'), 
        description: t('transactionChangedToCredit') || 'Transaksi berhasil diubah menjadi kredit' 
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

  // Handler for deleting single transaction
  const handleDeleteTransaction = async () => {
    if (!selectedTransactionForAction) return;

    if (!window.confirm(t('confirmDeleteTransaction'))) {
      return;
    }

    try {
      await salesAPI.delete(selectedTransactionForAction.saleId, token);
      
      await fetchData(); // Refresh data
      
      toast({ 
        title: t('success'), 
        description: t('transactionDeleted') || 'Transaksi berhasil dihapus dan stok dikembalikan' 
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

  // Handler for initiating return process
  const handleInitiateReturn = async () => {
    if (!selectedTransactionForAction) return;

    // Check if already returned
    if (selectedTransactionForAction.return_status === 'full') {
      toast({
        title: t('error'),
        description: 'Transaksi ini sudah diretur sepenuhnya',
        variant: 'destructive'
      });
      return;
    }

    // Load sale items for return selection
    try {
      const saleData = await salesAPI.getById(selectedTransactionForAction.saleId, token);
      
      // Defensive check: ensure saleData and items exist
      if (!saleData || !saleData.items || !Array.isArray(saleData.items)) {
        throw new Error('Data transaksi tidak valid atau tidak memiliki item');
      }
      
      // Initialize return items with full quantities
      const items = saleData.items.map(item => ({
        sale_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        returnQuantity: item.quantity,
        price: item.price,
        cost: item.cost || 0
      }));
      
      setReturningItems(items);
      setShowActionDialog(false);
      setShowReturnDialog(true);
    } catch (error) {
      console.error('Error loading sale items:', error);
      toast({
        title: t('error'),
        description: `Gagal memuat item transaksi: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  // Handler for processing return
  const handleProcessReturn = async () => {
    if (!selectedTransactionForAction) return;

    // Validate that at least one item is selected
    const itemsToReturn = returningItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      toast({
        title: t('error'),
        description: t('minimumOneItemRequired'),
        variant: 'destructive'
      });
      return;
    }

    // Confirm return
    const confirmMessage = returnType === 'stock'
      ? t('confirmReturnToStock').replace('{count}', itemsToReturn.length)
      : t('confirmReturnAsLoss').replace('{count}', itemsToReturn.length);
      
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Calculate total return amount
      const totalAmount = itemsToReturn.reduce((sum, item) => 
        sum + (item.price * item.returnQuantity), 0
      );

      // Create return record
      const returnData = {
        sale_id: selectedTransactionForAction.saleId,
        return_type: returnType,
        reason: returnReason,
        total_amount: totalAmount,
        total_sale_items: returningItems.length,
        items: itemsToReturn.map(item => ({
          sale_item_id: item.sale_item_id,
          product_id: item.product_id,
          quantity: item.returnQuantity,
          price: item.price,
          cost: item.cost
        }))
      };

      await returnsAPI.create(returnData, token);
      
      await fetchData(); // Refresh data
      
      toast({
        title: t('success'),
        description: returnType === 'stock' 
          ? 'Retur berhasil diproses dan stok dikembalikan'
          : 'Retur berhasil dicatat sebagai rugi'
      });
      
      setShowReturnDialog(false);
      setSelectedTransactionForAction(null);
      setReturningItems([]);
      setReturnReason('');
      setReturnType('stock');
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: t('error'),
        description: `Gagal memproses retur: ${error.message}`,
        variant: 'destructive'
      });
    }
  };



  // Print Invoice Handler - Modified to open dialog instead of direct print

  const handlePrintInvoice = async (item) => {

    try {

      // Load company settings to ensure they're up to date

      await loadCompanySettings();

      

      // Fetch full sale details using salesAPI.getById to ensure we have complete data with items

      const fullSaleData = await salesAPI.getById(item.saleId, token);

      

      // Set selectedSaleForPrint with the fetched sale data

      setSelectedSaleForPrint(fullSaleData);

      

      // Open print dialog

      setShowPrintDialog(true);

    } catch (error) {

      console.error('Error fetching sale details for printing:', error);

      toast({ 

        title: t('error'), 

        description: `${t('failedToLoadSaleDetails')}: ${error.message}`, 

        variant: 'destructive' 

      });

    }

  };



  // Unified print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${receiptType === 'delivery-note' ? 'delivery-note' : 'receipt'}-${selectedSaleForPrint?.id || 'preview'}`,

    onBeforeGetContent: () => {
      // Set data attribute based on receipt type
      if (receiptType.startsWith('thermal')) {
        document.body.setAttribute('data-printing', 'thermal');
      } else if (receiptType === 'delivery-note') {
        document.body.setAttribute('data-printing', 'delivery-note');
      } else {
        document.body.setAttribute('data-printing', 'invoice');
      }
      // Delay untuk memastikan CSS ter-inject sempurna
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    },
    onAfterPrint: () => {

      // Remove data attribute after printing
      document.body.removeAttribute('data-printing');
      // Close dialog after printing

      setShowPrintDialog(false);

      setSelectedSaleForPrint(null);

    }

  });



  // Transform sale data for thermal receipt

  const transformSaleForThermal = (sale) => {

    if (!sale) return null;

    

    // Transform items to cart format

    const cart = sale.sale_items ? sale.sale_items.map(item => {

      // Get product barcode from productsMap if available

      const productId = item.product_id;

      const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;

      

      return {

        id: item.product_id,

        name: item.product_name,

        barcode: item.barcode || productBarcode || '-',

        quantity: item.quantity,

        price: item.price

      };

    }) : [];

    

    // Calculate subtotal from items

    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    

    // Calculate nominal discount and tax from percentages

    const discountPercent = sale.discount || 0;

    const taxPercent = sale.tax || 0;

    const discountAmount = subtotal * (discountPercent / 100);

    const taxableAmount = subtotal - discountAmount;

    const taxAmount = taxableAmount * (taxPercent / 100);

    

    return {

      cart,

      subtotal,

      discountPercent,

      discountAmount,

      taxPercent,

      taxAmount,

      total: sale.total_amount || 0,

      paymentAmount: sale.payment_amount || 0,

      change: sale.change_amount || 0,

      customer: {

        name: sale.customer_name || 'Umum'

      }

    };

  };



  // Transform sale data for A4 invoice

  const transformSaleForA4 = (sale) => {

    if (!sale) return null;

    

    // Transform sale_items to items format expected by InvoiceA4

    const items = sale.sale_items ? sale.sale_items.map(item => {

      // Get product barcode from productsMap if available

      const productId = item.product_id;

      const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;

      

      return {

        product_name: item.product_name || 'Unknown Product',

        barcode: item.barcode || productBarcode || null,

        quantity: item.quantity || 0,

        price: item.price || 0

      };

    }) : [];

    

    // Calculate subtotal from items

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    

    // Calculate nominal discount and tax from percentages

    const discountAmount = subtotal * ((sale.discount || 0) / 100);

    const taxableAmount = subtotal - discountAmount;

    const taxAmount = taxableAmount * ((sale.tax || 0) / 100);

    

    return {
      ...sale,
      items: items, // InvoiceA4 expects 'items', not 'sale_items'
      subtotal: subtotal,
      discount_amount: discountAmount,
      discount_percent: sale.discount || 0,
      tax_amount: taxAmount,
      tax_percent: sale.tax || 0,
      total_amount: sale.total_amount || 0,
      created_at: sale.created_at,
      customer: {
        name: sale.customer_name || 'Umum',
        address: sale.customer_address || '',
        phone: sale.customer_phone || ''
      }
    };

  };



  return (

    <>

      <Helmet>

        <title>{t('reports')} - idCashier</title>

        <meta name="description" content={t('reportsMetaDesc')} />

      </Helmet>



      <div className="space-y-4">

        <div>

          <h1 className="text-2xl font-bold mb-2">{t('reports')}</h1>

          <p className="text-muted-foreground text-sm">{t('reportsSubtitle')}</p>

        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

          <TabsList className="grid grid-cols-4 w-full">

            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>

            <TabsTrigger value="profitloss">{t('profitLossReport')}</TabsTrigger>

            <TabsTrigger value="stockopname">{t('stockOpname')}</TabsTrigger>

            <TabsTrigger value="financial">{t('financialReport')}</TabsTrigger>

          </TabsList>



          <TabsContent value="overview" className="space-y-4">

            <Card>

              <CardHeader className="p-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                  <CardTitle className="text-lg">{t('overview')}</CardTitle>

                  <div className="flex gap-1.5">

                    <Button size="sm" onClick={applyFilters} variant="outline">

                      <Search className="w-4 h-4 mr-2" />

                      {t('applyFilters')}

                    </Button>

                  </div>

                </div>

              </CardHeader>

              <CardContent className="p-4 space-y-4">

                {/* Filter options for overview tab */}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

                  <div>

                    <Label className="text-xs">{t('dateRange')}</Label>

                    <Popover>

                      <PopoverTrigger asChild>

                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("w-full justify-start text-left font-normal text-sm p-2")}
                        >

                          <CalendarIcon className="mr-2 h-4 w-4" />

                          {dateRange.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                              </>
                            ) : (
                              format(dateRange.from, "dd/MM/yyyy")
                            )
                          ) : (
                            <span className="text-xs">{t('pickDateRange')}</span>
                          )}

                        </Button>

                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0" align="start">

                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />

                      </PopoverContent>

                    </Popover>

                  </div>

                  <div>

                    <Label className="text-xs">{t('product')}</Label>

                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectProduct')} />

                      </SelectTrigger>

                      <SelectContent>

                        {products.map((product) => (

                          <SelectItem key={product} value={product} className="text-sm">

                            {product}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                  <div>

                    <Label className="text-xs">{t('customer')}</Label>

                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectCustomer')} />

                      </SelectTrigger>

                      <SelectContent>

                        {customers.map((customer) => (

                          <SelectItem key={customer} value={customer} className="text-sm">

                            {customer}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                  <div>

                    <Label className="text-xs">{t('supplier')}</Label>

                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectSupplier')} />

                      </SelectTrigger>

                      <SelectContent>

                        {suppliers.map((supplier) => (

                          <SelectItem key={supplier} value={supplier} className="text-sm">

                            {supplier}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </div>

              </CardContent>

            </Card>

            <Card>

              <CardHeader>

                <CardTitle className="text-lg">{t('profitLossReport')}</CardTitle>

              </CardHeader>

              <CardContent>

                <div className="h-64">

                  <ResponsiveContainer width="100%" height="100%">

                    <BarChart data={profitLossData}>

                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="name" />

                      <YAxis />

                      <Tooltip />

                      <Legend />

                      <Bar dataKey="revenue" fill="#10b981" name={t('revenue')} />

                      <Bar dataKey="cost" fill="#f59e0b" name={t('cost')} />

                      <Bar dataKey="profit" fill="#3b82f6" name={t('profit')} />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </CardContent>

            </Card>



            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('totalRevenue')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">

                    Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.total, 0).toLocaleString()}

                  </p>

                </CardContent>

              </Card>



              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('totalTransactions')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">{filteredData.length}</p>

                  {filteredData.some(item => item.hasUnknownProduct || item.hasUnknownCustomer) && (

                    <p className="text-xs text-yellow-600 mt-1">

                      {filteredData.filter(item => item.hasUnknownProduct || item.hasUnknownCustomer).length} {t('transactionsWithIncompleteData')}

                    </p>

                  )}

                </CardContent>

              </Card>



              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('averageTransaction')}</CardTitle>

                </CardHeader>

                <CardContent className="p-4">

                  <p className="text-2xl font-bold">

                    Rp {filteredData.filter(item => !item.hasUnknownProduct).length > 0 ? 

                      Math.round(filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.total, 0) / 

                       filteredData.filter(item => !item.hasUnknownProduct).length).toLocaleString('id-ID') : 0}

                  </p>

                </CardContent>

              </Card>

            </div>

          </TabsContent>



          <TabsContent value="profitloss" className="space-y-4">

            <Card>

              <CardHeader className="p-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                  <CardTitle className="text-lg">{t('profitLossReport')}</CardTitle>

                  <div className="flex gap-1.5">

                    <Button size="sm" onClick={applyFilters} variant="outline">

                      <Search className="w-4 h-4 mr-2" />

                      {t('applyFilters')}

                    </Button>

                    <Button size="sm" onClick={() => handleExport(filteredData, 'profit_loss_report', 'profitloss')} variant="outline" disabled={!permissions.canExportReports}>

                      <Download className="w-4 h-4 mr-2" />

                      {t('export')}

                    </Button>

                  </div>

                </div>

              </CardHeader>

              <CardContent className="p-4 space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">

                  <div>

                    <Label className="text-xs">{t('dateRange')}</Label>

                    <Popover>

                      <PopoverTrigger asChild>

                        <Button

                          variant="outline"

                          size="sm"

                          className={cn("w-full justify-start text-left font-normal text-sm p-2")}

                        >

                          <CalendarIcon className="mr-2 h-4 w-4" />

                          {dateRange.from ? (

                            dateRange.to ? (

                              <>

                                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}

                              </>

                            ) : (

                              format(dateRange.from, "dd/MM/yyyy")

                            )

                          ) : (

                            <span className="text-xs">{t('pickDateRange')}</span>

                          )}

                        </Button>

                      </PopoverTrigger>

                      <PopoverContent className="w-auto p-0" align="start">

                        <Calendar

                          initialFocus

                          mode="range"

                          defaultMonth={dateRange.from}

                          selected={dateRange}

                          onSelect={setDateRange}

                          numberOfMonths={2}

                        />

                      </PopoverContent>

                    </Popover>

                  </div>

                  <div>

                    <Label className="text-xs">{t('timeRange') || 'Jam Operasional'}</Label>

                    <Select value={timeRangePreset} onValueChange={setTimeRangePreset}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue />

                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="all">24 Jam</SelectItem>

                        <SelectItem value="morning">Pagi (06:00-12:00)</SelectItem>

                        <SelectItem value="afternoon">Siang (12:00-18:00)</SelectItem>

                        <SelectItem value="night">Malam (18:00-24:00)</SelectItem>

                        <SelectItem value="custom">Custom...</SelectItem>

                      </SelectContent>

                    </Select>

                  </div>

                  <div>

                    <Label className="text-xs">{t('product')}</Label>

                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectProduct')} />

                      </SelectTrigger>

                      <SelectContent>

                        {products.map((product) => (

                          <SelectItem key={product} value={product} className="text-sm">

                            {product}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>



                  <div>

                    <Label className="text-xs">{t('customer')}</Label>

                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectCustomer')} />

                      </SelectTrigger>

                      <SelectContent>

                        {customers.map((customer) => (

                          <SelectItem key={customer} value={customer} className="text-sm">

                            {customer}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>



                  <div>

                    <Label className="text-xs">{t('supplier')}</Label>

                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectSupplier')} />

                      </SelectTrigger>

                      <SelectContent>

                        {suppliers.map((supplier) => (

                          <SelectItem key={supplier} value={supplier} className="text-sm">

                            {supplier}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </div>

                {timeRangePreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Jam Mulai</Label>
                      <Input
                        type="time"
                        value={customTimeStart}
                        onChange={(e) => setCustomTimeStart(e.target.value)}
                        className="text-sm p-2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Jam Akhir</Label>
                      <Input
                        type="time"
                        value={customTimeEnd}
                        onChange={(e) => setCustomTimeEnd(e.target.value)}
                        className="text-sm p-2"
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-md border">

                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead className="bg-muted">

                        <tr>

                          <th className="text-left p-2 text-xs font-medium">{t('date')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('product')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('customer')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('supplier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('cashier')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('quantity')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('total')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('cost')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('profit')}</th>

                        </tr>

                      </thead>

                      <tbody>

                        {filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').map((item) => {

                          const itemTotal = item.itemSubtotal; // Total per item (qty × price)
                          // Use item.cost which already contains baseCost + hpp (Modal Produk + Bahan Baku)
                          const cost = item.cost * item.quantity; // Total cost per item
                          const profit = itemTotal - cost; // Profit per item

                          return (

                            <tr key={item.id} className="border-b hover:bg-muted/50">

                              <td className="p-2 text-sm">{item.date}</td>

                              <td className="p-2 text-sm">{item.product}</td>

                              <td className="p-2 text-sm">{item.customer}</td>

                              <td className="p-2 text-sm">{item.supplier}</td>

                              <td className="p-2 text-sm">{item.cashier}</td>

                              <td className="p-2 text-sm">{item.quantity}</td>

                              <td className="p-2 text-sm">Rp {itemTotal.toLocaleString()}</td>

                              <td className="p-2 text-sm">Rp {cost.toLocaleString()}</td>

                              <td className="p-2 text-sm">Rp {profit.toLocaleString()}</td>

                            </tr>

                          );

                        })}

                        {filteredData.filter(item => !item.hasUnknownProduct).length > 0 && (

                          <tr className="border-b bg-muted font-bold">

                            <td className="p-2 text-sm" colSpan="6">Total</td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => sum + item.itemSubtotal, 0).toLocaleString()}

                            </td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => {
                                // Use item.cost which already contains baseCost + hpp (Modal Produk + Bahan Baku)
                                return sum + (item.cost * item.quantity);
                              }, 0).toLocaleString()}

                            </td>

                            <td className="p-2 text-sm">

                              Rp {filteredData.filter(item => !item.hasUnknownProduct).reduce((sum, item) => {
                                // Use item.cost which already contains baseCost + hpp (Modal Produk + Bahan Baku)
                                return sum + (item.itemSubtotal - (item.cost * item.quantity));
                              }, 0).toLocaleString()}

                            </td>

                          </tr>

                        )}

                      </tbody>

                    </table>

                  </div>

                </div>

                {hppEnabled && canViewHPP && (
                  <Card className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-500 dark:bg-blue-600 text-white rounded-full p-2 mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t('hpp')} (HPP) {t('active')}</h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {t('hppReportInfo') || 'Laporan ini menggunakan HPP (Harga Pokok Penjualan) untuk perhitungan biaya dan profit. HPP termasuk biaya produksi dan biaya kustom per transaksi.'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalRevenue')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').reduce((sum, item) => sum + item.itemSubtotal, 0).toLocaleString()}

                      </p>

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalCost')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').reduce((sum, item) => {
                          // item.cost already contains baseCost + hpp
                          return sum + (item.cost * item.quantity);
                        }, 0).toLocaleString()}

                      </p>
                      
                      {hppEnabled && canViewHPP && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Modal + HPP (Biaya Produksi)
                        </p>
                      )}

                    </CardContent>

                  </Card>

                  <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg text-amber-900 dark:text-amber-100">{t('globalHPP') || 'HPP Global'}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">

                        Rp {globalHPPTotal.toLocaleString()}

                      </p>
                      
                      {globalHPPData.length > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {globalHPPData.length} {t('fixedCosts') || 'biaya tetap'}
                        </p>
                      )}

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('totalProfit')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        Rp {(filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').reduce((sum, item) => {
                          // item.cost already contains baseCost + hpp
                          return sum + (item.itemSubtotal - (item.cost * item.quantity));
                        }, 0) - globalHPPTotal).toLocaleString()}

                      </p>
                      
                      {globalHPPTotal > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('afterDeductingGlobalHPP') || 'Setelah dikurangi HPP Global'}
                        </p>
                      )}

                    </CardContent>

                  </Card>



                  <Card>

                    <CardHeader className="p-4">

                      <CardTitle className="text-lg">{t('profitMargin')}</CardTitle>

                    </CardHeader>

                    <CardContent className="p-4">

                      <p className="text-2xl font-bold">

                        {filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').length > 0 ? 

                          (((filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').reduce((sum, item) => {
                            // item.cost already contains baseCost + hpp
                            return sum + (item.itemSubtotal - (item.cost * item.quantity));
                          }, 0) - globalHPPTotal) / 

                           filteredData.filter(item => !item.hasUnknownProduct && item.payment_status === 'paid').reduce((sum, item) => sum + item.itemSubtotal, 0)) * 100).toFixed(2) : 0}%

                      </p>

                    </CardContent>

                  </Card>

                </div>

                {globalHPPData.length > 0 && (
                  <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border-amber-200 dark:border-amber-800">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">{t('globalHPPBreakdown') || 'Rincian HPP Global (Biaya Tetap)'}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {globalHPPData.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-md border border-amber-100">
                          <div>
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-xs text-amber-700 mt-1">
                              {t('dailyRate') || 'Biaya/Hari'}: Rp {(parseFloat(item.monthly_amount) / 30).toLocaleString('id-ID', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              Rp {parseFloat(item.monthly_amount).toLocaleString('id-ID')}
                            </p>
                            <p className="text-xs text-muted-foreground">/ {t('month') || 'bulan'}</p>
                          </div>
                        </div>
                      ))}
                      <div className="pt-3 border-t-2 border-amber-300">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-900">{t('totalForPeriod') || 'Total Periode Ini'}</p>
                            <p className="text-xs text-muted-foreground">
                              {Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24)) + 1} hari × 
                              Rp {(globalHPPData.reduce((sum, item) => sum + parseFloat(item.monthly_amount || 0), 0) / 30).toLocaleString('id-ID', { 
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}/hari
                            </p>
                          </div>
                          <p className="text-2xl font-bold text-amber-900">
                            Rp {globalHPPTotal.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="h-64">

                  <ResponsiveContainer width="100%" height="100%">

                    <LineChart data={profitLossData}>

                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis dataKey="name" />

                      <YAxis />

                      <Tooltip />

                      <Legend />

                      <Line type="monotone" dataKey="revenue" stroke="#10b981" name={t('revenue')} />

                      <Line type="monotone" dataKey="cost" stroke="#f59e0b" name={t('cost')} />

                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" name={t('profit')} />

                    </LineChart>

                  </ResponsiveContainer>

                </div>

              </CardContent>

            </Card>

          </TabsContent>

          <TabsContent value="stockopname" className="space-y-4">

            <Card>

              <CardHeader className="p-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                  <CardTitle className="text-lg">{t('stockOpname')}</CardTitle>

                  <div className="flex gap-1.5">

                    <Button size="sm" onClick={() => handleExport(Object.values(productsMap), 'stock_opname_report', 'stockopname')} variant="outline" disabled={!permissions.canExportReports}>

                      <Download className="w-4 h-4 mr-2" />

                      {t('export')}

                    </Button>

                  </div>

                </div>

              </CardHeader>

              <CardContent className="p-4 space-y-4">

                {/* Filter options for stock opname tab */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                  <div>

                    <Label className="text-xs">{t('search')}</Label>

                    <div className="relative">

                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

                      <input
                        type="text"
                        placeholder={t('searchProduct')}
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-950 dark:border-gray-700 dark:text-white"
                      />

                    </div>

                  </div>

                  <div>

                    <Label className="text-xs">{t('category')}</Label>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectCategory')} />

                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="all" className="text-sm">{t('allCategories')}</SelectItem>

                        <SelectItem value="product" className="text-sm">{t('finishedProducts')}</SelectItem>

                        <SelectItem value="material" className="text-sm">{t('rawMaterials')}</SelectItem>

                      </SelectContent>

                    </Select>

                  </div>

                  <div>

                    <Label className="text-xs">{t('supplier')}</Label>

                    <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>

                      <SelectTrigger className="text-sm p-2">

                        <SelectValue placeholder={t('selectSupplier')} />

                      </SelectTrigger>

                      <SelectContent>

                        {suppliers.map((supplier) => (

                          <SelectItem key={supplier} value={supplier} className="text-sm">

                            {supplier}

                          </SelectItem>

                        ))}

                      </SelectContent>

                    </Select>

                  </div>

                </div>

              </CardContent>

            </Card>

            {/* Two Column Layout: Finished Products (Left) and Raw Materials (Right) */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Left Column: Finished Products */}

              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('finishedProducts') || 'Produk Jadi'}</CardTitle>

                </CardHeader>

                <CardContent className="p-0">

                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead className="bg-muted">

                        <tr>

                          <th className="text-left p-2 text-xs font-medium">{t('product')}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('supplier')}</th>

                          <th className="text-right p-2 text-xs font-medium">{t('stock')}</th>

                          <th className="text-right p-2 text-xs font-medium">{t('price')}</th>

                          <th className="text-right p-2 text-xs font-medium">{t('cost')}</th>

                        </tr>

                      </thead>

                      <tbody>

                        {Object.values(productsMap)
                          .filter(product => {
                            // Only show finished products (not raw materials)
                            if (product.type === 'rawMaterial') return false;
                            
                            // Filter by search
                            const matchSearch = !searchProduct || 
                              product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                              (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                            
                            // Filter by category
                            const matchCategory = selectedCategory === 'all' || selectedCategory === 'product';
                            
                            // Filter by supplier
                            const matchSupplier = selectedSupplier === t('allSuppliers') || 
                              product.supplier_name === selectedSupplier;
                            
                            return matchSearch && matchCategory && matchSupplier;
                          })
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((product) => (

                            <tr key={product.id} className="border-b hover:bg-muted/50">

                              <td className="p-2 text-sm">
                                <div className="font-medium">{product.name}</div>
                                {product.barcode && (
                                  <div className="text-xs text-muted-foreground">{product.barcode}</div>
                                )}
                              </td>

                              <td className="p-2 text-sm">{product.supplier_name || '-'}</td>

                              <td className="p-2 text-sm text-right font-medium">
                                <span className={product.stock <= (product.min_stock || 0) ? 'text-red-600' : ''}>
                                  {product.stock || 0}
                                </span>
                                {product.stock <= (product.min_stock || 0) && (
                                  <span className="ml-1 text-xs text-red-600">⚠️</span>
                                )}
                              </td>

                              <td className="p-2 text-sm text-right">
                                Rp {(product.price || 0).toLocaleString()}
                              </td>

                              <td className="p-2 text-sm text-right">
                                Rp {(product.cost || 0).toLocaleString()}
                              </td>

                            </tr>

                          ))}

                        {Object.values(productsMap).filter(product => {
                          if (product.type === 'rawMaterial') return false;
                          const matchSearch = !searchProduct || 
                            product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                          const matchCategory = selectedCategory === 'all' || selectedCategory === 'product';
                          const matchSupplier = selectedSupplier === t('allSuppliers') || 
                            product.supplier_name === selectedSupplier;
                          return matchSearch && matchCategory && matchSupplier;
                        }).length === 0 && (

                          <tr>

                            <td colSpan="5" className="p-4 text-center text-sm text-muted-foreground">

                              {t('noProductsFound') || 'Tidak ada produk ditemukan'}

                            </td>

                          </tr>

                        )}

                      </tbody>

                      <tfoot className="bg-muted font-bold">

                        <tr>

                          <td className="p-2 text-sm" colSpan="2">{t('total')}</td>

                          <td className="p-2 text-sm text-right">
                            {Object.values(productsMap)
                              .filter(product => {
                                if (product.type === 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'product';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + (p.stock || 0), 0)}
                          </td>

                          <td className="p-2 text-sm text-right">
                            Rp {Object.values(productsMap)
                              .filter(product => {
                                if (product.type === 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'product';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0).toLocaleString()}
                          </td>

                          <td className="p-2 text-sm text-right">
                            Rp {Object.values(productsMap)
                              .filter(product => {
                                if (product.type === 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'product';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0).toLocaleString()}
                          </td>

                        </tr>

                      </tfoot>

                    </table>

                  </div>

                </CardContent>

              </Card>

              {/* Right Column: Raw Materials */}

              <Card>

                <CardHeader className="p-4">

                  <CardTitle className="text-lg">{t('rawMaterials') || 'Bahan Baku (HPP)'}</CardTitle>

                </CardHeader>

                <CardContent className="p-0">

                  <div className="overflow-x-auto">

                    <table className="w-full">

                      <thead className="bg-muted">

                        <tr>

                          <th className="text-left p-2 text-xs font-medium">{t('rawMaterialName') || 'Bahan Baku'}</th>

                          <th className="text-left p-2 text-xs font-medium">{t('supplier')}</th>

                          <th className="text-right p-2 text-xs font-medium">{t('stock')}</th>

                          <th className="text-right p-2 text-xs font-medium">{t('pricePerUnit') || 'Harga/Unit'}</th>

                          <th className="text-right p-2 text-xs font-medium">HPP</th>

                        </tr>

                      </thead>

                      <tbody>

                        {Object.values(productsMap)
                          .filter(product => {
                            // Only show raw materials
                            if (product.type !== 'rawMaterial') return false;
                            
                            // Filter by search
                            const matchSearch = !searchProduct || 
                              product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                              (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                            
                            // Filter by category
                            const matchCategory = selectedCategory === 'all' || selectedCategory === 'material';
                            
                            // Filter by supplier
                            const matchSupplier = selectedSupplier === t('allSuppliers') || 
                              product.supplier_name === selectedSupplier;
                            
                            return matchSearch && matchCategory && matchSupplier;
                          })
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((product) => (

                            <tr key={product.id} className="border-b hover:bg-muted/50">

                              <td className="p-2 text-sm">
                                <div className="font-medium">{product.name}</div>
                                {product.barcode && (
                                  <div className="text-xs text-muted-foreground">{product.barcode}</div>
                                )}
                                <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 px-2 py-0.5 rounded">
                                  {t('rawMaterial') || 'Bahan Baku'}
                                </span>
                              </td>

                              <td className="p-2 text-sm">{product.supplier_name || '-'}</td>

                              <td className="p-2 text-sm text-right font-medium">
                                <span className={product.stock <= (product.min_stock || 0) ? 'text-red-600' : ''}>
                                  {product.stock || 0}
                                </span>
                                {product.stock <= (product.min_stock || 0) && (
                                  <span className="ml-1 text-xs text-red-600">⚠️</span>
                                )}
                              </td>

                              <td className="p-2 text-sm text-right">
                                Rp {(product.price || 0).toLocaleString()}
                              </td>

                              <td className="p-2 text-sm text-right">
                                Rp {(product.hpp || 0).toLocaleString()}
                              </td>

                            </tr>

                          ))}

                        {Object.values(productsMap).filter(product => {
                          if (product.type !== 'rawMaterial') return false;
                          const matchSearch = !searchProduct || 
                            product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                            (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                          const matchCategory = selectedCategory === 'all' || selectedCategory === 'material';
                          const matchSupplier = selectedSupplier === t('allSuppliers') || 
                            product.supplier_name === selectedSupplier;
                          return matchSearch && matchCategory && matchSupplier;
                        }).length === 0 && (

                          <tr>

                            <td colSpan="5" className="p-4 text-center text-sm text-muted-foreground">

                              {t('noProductsFound') || 'Tidak ada bahan baku ditemukan'}

                            </td>

                          </tr>

                        )}

                      </tbody>

                      <tfoot className="bg-muted font-bold">

                        <tr>

                          <td className="p-2 text-sm" colSpan="2">{t('total')}</td>

                          <td className="p-2 text-sm text-right">
                            {Object.values(productsMap)
                              .filter(product => {
                                if (product.type !== 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'material';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + (p.stock || 0), 0)}
                          </td>

                          <td className="p-2 text-sm text-right">
                            Rp {Object.values(productsMap)
                              .filter(product => {
                                if (product.type !== 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'material';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0).toLocaleString()}
                          </td>

                          <td className="p-2 text-sm text-right">
                            Rp {Object.values(productsMap)
                              .filter(product => {
                                if (product.type !== 'rawMaterial') return false;
                                const matchSearch = !searchProduct || 
                                  product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                                  (product.barcode && product.barcode.toLowerCase().includes(searchProduct.toLowerCase()));
                                const matchCategory = selectedCategory === 'all' || selectedCategory === 'material';
                                const matchSupplier = selectedSupplier === t('allSuppliers') || 
                                  product.supplier_name === selectedSupplier;
                                return matchSearch && matchCategory && matchSupplier;
                              })
                              .reduce((sum, p) => sum + ((p.hpp || p.cost || 0) * (p.stock || 0)), 0).toLocaleString()}
                          </td>

                        </tr>

                      </tfoot>

                    </table>

                  </div>

                </CardContent>

              </Card>

            </div>

            {/* Summary Cards Below */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              
              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 col-span-2">
                <p className="text-xs text-muted-foreground">{t('totalProducts')}</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {Object.values(productsMap).filter(p => p.type !== 'rawMaterial').length}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700">
                <p className="text-xs text-muted-foreground">{t('totalRawMaterials')}</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {Object.values(productsMap).filter(p => p.type === 'rawMaterial').length}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 col-span-2">
                <p className="text-xs text-muted-foreground">{t('totalStockValue')}</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                  Rp {Object.values(productsMap).reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 col-span-2">
                <p className="text-xs text-muted-foreground">{t('totalStockCost')}</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                  Rp {Object.values(productsMap).reduce((sum, p) => sum + (((p.cost || 0) + (p.hpp || 0)) * (p.stock || 0)), 0).toLocaleString()}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 col-span-2">
                <p className="text-xs text-muted-foreground">{t('potentialProfit')}</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                  Rp {(Object.values(productsMap).reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0) - 
                       Object.values(productsMap).reduce((sum, p) => sum + (((p.cost || 0) + (p.hpp || 0)) * (p.stock || 0)), 0)).toLocaleString()}
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700 col-span-2">
                <p className="text-xs text-muted-foreground">{t('lowStockProducts')}</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                  {Object.values(productsMap).filter(p => p.stock <= (p.min_stock || 0)).length}
                </p>
              </div>

            </div>

          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="text-lg">
                    {t('financialReport')}
                  </CardTitle>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={applyFilters} variant="outline">
                      <Search className="w-4 h-4 mr-2" />
                      {t('applyFilters')}
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleExport(financialData, 'laporan_keuangan', 'financial')} 
                      variant="outline" 
                      disabled={!permissions.canExportReports}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t('export')}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Date Range Filter */}
                  <div>
                    <Label className="text-xs">{t('dateRange')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                              </>
                            ) : (
                              format(dateRange.from, "dd MMM yyyy")
                            )
                          ) : (
                            <span>{t('pickDateRange')}</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Payment Status Filter */}
                  <div>
                    <Label className="text-xs">{t('paymentStatus') || 'Status Pembayaran'}</Label>
                    <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue placeholder={t('all') || 'Semua'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('all') || 'Semua'}</SelectItem>
                        <SelectItem value="cash">{t('cash')}</SelectItem>
                        <SelectItem value="credit">{t('credit')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Financial Report Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                  {/* 1. PENDAPATAN */}
                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
                    <CardHeader className="p-4">
                      <CardTitle className="text-md text-green-900 dark:text-green-100">
                        {t('revenue')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Penjualan Tunai (Lunas)</span>
                        <span className="font-semibold text-green-800 dark:text-green-200">
                          Rp {financialData.revenue.cashSales.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Penjualan Kredit (Lunas)</span>
                        <span className="font-semibold text-green-800 dark:text-green-200">
                          Rp {financialData.revenue.creditPaidSales.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t border-green-300 dark:border-green-700 my-2"></div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">Total Penjualan Kotor</span>
                        <span className="font-bold text-green-900 dark:text-green-100">
                          Rp {financialData.revenue.grossSales.toLocaleString()}
                        </span>
                      </div>
                      {financialData.revenue.stockReturns > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">Retur (Kembalikan Stok)</span>
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            -Rp {financialData.revenue.stockReturns.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Diskon yang Diberikan</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          -Rp {financialData.revenue.totalDiscount.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t-2 border-green-400 dark:border-green-600 my-2"></div>
                      <div className="flex justify-between">
                        <span className="font-bold text-green-900 dark:text-green-100">Total Pendapatan Bersih</span>
                        <span className="font-bold text-lg text-green-900 dark:text-green-100">
                          Rp {financialData.revenue.netRevenue.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 2. BEBAN */}
                  <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-red-200 dark:border-red-800">
                    <CardHeader className="p-4">
                      <CardTitle className="text-md text-red-900 dark:text-red-100">
                        {t('expenses')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <div className="space-y-1 mb-3">
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          Harga Pokok Penjualan (HPP):
                        </div>
                        <div className="flex justify-between text-sm pl-4">
                          <span className="text-gray-700 dark:text-gray-300">Total HPP Produk</span>
                          <span className="font-semibold text-red-700 dark:text-red-300">
                            Rp {financialData.expenses.cogs.toLocaleString()}
                          </span>
                        </div>
                        {financialData.expenses.lossReturns > 0 && (
                          <div className="flex justify-between text-sm pl-4">
                            <span className="text-gray-700 dark:text-gray-300">Retur Rugi (Tidak Kembali)</span>
                            <span className="font-semibold text-red-700 dark:text-red-300">
                              Rp {financialData.expenses.lossReturns.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {hppEnabled && canViewHPP && globalHPPData.length > 0 && (
                        <div className="space-y-1 mb-3">
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                            Biaya Tetap (Global HPP):
                          </div>
                          {financialData.expenses.globalHPPBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs pl-4">
                              <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                              <span className="font-medium text-red-600 dark:text-red-400">
                                Rp {item.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm pl-4 pt-1 border-t border-red-200 dark:border-red-700">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">Total Biaya Tetap</span>
                            <span className="font-semibold text-red-700 dark:text-red-300">
                              Rp {financialData.expenses.globalHPP.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="border-t-2 border-red-400 dark:border-red-600 my-2"></div>
                      <div className="flex justify-between">
                        <span className="font-bold text-red-900 dark:text-red-100">TOTAL BEBAN</span>
                        <span className="font-bold text-lg text-red-900 dark:text-red-100">
                          Rp {financialData.expenses.total.toLocaleString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 3. LABA/RUGI */}
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800">
                    <CardHeader className="p-4">
                      <CardTitle className="text-md text-blue-900 dark:text-blue-100">
                        {t('profitLoss')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Pendapatan Bersih</span>
                        <span className="font-semibold text-blue-800 dark:text-blue-200">
                          Rp {financialData.profitLoss.netRevenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">HPP</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          -Rp {financialData.profitLoss.cogs.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t border-blue-300 dark:border-blue-700 my-2"></div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-blue-800 dark:text-blue-200">Laba Kotor</span>
                        <span className="font-bold text-blue-900 dark:text-blue-100">
                          Rp {financialData.profitLoss.grossProfit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Margin Laba Kotor</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          {financialData.profitLoss.grossMargin.toFixed(2)}%
                        </span>
                      </div>

                      {hppEnabled && canViewHPP && (
                        <>
                          <div className="border-t border-blue-200 dark:border-blue-700 my-2"></div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Biaya Tetap</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              -Rp {financialData.profitLoss.fixedCosts.toLocaleString()}
                            </span>
                          </div>
                          {financialData.profitLoss.lossReturns > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">Retur Rugi</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                -Rp {financialData.profitLoss.lossReturns.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      <div className="border-t-2 border-blue-400 dark:border-blue-600 my-2"></div>
                      <div className="flex justify-between">
                        <span className="font-bold text-blue-900 dark:text-blue-100">LABA BERSIH</span>
                        <span className={`font-bold text-lg ${
                          financialData.profitLoss.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          Rp {financialData.profitLoss.netProfit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Margin Laba Bersih</span>
                        <span className={`font-semibold ${
                          financialData.profitLoss.netMargin >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                        }`}>
                          {financialData.profitLoss.netMargin.toFixed(2)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 4. ARUS KAS & PIUTANG */}
                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-purple-200 dark:border-purple-800">
                    <CardHeader className="p-4">
                      <CardTitle className="text-md text-purple-900 dark:text-purple-100">
                        {t('cashFlowAndReceivables')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {/* Arus Kas */}
                      <div>
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">Arus Kas:</div>
                        <div className="space-y-1 pl-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Penjualan Tunai</span>
                            <span className="font-semibold text-purple-700 dark:text-purple-300">
                              Rp {financialData.cashFlow.cashSales.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Pelunasan Kredit</span>
                            <span className="font-semibold text-purple-700 dark:text-purple-300">
                              Rp {financialData.cashFlow.creditCollections.toLocaleString()}
                            </span>
                          </div>
                          <div className="border-t border-purple-300 dark:border-purple-700 mt-1 pt-1"></div>
                          <div className="flex justify-between">
                            <span className="font-bold text-purple-900 dark:text-purple-100">Total Kas Masuk</span>
                            <span className="font-bold text-purple-900 dark:text-purple-100">
                              Rp {financialData.cashFlow.totalCashInflow.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-2 border-purple-300 dark:border-purple-700 my-3"></div>

                      {/* Piutang */}
                      <div>
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">Piutang:</div>
                        <div className="space-y-1 pl-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700 dark:text-gray-300">Penjualan Kredit Belum Lunas</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">
                              Rp {financialData.receivables.unpaidAmount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-400">Jumlah Transaksi</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-400">
                              {financialData.receivables.unpaidCount} transaksi
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 5. RINGKASAN TRANSAKSI */}
                  <Card className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/50 dark:to-slate-950/50 border-gray-300 dark:border-gray-700">
                    <CardHeader className="p-4">
                      <CardTitle className="text-md text-gray-900 dark:text-gray-100">
                        {t('transactionSummary')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {financialData.summary.totalTransactions}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Transaksi</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {financialData.summary.cashTransactions}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Transaksi Tunai</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {financialData.summary.creditPaidTransactions}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Kredit Lunas</div>
                        </div>
                        <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {financialData.summary.creditUnpaidTransactions}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Kredit Belum Lunas</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Total Item Terjual</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {financialData.summary.totalItemsSold} pcs
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Rata-rata Nilai Transaksi</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Rp {Math.round(financialData.summary.avgTransactionValue).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        

        {/* Print Preview Dialog */}

        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">

            <DialogHeader>

              <DialogTitle>{t('receiptPreviewTitle')}</DialogTitle>

            </DialogHeader>

            

            {/* Unified receipt type selector */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="receiptType">{t('receiptType') || 'Jenis Struk'}</Label>
                <Select value={receiptType} onValueChange={setReceiptType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('selectReceiptType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledReceiptTypes['58mm'] && <SelectItem value="thermal-58mm">{t('thermal58mm')}</SelectItem>}
                    {enabledReceiptTypes['80mm'] && <SelectItem value="thermal-80mm">{t('thermal80mm')}</SelectItem>}
                    {enabledReceiptTypes['A4'] && <SelectItem value="invoice-a4">{t('invoiceA4')}</SelectItem>}
                    {enabledReceiptTypes['delivery-note'] && <SelectItem value="delivery-note">{t('deliveryNote')}</SelectItem>}
                  </SelectContent>
                </Select>
            </div>

            

              {/* Decimal places toggle - applies to all types */}
              <div className="flex items-center justify-between">
                <Label htmlFor="useTwoDecimals">{t('useTwoDecimals')}</Label>

                <Switch

                  id="useTwoDecimals"

                  checked={useTwoDecimals}

                  onCheckedChange={setUseTwoDecimals}

                />

              </div>

              {/* Barcode toggle - only for thermal receipts */}
              {receiptType.startsWith('thermal-') && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="showBarcodeReports">{t('showBarcode') || 'Tampilkan Barcode'}</Label>
                  <Switch
                    id="showBarcodeReports"
                    checked={showBarcode}
                    onCheckedChange={setShowBarcode}
                  />
                </div>
              )}

              {/* Delivery Note Options */}
              {receiptType === 'delivery-note' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deliveryNoteShowPrice">{t('showPrice') || 'Tampilkan Harga'}</Label>
                    <Switch
                      id="deliveryNoteShowPrice"
                      checked={deliveryNoteShowPrice}
                      onCheckedChange={setDeliveryNoteShowPrice}
                    />
                  </div>
                  <div>
                    <Label htmlFor="receiverNameReports">{t('receiverName')}</Label>
                    <Input
                      id="receiverNameReports"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder={t('receiverNamePlaceholder')}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="senderNameReports">{t('senderName')}</Label>
                    <Input
                      id="senderNameReports"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder={t('senderNamePlaceholder')}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

            </div>
            
            {/* Unified preview box */}
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              {selectedSaleForPrint && (
                <>
                  {/* Print button at the top for Invoice A4 and Delivery Note */}
                  {(receiptType === 'invoice-a4' || receiptType === 'delivery-note') && (
                    <div className="bg-white border-b p-3 flex justify-between items-center">
                      <h3 className="font-semibold text-sm">
                        {receiptType === 'invoice-a4' ? t('invoicePreview') || 'Invoice Preview' : t('deliveryNotePreview') || 'Preview Surat Jalan'}
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

                  <div className="p-4 max-h-[50vh] overflow-auto">
                    <div ref={printRef}>
                      {receiptType === 'invoice-a4' ? (
                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          <div className="printable-invoice-area">
                            <InvoiceA4 
                              sale={transformSaleForA4(selectedSaleForPrint)} 
                              companyInfo={{...companyInfo, ...receiptSettingsA4}} 
                              useTwoDecimals={useTwoDecimals}
                              context="reports"
                              userId={user?.id || user?.tenantId}
                            />
                          </div>
                        </div>
                      ) : receiptType === 'delivery-note' ? (
                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          <div className="printable-invoice-area">
                            <DeliveryNote
                              sale={transformSaleForA4(selectedSaleForPrint)}
                              companyInfo={{...companyInfo, ...receiptSettingsDeliveryNote}}
                              showPrice={deliveryNoteShowPrice}
                              receiverName={receiverName}
                              senderName={senderName}
                              context="reports"
                              userId={user?.id || user?.tenantId}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="receipt-printable">
                          <ReceiptContent 
                            {...transformSaleForThermal(selectedSaleForPrint)}
                            settings={companyInfo}
                            paperSize={receiptType.replace('thermal-', '')}
                            useTwoDecimals={useTwoDecimals}
                            showBarcode={showBarcode}
                            t={t}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Print button for thermal receipts only (A4 and Delivery Note have button at top) */}
            {receiptType !== 'invoice-a4' && receiptType !== 'delivery-note' && (
              <Button onClick={handlePrint} className="w-full mt-4">
                <Printer className="w-4 h-4 mr-2" />
                {t('print')}
              </Button>
            )}
          </DialogContent>

        </Dialog>

        {/* Transaction Action Dialog */}
        <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('transactionActions') || 'Aksi Transaksi'}</DialogTitle>
            </DialogHeader>

            {selectedTransactionForAction && (
              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="p-4 bg-muted rounded-md space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('total')}:</span>
                    <span className="font-semibold">Rp {selectedTransactionForAction.total.toLocaleString()}</span>
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
                        : item.payment_status === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTransactionForAction.payment_status === 'paid' 
                        ? (t('paid') || 'Lunas')
                        : item.payment_status === 'partial'
                        ? (t('partial') || 'Sebagian')
                        : (t('unpaid') || 'Belum Lunas')}
                    </span>
                  </div>
                </div>

                {/* Actions based on payment status */}
                {selectedTransactionForAction.payment_status === 'unpaid' ? (
                  // Actions for UNPAID transactions
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="paymentAmount">{t('paymentAmount') || 'Jumlah Pembayaran'}</Label>
                      <Input 
                        id="paymentAmount" 
                        type="number" 
                        placeholder={`Min: Rp ${selectedTransactionForAction.total.toLocaleString()}`}
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
                      {t('markAsPaid') || 'Tandai Lunas'}
                    </Button>
                    <Button 
                      onClick={handleDeleteTransaction} 
                      variant="destructive" 
                      className="w-full"
                    >
                      {t('delete') || 'Hapus'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleInitiateReturn}
                    >
                      {t('return') || 'Retur'}
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
                      {t('changeToCredit') || 'Ubah ke Kredit'}
                    </Button>
                    <Button 
                      onClick={handleDeleteTransaction} 
                      variant="destructive" 
                      className="w-full"
                    >
                      {t('delete') || 'Hapus'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleInitiateReturn}
                    >
                      {t('return') || 'Retur'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Return Dialog */}
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('returnTransaction') || 'Retur Transaksi'}</DialogTitle>
            </DialogHeader>

            {selectedTransactionForAction && (
              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="p-4 bg-muted rounded-md">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Transaksi:</span>
                    <span className="font-semibold">#{selectedTransactionForAction.saleId.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Pelanggan:</span>
                    <span>{selectedTransactionForAction.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <span className="font-bold">Rp {selectedTransactionForAction.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Return Type Selection */}
                <div>
                  <Label>{t('returnType') || 'Jenis Retur'}</Label>
                  <Select value={returnType} onValueChange={setReturnType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">
                        <div className="flex flex-col">
                          <span className="font-semibold">{t('returnToStock')}</span>
                          <span className="text-xs text-muted-foreground">
                            {t('productReturnedToInventory')}
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="loss">
                        <div className="flex flex-col">
                          <span className="font-semibold">{t('recordAsLoss')}</span>
                          <span className="text-xs text-muted-foreground">
                            {t('stockWillNotBeReturned')}
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Return Reason */}
                <div>
                  <Label htmlFor="returnReason">{t('reason') || 'Alasan'}</Label>
                  <Input
                    id="returnReason"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Alasan retur (opsional)"
                    className="mt-1"
                  />
                </div>

                {/* Items Selection */}
                <div>
                  <Label className="mb-2 block">{t('selectItemsToReturn')}</Label>
                  <div className="border rounded-md max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Produk</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Harga</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returningItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{item.product_name}</td>
                            <td className="p-2 text-center">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={item.returnQuantity}
                                onChange={(e) => {
                                  const newItems = [...returningItems];
                                  newItems[index].returnQuantity = Math.min(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                    item.quantity
                                  );
                                  setReturningItems(newItems);
                                }}
                                className="w-16 text-center"
                              />
                            </td>
                            <td className="p-2 text-right">
                              Rp {item.price.toLocaleString()}
                            </td>
                            <td className="p-2 text-right font-semibold">
                              Rp {(item.price * item.returnQuantity).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total Return Amount */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-900 dark:text-blue-100">Total Retur:</span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      Rp {returningItems.reduce((sum, item) => 
                        sum + (item.price * item.returnQuantity), 0
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleProcessReturn}
                    className="flex-1"
                    variant="default"
                  >
                    {returnType === 'stock' ? t('processReturnAndRestoreStock') : t('processReturnAsLoss')}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowReturnDialog(false);
                      setReturningItems([]);
                      setReturnReason('');
                      setReturnType('stock');
                    }}
                    variant="outline"
                  >
                    Batal
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>

    </>

  );

};



export default ReportsPage;
