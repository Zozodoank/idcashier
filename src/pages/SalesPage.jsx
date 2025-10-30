import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
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
import { ScanBarcode, Package, List, LayoutGrid, Ticket, DollarSign, Percent, Printer, Search, Download, Trash2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { salesAPI, productsAPI, customersAPI, settingsAPI, productRecipesAPI, rawMaterialsAPI } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import InvoiceA4 from '@/components/InvoiceA4';
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
  const [cart, setCart] = useState([]);
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
  const [hppEnabled, setHppEnabled] = useState(false);
  
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
  const printRef = useRef();
  
  const searchInputRef = useRef(null);

  // Dynamic CSS injection - map receiptType ke printType
  const getPrintType = () => {
    if (!completedSaleData) return null;
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
      items: transformedItems
    };
    
    return sale;
  };
  
  // Get transformed sale data
  const transformedSale = transformToSaleFormat(completedSaleData);
  
  // useReactToPrint hook for A4 invoice
  const handlePrintInvoiceA4 = useReactToPrint({
    content: () => invoiceA4Ref.current,
    documentTitle: `invoice-idcashier-${new Date().getTime()}`,
    onBeforeGetContent: () => {
      // Delay untuk memastikan CSS ter-inject sempurna
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    }
  });

  // useReactToPrint hook for Delivery Note
  const handlePrintDeliveryNote = useReactToPrint({
    content: () => deliveryNoteRef.current,
    documentTitle: `Surat_Jalan_${new Date().getTime()}`,
    pageStyle: `@page { size: A4; margin: 0; }`,
    onBeforeGetContent: () => {
      // Delay untuk memastikan CSS ter-inject sempurna
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    }
  });

  // useReactToPrint hook for Thermal Receipt
  const handlePrintThermalReceipt = useReactToPrint({
    content: () => thermalReceiptRef.current,
    documentTitle: `receipt-idcashier-${new Date().getTime()}`,
  });

  // Unified print handler
  const handlePrint = () => {
    if (receiptType === 'invoice-a4') {
      handlePrintInvoiceA4();
    } else if (receiptType === 'delivery-note') {
      handlePrintDeliveryNote();
    } else {
      handlePrintThermalReceipt();
    }
  };

  useEffect(() => {
    fetchData();
    loadHPPSetting();
  }, [authUser]);

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

  const loadHPPSetting = async () => {
    if (!authUser || !token) return;
    
    try {
      const data = await settingsAPI.get('hpp_enabled', token);
      setHppEnabled(data?.setting_value?.enabled || false);
    } catch (error) {
      console.error('Error loading HPP setting:', error);
      // Default to false if setting doesn't exist
      setHppEnabled(false);
    }
  };

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
      
      setReceiptSettings(mergedSettings);
      
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
      
      // Load currency settings
      const currency = getCurrencyFromStorage(ownerId);
      setCurrencyCode(currency);
      
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: t('error'), description: `Failed to load data: ${error.message}`, variant: "destructive" });
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
            product: t('noItems') || 'No Items',
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
          productsList.add(item.product_name || 'Unknown');
          customersList.add(sale.customer?.name || t('defaultCustomer'));
          
          flattenedData.push({
            id: sale.id + '-' + item.id,
            saleId: sale.id,
            date: new Date(sale.created_at).toLocaleDateString('id-ID'),
            created_at: sale.created_at,
            product: item.product_name || 'Unknown',
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
      toast({ title: t('error'), description: `Failed to load transactions: ${error.message}`, variant: 'destructive' });
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
      
      // Update customers list with the new customer, maintaining the default customer at the beginning
      const defaultCustomer = { id: 'default', name: t('defaultCustomer'), phone: '' };
      const updatedCustomers = [defaultCustomer, ...customers.filter(c => c.id !== 'default'), data];
      
      setCustomers(updatedCustomers);
      toast({ title: t('success'), description: t('customerAdded') });
      setNewCustomer({ name: '', phone: '' });
      setSelectedCustomer(data.id);
      setIsCustomerDialogOpen(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({ title: t('error'), description: `Failed to add customer: ${error.message}`, variant: "destructive" });
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
        throw new Error(`Stok tidak mencukupi untuk ${item.name}. Tersedia: ${product.stock || 0}, Diminta: ${item.quantity}`);
      }
    }
    
    // 2. Check raw material stock for products with recipes
    for (const item of cart) {
      try {
        // Get recipe for this product
        const recipes = await productRecipesAPI.getByProduct(item.id, token);
        
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
              const materialName = recipe.raw_materials?.name || 'Bahan Baku';
              const unit = recipe.raw_materials?.unit || '';
              throw new Error(
                `Stok bahan baku tidak mencukupi untuk ${item.name}.\n` +
                `${materialName}: Butuh ${totalQuantityNeeded.toFixed(3)} ${unit}, ` +
                `Tersedia ${currentStock.toFixed(3)} ${unit}`
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
    // Prevent double submission
    if (isProcessingPayment) {
      return;
    }
    
    if (cart.length === 0) {
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
      setIsProcessingPayment(true);
      
      // Validate stock levels before proceeding
      await validateStockLevels();
      
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
      
      // Create sale using the updated API
      const result = await salesAPI.create(saleData, token);
      
      // Deduct raw materials stock for each product in cart
      try {
        for (const cartItem of cart) {
          // Get recipe for this product
          const recipes = await productRecipesAPI.getByProduct(cartItem.id, token);
          
          // Deduct each raw material in the recipe
          if (recipes && recipes.length > 0) {
            for (const recipe of recipes) {
              // Calculate total quantity needed: recipe quantity × cart quantity
              const totalQuantityNeeded = parseFloat(recipe.quantity) * cartItem.quantity;
              
              // Deduct stock
              await rawMaterialsAPI.deductStock(
                recipe.raw_material_id, 
                totalQuantityNeeded, 
                token
              );
            }
          }
        }
      } catch (stockError) {
        console.warn('Warning: Could not deduct raw material stock:', stockError);
        // Don't fail the sale if raw material deduction fails (non-critical)
        // Just log the warning
      }
      
      // Track profit shares if HPP enabled and sale was successful
      if (hppEnabled && result?.id) {
        try {
          const currentEmployeeId = authUser.id; // kasir yang melakukan transaksi
          
          for (const item of cart) {
            // Check for employee-specific profit share first
            const { data: employeeShare } = await supabase
              .from('employee_product_shares')
              .select('share_type, share_value')
              .eq('employee_id', currentEmployeeId)
              .eq('product_id', item.id)
              .single();

            let shareConfig = null;

            if (employeeShare) {
              // Use employee-specific share (prioritized)
              shareConfig = {
                enabled: true,
                type: employeeShare.share_type,
                value: employeeShare.share_value
              };
            } else if (item.profit_share_enabled) {
              // Fallback to product default share
              shareConfig = {
                enabled: true,
                type: item.profit_share_type,
                value: item.profit_share_value
              };
            }

            // Calculate and save profit share if configured
            if (shareConfig && shareConfig.enabled) {
              let shareAmount = 0;
              
              if (shareConfig.type === 'percentage') {
                // Percentage: calculate from selling price
                shareAmount = (item.price * item.quantity * shareConfig.value) / 100;
              } else if (shareConfig.type === 'fixed') {
                // Fixed amount: multiply by quantity
                shareAmount = shareConfig.value * item.quantity;
              }
              
              // Save profit share to database
              if (shareAmount > 0) {
                const { error: profitShareError } = await supabase
                  .from('profit_shares')
                  .insert({
                    sale_id: result.id,
                    employee_id: currentEmployeeId,
                    product_id: item.id,
                    quantity: item.quantity,
                    share_amount: shareAmount
                  });
                
                if (profitShareError) {
                  console.error('Error saving profit share:', profitShareError);
                  // Don't fail the transaction if profit share tracking fails
                }
              }
            }
          }
        } catch (profitShareError) {
          console.error('Error tracking profit shares:', profitShareError);
          // Don't fail the sale if profit share tracking fails (non-critical)
        }
      }
      
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
      
      // Show success confirmation
      toast({ 
        title: t('success'), 
        description: t('transactionSaved'), 
        variant: "success" 
      });
      
      // Refresh products to show updated stock
      fetchData();
      
      // Refresh transactions data if on history tab
      if (activeTab === 'history') {
        loadTransactionsData();
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      
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
      setIsProcessingPayment(false);
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
  
  // Apply filters for transaction history
  const applyTransactionFilters = () => {
    let data = allSalesData;

    if (dateRange.from && dateRange.to) {
      data = data.filter(item => new Date(item.date) >= dateRange.from && new Date(item.date) <= dateRange.to);
    }

    // Time range filter
    const TIME_PRESETS = {
      morning: { start: '06:00', end: '12:00' },
      afternoon: { start: '12:00', end: '18:00' },
      night: { start: '18:00', end: '24:00' }
    };

    if (timeRangePreset !== 'all') {
      const startTime = timeRangePreset === 'custom' ? customTimeStart : TIME_PRESETS[timeRangePreset].start;
      const endTime = timeRangePreset === 'custom' ? customTimeEnd : TIME_PRESETS[timeRangePreset].end;
      
      data = data.filter(item => {
        const itemDateTime = new Date(item.created_at || item.date);
        const itemTime = itemDateTime.toTimeString().slice(0, 5);
        return itemTime >= startTime && itemTime <= endTime;
      });
    }

    if (selectedProductFilter !== t('allProducts')) data = data.filter(item => item.product === selectedProductFilter);
    if (selectedCustomerFilter !== t('allCustomers')) data = data.filter(item => item.customer === selectedCustomerFilter);
    if (selectedSupplierFilter !== t('allSuppliers')) data = data.filter(item => item.supplier === selectedSupplierFilter);
    if (selectedPaymentMethodFilter !== 'all') data = data.filter(item => item.payment_method === selectedPaymentMethodFilter);

    setFilteredTransactions(data);
    toast({ title: t('filterApplied'), description: t('reportUpdated') });
  };

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
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      
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

  // Change transaction to credit
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
      
      await fetchData();
      await loadTransactionsData(); // Refresh transactions list
      
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

  // Print invoice for transaction
  const handlePrintTransaction = async (item) => {
    try {
      const saleData = await salesAPI.getById(item.saleId, token);
      setSelectedSaleForPrint(saleData);
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

  // Handle print with react-to-print
  const handlePrintForTransaction = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${receiptType === 'delivery-note' ? 'delivery-note' : 'receipt'}-${selectedSaleForPrint?.id || 'preview'}`,
    onAfterPrint: () => {
      console.log('Print completed');
    }
  });

  // Export transactions (placeholder - needs implementation from ReportsPage)
  const handleExportTransactions = () => {
    toast({ title: 'Export', description: 'Export functionality akan ditambahkan' });
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
                <Label htmlFor="paymentMethod" className="w-32">{t('paymentMethod') || 'Metode Bayar'}</Label>
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
                    <SelectItem value="cash">{t('cash') || 'Tunai'}</SelectItem>
                    <SelectItem value="credit">{t('credit') || 'Kredit'}</SelectItem>
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
              <Dialog onOpenChange={(open) => {
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
                <DialogTrigger asChild>
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
                </DialogTrigger>
                <DialogContent className="max-w-3xl" aria-describedby="receipt-dialog-description">
                  <DialogHeader>
                    <DialogTitle>{t('receiptPreviewTitle')}</DialogTitle>
                  </DialogHeader>
                  
                  {/* Unified receipt type selector */}
                  <div className="space-y-4 mb-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="receiptTypeSales">{t('receiptType') || 'Jenis Struk'}</Label>
                      <Select value={receiptType} onValueChange={setReceiptType}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder={t('selectReceiptType')} />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledReceiptTypes['58mm'] && <SelectItem value="thermal-58mm">{t('thermal58mm') || '58mm Thermal'}</SelectItem>}
                          {enabledReceiptTypes['80mm'] && <SelectItem value="thermal-80mm">{t('thermal80mm') || '80mm Thermal'}</SelectItem>}
                          {enabledReceiptTypes['A4'] && <SelectItem value="invoice-a4">{t('invoiceA4')}</SelectItem>}
                          {enabledReceiptTypes['delivery-note'] && <SelectItem value="delivery-note">{t('deliveryNote') || 'Surat Jalan'}</SelectItem>}
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
                        <Label htmlFor="showBarcodeSales">{t('showBarcode') || 'Tampilkan Barcode'}</Label>
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
                          <Label htmlFor="deliveryNoteShowPriceSales">{t('showPrice') || 'Tampilkan Harga'}</Label>
                          <Switch
                            id="deliveryNoteShowPriceSales"
                            checked={deliveryNoteShowPrice}
                            onCheckedChange={setDeliveryNoteShowPrice}
                          />
                        </div>
                        <div>
                          <Label htmlFor="receiverNameSales">{t('receiverName') || 'Nama Penerima'}</Label>
                          <Input
                            id="receiverNameSales"
                            value={receiverName}
                            onChange={(e) => setReceiverName(e.target.value)}
                            placeholder="Nama penerima barang"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="senderNameSales">{t('senderName') || 'Nama Pengirim'}</Label>
                          <Input
                            id="senderNameSales"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            placeholder="Nama pengirim/perusahaan"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Unified preview box */}
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
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
                      {receiptType === 'invoice-a4' ? (
                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          <div className="printable-invoice-area">
                            {transformedSale && (
                              <InvoiceA4 
                                sale={transformedSale} 
                                companyInfo={{...receiptSettings, ...receiptSettingsA4}} 
                                useTwoDecimals={useTwoDecimals}
                                context="sales"
                                userId={authUser?.id || authUser?.tenantId}
                              />
                            )}
                          </div>
                        </div>
                      ) : receiptType === 'delivery-note' ? (
                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          <div className="printable-invoice-area">
                            {transformedSale && (
                              <DeliveryNote
                                sale={transformedSale}
                                companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
                                showPrice={deliveryNoteShowPrice}
                                receiverName={receiverName}
                                senderName={senderName}
                                context="sales"
                                userId={authUser?.id || authUser?.tenantId}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                      <div className="receipt-printable">
                          <ReceiptContent 
                            cart={completedSaleData?.cart || cart} 
                            subtotal={completedSaleData?.subtotal || subtotal} 
                            discountAmount={completedSaleData?.discountAmount || discountAmount} 
                            taxAmount={completedSaleData?.taxAmount || taxAmount} 
                            total={completedSaleData?.total || total} 
                            paymentAmount={completedSaleData?.paymentAmount || paymentAmount} 
                            change={completedSaleData?.change || change} 
                            customer={completedSaleData?.customer || customerForReceipt} 
                            settings={receiptSettings} 
                            paperSize={receiptType.replace('thermal-', '')}
                            useTwoDecimals={useTwoDecimals}
                            showBarcode={showBarcode}
                            t={t}
                          />
                        </div>
                      )}
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
                  
                  {/* Hidden invoice for printing */}
                  <div style={{ display: 'none' }}>
                    {transformedSale && (
                      <InvoiceA4 
                        ref={invoiceA4Ref} 
                        sale={transformedSale} 
                        companyInfo={{...receiptSettings, ...receiptSettingsA4}} 
                        useTwoDecimals={useTwoDecimals}
                        userId={authUser?.id || authUser?.tenantId}
                      />
                    )}
                  </div>
                  
                  {/* Hidden delivery note for printing */}
                  <div style={{ display: 'none' }}>
                    {transformedSale && (
                      <DeliveryNote
                        ref={deliveryNoteRef}
                        sale={transformedSale}
                        companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
                        showPrice={deliveryNoteShowPrice}
                        receiverName={receiverName}
                        senderName={senderName}
                        userId={authUser?.id || authUser?.tenantId}
                      />
                    )}
                  </div>
                  
                  {/* Hidden thermal receipt for printing */}
                  <div style={{ display: 'none' }}>
                    <div ref={thermalReceiptRef}>
                      <ReceiptContent 
                        cart={completedSaleData?.cart || cart} 
                        subtotal={completedSaleData?.subtotal || subtotal} 
                        discountAmount={completedSaleData?.discountAmount || discountAmount} 
                        taxAmount={completedSaleData?.taxAmount || taxAmount} 
                        total={completedSaleData?.total || total} 
                        paymentAmount={completedSaleData?.paymentAmount || paymentAmount} 
                        change={completedSaleData?.change || change} 
                        customer={completedSaleData?.customer || customerForReceipt} 
                        settings={receiptSettings} 
                        paperSize={receiptType.replace('thermal-', '')}
                        useTwoDecimals={useTwoDecimals}
                        showBarcode={showBarcode}
                        t={t}
                      />
                    </div>
                  </div>
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
                  <Button size="sm" onClick={applyTransactionFilters} variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    {t('applyFilters')}
                  </Button>
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
            </CardContent>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-muted">
                      <tr>
                        <th className="w-12 p-2">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.size > 0 && selectedTransactions.size === new Set(filteredTransactions.map(item => item.saleId)).size}
                            onChange={selectAllTransactions}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </th>
                        <th className="text-left p-2 text-xs font-medium">{t('date')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('product')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('customer')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('cashier')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('quantity')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('price')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('itemSubtotal')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('discount')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('tax')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('total')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('status')}</th>
                        <th className="text-left p-2 text-xs font-medium">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="13" className="p-8 text-center text-muted-foreground">
                            {t('noTransactionsFound') || 'Tidak ada transaksi ditemukan'}
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((item) => (
                        <tr 
                          key={item.id} 
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedTransactions.has(item.saleId)}
                              onChange={() => toggleTransactionSelection(item.saleId)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
                          <td className="p-2 text-sm">{item.date}</td>
                          <td className="p-2 text-sm">{item.product}</td>
                          <td className="p-2 text-sm">{item.customer}</td>
                          <td className="p-2 text-sm">{item.cashier}</td>
                          <td className="p-2 text-sm">{item.quantity}</td>
                          <td className="p-2 text-sm">Rp {item.price?.toLocaleString() || 0}</td>
                          <td className="p-2 text-sm">Rp {item.itemSubtotal?.toLocaleString() || 0}</td>
                          <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.discount_amount?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.tax_amount?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-sm">{item.isFirstItemInSale ? `Rp ${item.total?.toLocaleString() || 0}` : ''}</td>
                          <td className="p-2 text-sm">
                            {item.isFirstItemInSale && (
                              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                item.payment_status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : item.payment_status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {item.payment_status === 'paid' 
                                  ? (t('paid') || 'Lunas')
                                  : item.payment_status === 'partial'
                                  ? (t('partial') || 'Sebagian')
                                  : (t('unpaid') || 'Belum Lunas')}
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
                                  {t('action') || 'Aksi'}
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
        <DialogContent>
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

      {/* Print Dialog for Transaction History */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('printInvoice')}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Receipt Type Selection */}
            <div className="space-y-2">
              <Label>{t('receiptType')}</Label>
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enabledReceiptTypes['58mm'] && <SelectItem value="thermal-58mm">{t('thermal58mm') || '58mm Thermal'}</SelectItem>}
                  {enabledReceiptTypes['80mm'] && <SelectItem value="thermal-80mm">{t('thermal80mm') || '80mm Thermal'}</SelectItem>}
                  {enabledReceiptTypes['A4'] && <SelectItem value="invoice-a4">{t('invoiceA4')}</SelectItem>}
                  {enabledReceiptTypes['delivery-note'] && <SelectItem value="delivery-note">{t('deliveryNote') || 'Surat Jalan'}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Print Options */}
            {receiptType !== 'delivery-note' && (
              <div className="flex items-center space-x-2">
                <Switch 
                  id="two-decimals" 
                  checked={useTwoDecimals} 
                  onCheckedChange={setUseTwoDecimals}
                />
                <Label htmlFor="two-decimals">{t('useTwoDecimals')}</Label>
              </div>
            )}

            {receiptType !== 'delivery-note' && receiptType !== 'invoice-a4' && (
              <div className="flex items-center space-x-2">
                <Switch 
                  id="show-barcode" 
                  checked={showBarcode} 
                  onCheckedChange={setShowBarcode}
                />
                <Label htmlFor="show-barcode">{t('showBarcode')}</Label>
              </div>
            )}

            {receiptType === 'delivery-note' && (
              <>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="show-price" 
                    checked={deliveryNoteShowPrice} 
                    onCheckedChange={setDeliveryNoteShowPrice}
                  />
                  <Label htmlFor="show-price">{t('showPrice')}</Label>
                </div>
                
                <div>
                  <Label htmlFor="receiver-name">{t('receiverName')}</Label>
                  <Input
                    id="receiver-name"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder={t('receiverNamePlaceholder')}
                  />
                </div>
                
                <div>
                  <Label htmlFor="sender-name">{t('senderName')}</Label>
                  <Input
                    id="sender-name"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder={t('senderNamePlaceholder')}
                  />
                </div>
              </>
            )}

            {/* Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div ref={printRef}>
                {selectedSaleForPrint && (
                  <>
                    {receiptType === 'invoice-a4' && (
                      <InvoiceA4
                        sale={selectedSaleForPrint}
                        companyInfo={{...receiptSettings, ...receiptSettingsA4}}
                        useTwoDecimals={useTwoDecimals}
                        userId={authUser?.id || authUser?.tenantId}
                      />
                    )}
                    {receiptType === 'delivery-note' && (
                      <DeliveryNote
                        sale={selectedSaleForPrint}
                        companyInfo={{...receiptSettings, ...receiptSettingsDeliveryNote}}
                        showPrice={deliveryNoteShowPrice}
                        receiverName={receiverName}
                        senderName={senderName}
                        userId={authUser?.id || authUser?.tenantId}
                      />
                    )}
                    {(receiptType === 'thermal-58mm' || receiptType === 'thermal-80mm') && (
                      <PrintReceipt
                        items={selectedSaleForPrint.items}
                        subtotal={selectedSaleForPrint.subtotal}
                        discount={selectedSaleForPrint.discount}
                        discountAmount={selectedSaleForPrint.discount_amount}
                        taxAmount={selectedSaleForPrint.tax_amount}
                        total={selectedSaleForPrint.total}
                        paymentAmount={selectedSaleForPrint.payment_amount}
                        change={selectedSaleForPrint.change}
                        customer={selectedSaleForPrint.customer}
                        settings={receiptSettings}
                        paperSize={receiptType.replace('thermal-', '')}
                        useTwoDecimals={useTwoDecimals}
                        showBarcode={showBarcode}
                        t={t}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {selectedSaleForPrint && (
            <Button onClick={handlePrintForTransaction} className="w-full">
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
                      ? (t('paid') || 'Lunas')
                      : selectedTransactionForAction.payment_status === 'partial'
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
                    {t('markAsPaid') || 'Tandai Lunas'}
                  </Button>
                  <Button 
                    onClick={handleDeleteTransaction} 
                    variant="destructive" 
                    className="w-full"
                  >
                    {t('delete') || 'Hapus'}
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
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SalesPage;