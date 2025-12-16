import React, { forwardRef, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyUtil, getCurrencyFromStorage } from '@/lib/utils';
import { storeSettingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const DeliveryNote = forwardRef(({ 
  sale, 
  companyInfo, 
  useTwoDecimals = true, 
  showPrice = true, 
  receiverName = '', 
  senderName = '', 
  context, 
  userId, 
  designSettings = {} 
}, ref) => {
  const { t, language } = useLanguage();
  const { user, token } = useAuth();
  const [loadedDesignSettings, setLoadedDesignSettings] = useState({});
  
  // Default design settings
  const defaultDesignSettings = {
    // Header settings
    showLogo: true,
    showCompanyInfo: true,
    showBorder: true,
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
    
    // Other
    showNotes: true,
    borderColor: '#000000',
    bgColor: '#ffffff',
    tableHeaderBg: '#000000',
    tableHeaderText: '#ffffff',
    tableBorderColor: '#000000',
    fontColor: '#000000',
    fontFamily: 'Inter',
    fontSize: 14,
    language: 'id',
    currency: 'IDR',
    decimalSeparator: ',',
    thousandSeparator: '.',
    decimalPlaces: 0
  };
  
  // Load design settings if not provided
  useEffect(() => {
    const loadDesignSettings = async () => {
      // If designSettings prop is provided and not empty (like in design mode), don't load from storage
      if (Object.keys(designSettings).length > 0) return; // Use prop values directly via mergedSettings
      
      if (!user?.id && !userId) {
        // Try to load from localStorage as fallback
        try {
          const ownerId = userId || 'default';
          const storedSettings = localStorage.getItem(`idcashier_delivery_note_design_${ownerId}`);
          if (storedSettings) {
            setLoadedDesignSettings(JSON.parse(storedSettings));
            return;
          }
        } catch (error) {
          console.warn('Could not load design settings from localStorage:', error);
        }
        return;
      }
      
      try {
        const ownerId = userId || user.id || user.tenantId;
        // Try localStorage first
        const storedSettings = localStorage.getItem(`idcashier_delivery_note_design_${ownerId}`);
        if (storedSettings) {
          setLoadedDesignSettings(JSON.parse(storedSettings));
          return;
        }
        
        // If not in localStorage, try Supabase
        if (token) {
          const allSettings = await storeSettingsAPI.load(token);
          if (allSettings.deliveryNoteDesign) {
            setLoadedDesignSettings(allSettings.deliveryNoteDesign);
          }
        }
      } catch (error) {
        console.warn('Error loading design settings:', error);
        // Try localStorage as last resort
        try {
          const ownerId = userId || user?.id || user?.tenantId || 'default';
          const storedSettings = localStorage.getItem(`idcashier_delivery_note_design_${ownerId}`);
          if (storedSettings) {
            setLoadedDesignSettings(JSON.parse(storedSettings));
          }
        } catch (localStorageError) {
          console.warn('Could not load design settings from localStorage as fallback:', localStorageError);
        }
      }
    };
    
    loadDesignSettings();
  }, [user, token, userId]); // Removed designSettings from dependency array since it causes re-loads
  
  // Merge all settings with priority: prop > loaded > localStorage > defaults
  const mergedSettings = {
    ...defaultDesignSettings,
    ...loadedDesignSettings,
    ...designSettings
  };
  
  // Ensure we have proper defaults
  const safeCompanyInfo = {
    name: companyInfo?.name || 'Toko',
    address: companyInfo?.address || '',
    phone: companyInfo?.phone || '',
    email: companyInfo?.email || '',
    logoUrl: companyInfo?.logoUrl || companyInfo?.logo || '/logo.png',
    invoicePrefix: companyInfo?.invoicePrefix || '',
    vehicleNumber: companyInfo?.vehicleNumber || '',
    driverName: companyInfo?.driverName || ''
  };

  // Format date based on design settings
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const format = mergedSettings.dateFormat || 'DD MMMM YYYY';
    const lang = mergedSettings.language || language || 'id';
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    const monthNames = {
      id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
    };
    
    const dayStr = day < 10 ? '0' + day : day;
    const monthStr = (month + 1) < 10 ? '0' + (month + 1) : (month + 1);
    
    switch(format) {
      case 'DD/MM/YYYY':
        return `${dayStr}/${monthStr}/${year}`;
      case 'MM/DD/YYYY':
        return `${monthStr}/${dayStr}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${monthStr}-${dayStr}`;
      case 'DD-MM-YYYY':
        return `${dayStr}-${monthStr}-${year}`;
      case 'DD MMMM YYYY':
        return `${day} ${monthNames[lang][month]} ${year}`;
      case 'MMMM DD, YYYY':
        return `${monthNames[lang][month]} ${day}, ${year}`;
      default:
        return `${day} ${monthNames[lang][month]} ${year}`;
    }
  };

  // Format currency using design settings
  const formatCurrency = (amount) => {
    const curr = mergedSettings.currency || 'IDR';
    const decimal = mergedSettings.decimalSeparator || ',';
    const thousand = mergedSettings.thousandSeparator || '.';
    const places = mergedSettings.decimalPlaces || 0;
    
    // Convert amount to number
    let num = parseFloat(amount);
    
    // Handle NaN or invalid values
    if (isNaN(num)) return '0';
    
    // Round to decimal places
    num = num.toFixed(places);
    
    // Split integer and decimal
    let parts = num.split('.');
    let intPart = parts[0];
    let decPart = parts[1] || '';
    
    // Add thousand separator
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
    
    // Combine with decimal
    let formatted = intPart;
    if (places > 0 && decPart) {
      formatted += decimal + decPart;
    }
    
    // Add currency symbol
    const symbols = {
      'IDR': 'Rp ',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'SGD': 'S$'
    };
    
    return symbols[curr] + formatted;
  };

  // Apply font family from settings
  const fontFamily = mergedSettings.fontFamily || 'Inter';

  // Get border style based on settings
  const getBorderStyle = () => {
    if (!mergedSettings.showBorder) return {};
    return {
      border: `2px solid ${mergedSettings.borderColor || '#000000'}`,
      padding: '30px'
    };
  };

  // Get background style based on settings
  const getBackgroundStyle = () => {
    return {
      background: mergedSettings.bgColor || '#ffffff',
      fontFamily: fontFamily,
      fontSize: `${mergedSettings.fontSize || 14}px`,
      color: mergedSettings.fontColor || '#000000'
    };
  };

  // Get table header style
  const getTableHeaderStyle = () => {
    return {
      background: mergedSettings.tableHeaderBg || '#000000',
      color: mergedSettings.tableHeaderText || '#ffffff'
    };
  };

  // Get table border style
  const getTableBorderStyle = () => {
    return {
      border: `1px solid ${mergedSettings.tableBorderColor || '#000000'}`
    };
  };

  // Get signature positions based on settings
  const getSignaturePositionStyle = () => {
    if (mergedSettings.signaturePosition === 'fixed') {
      return {
        position: 'absolute',
        bottom: '20px',
        left: '0',
        right: '0'
      };
    }
    return {
      position: 'relative',
      marginTop: '40px'
    };
  };

  // Get active signatures array
  const getActiveSignatures = () => {
    const signatures = [];
    if (mergedSettings.signSender) signatures.push('sender');
    if (mergedSettings.signReceiver) signatures.push('receiver');
    if (mergedSettings.signDriver) signatures.push('driver');
    if (mergedSettings.signWarehouse) signatures.push('warehouse');
    if (mergedSettings.signFinance) signatures.push('finance');
    return signatures;
  };

  // Get signature label based on language
  const getSignatureLabel = (signType) => {
    const labels = {
      id: {
        sender: 'Pengirim',
        receiver: 'Penerima',
        driver: 'Driver',
        warehouse: 'Staff Gudang',
        finance: 'Finance'
      },
      en: {
        sender: 'Sender',
        receiver: 'Receiver',
        driver: 'Driver',
        warehouse: 'Warehouse Staff',
        finance: 'Finance'
      },
      zh: {
        sender: '发送方',
        receiver: '接收方',
        driver: '司机',
        warehouse: '仓库员工',
        finance: '财务'
      }
    };
    
    const currentLang = mergedSettings.language || language || 'id';
    return labels[currentLang]?.[signType] || labels['id'][signType];
  };

  // Get greeting text based on language
  const getGreeting = () => {
    const currentLang = mergedSettings.language || language || 'id';
    const greetings = {
      id: 'Hormat Kami',
      en: 'Best Regards',
      zh: '此致敬礼'
    };
    return greetings[currentLang] || greetings['id'];
  };

  // Generate signature boxes with proper format:
  // Greeting -> Space for signature -> Name (from account) -> Line -> Position field
  const generateSignatureBoxes = () => {
    const activeSignatures = getActiveSignatures();
    if (activeSignatures.length === 0) return null;
    
    const justifyContent = activeSignatures.length <= 2 ? 'flex-start' : 'space-between';
    const greeting = getGreeting();
    
    // Get user name from auth context or companyInfo
    const userName = user?.name || user?.full_name || companyInfo?.businessOwnerName || companyInfo?.ownerName || safeCompanyInfo.name || '';
    // Get position from companyInfo
    const userPosition = companyInfo?.position || '';
    
    return (
      <div style={{
        display: 'flex',
        justifyContent: justifyContent,
        gap: '40px',
        flexWrap: 'wrap'
      }}>
        {activeSignatures.map((signType, index) => (
          <div
            key={signType}
            style={{
              textAlign: 'center',
              minWidth: '180px',
              flex: activeSignatures.length <= 2 ? '0 0 auto' : '1',
              maxWidth: activeSignatures.length <= 2 ? '220px' : 'none'
            }}
          >
            {/* Greeting - "Hormat Kami," */}
            <p style={{
              fontWeight: '500',
              color: mergedSettings.fontColor || '#000000',
              fontSize: '13px',
              marginBottom: '60px'
            }}>
              {greeting},
            </p>
            
            {/* Name (from account, shown without label) */}
            <p style={{
              fontStyle: 'italic',
              color: '#808080',
              fontSize: '13px',
              marginBottom: '4px'
            }}>
              {index === 0 && userName ? userName : '................................'}
            </p>
            
            {/* Signature Line - solid continuous line */}
            <div style={{
              borderTop: `1px solid ${mergedSettings.fontColor || '#000000'}`,
              width: '150px',
              margin: '0 auto 4px auto'
            }} />
            
            {/* Position field (from account or empty for user to fill) */}
            <p style={{
              fontStyle: 'italic',
              fontSize: '12px',
              color: '#808080',
              margin: '0'
            }}>
              {index === 0 && userPosition ? userPosition : '................................'}
            </p>
          </div>
        ))}
      </div>
    );
  };

  // Ensure logo is always displayed with a fallback
  const getLogoSrc = () => {
    if (safeCompanyInfo.logoUrl && safeCompanyInfo.logoUrl !== '') {
      return safeCompanyInfo.logoUrl;
    }
    return '/logo.png';
  };

  // Get delivery order number
  const deliveryNumber = safeCompanyInfo.invoicePrefix 
    ? `${safeCompanyInfo.invoicePrefix}/${sale?.id || 'TEMP'}`
    : sale?.id || 'TEMP';

  // Dynamic horizontal padding adjustments per page context
  const baseLeftCh = 8;
  const baseRightCh = 2;
  const leftCh = context === 'sales' ? Math.max(0, baseLeftCh - 3) : context === 'reports' ? Math.max(0, baseLeftCh - 2) : baseLeftCh;
  const rightCh = context === 'reports' ? Math.max(0, baseRightCh - 2) : baseRightCh;

  // Get current language for translations
  const currentLang = mergedSettings.language || language || 'id';
  const translations = {
    id: {
      title: 'SURAT JALAN',
      date: 'Tanggal',
      to: 'KE',
      defaultCustomer: 'Pelanggan Umum',
      no: 'No',
      itemDescription: 'Nama Barang',
      unit: 'Satuan',
      qty: 'Qty',
      unitPrice: 'Harga Satuan',
      amount: 'Jumlah',
      notes: 'Keterangan',
      sender: 'PENGIRIM',
      receiver: 'PENERIMA'
    },
    en: {
      title: 'DELIVERY NOTE',
      date: 'Date',
      to: 'TO',
      defaultCustomer: 'General Customer',
      no: 'No',
      itemDescription: 'Item Description',
      unit: 'Unit',
      qty: 'Qty',
      unitPrice: 'Unit Price',
      amount: 'Amount',
      notes: 'Notes',
      sender: 'SENDER',
      receiver: 'RECEIVER'
    },
    zh: {
      title: '送货单',
      date: '日期',
      to: '收件人',
      defaultCustomer: '普通客户',
      no: '编号',
      itemDescription: '商品名称',
      unit: '单位',
      qty: '数量',
      unitPrice: '单价',
      amount: '金额',
      notes: '备注',
      sender: '发货方',
      receiver: '收货方'
    }
  };

  const trans = translations[currentLang] || translations['id'];

  return (
    <div ref={ref} className="printable-invoice-area">
      <div
        className="invoice-container mx-auto font-sans text-black flex flex-col h-full"
        style={{
          width: '21cm',
          minHeight: '29.7cm',
          paddingTop: '25mm',
          paddingBottom: '25mm',
          paddingLeft: `${leftCh}ch`,
          paddingRight: `${rightCh}ch`,
          ...getBackgroundStyle(),
          ...getBorderStyle()
        }}
      >
        {/* Header Section */}
        {(mergedSettings.showLogo !== false || mergedSettings.showCompanyInfo !== false) && (
          <header className="flex justify-between items-start mb-8" style={{ color: mergedSettings.fontColor || '#000000' }}>
            {/* Left: Logo and Company Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {(mergedSettings.showLogo !== false) && safeCompanyInfo.logoUrl && (
                <div style={{ width: '80px', height: '80px', flexShrink: 0 }}>
                  <img 
                    src={getLogoSrc()} 
                    alt={t('companyLogoAlt') || 'Company Logo'} 
                    className="object-contain h-20 w-auto"
                    style={{ maxWidth: '80px', maxHeight: '80px' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              {(mergedSettings.showCompanyInfo !== false) && (
                <div>
                  <p className="font-bold text-lg" style={{ color: mergedSettings.fontColor || '#000000' }}>{safeCompanyInfo.name}</p>
                  {safeCompanyInfo.address && <p className="whitespace-pre-line" style={{ color: '#6b7280' }}>{safeCompanyInfo.address}</p>}
                  {(safeCompanyInfo.phone || safeCompanyInfo.email) && (
                    <p style={{ color: '#6b7280' }}>
                      {safeCompanyInfo.phone && safeCompanyInfo.phone}
                      {safeCompanyInfo.phone && safeCompanyInfo.email && ' | '}
                      {safeCompanyInfo.email && safeCompanyInfo.email}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Title, Number, Date */}
            <div style={{ textAlign: mergedSettings.titleAlign || 'right' }}>
              <h1 className="text-2xl font-bold uppercase" style={{ color: mergedSettings.fontColor || '#000000', margin: '0' }}>{trans.title}</h1>
              {(mergedSettings.showDocNumber !== false) && (
                <p style={{ margin: '8px 0', fontSize: '13px', color: '#6b7280' }}>
                  {t('docNumber') || 'No'}: <strong style={{ color: mergedSettings.fontColor || '#000000' }}>{mergedSettings.invoiceFormat || deliveryNumber}</strong>
                </p>
              )}
              {(mergedSettings.showDate !== false) && (
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#6b7280' }}>
                  <strong>{trans.date}:</strong> {formatDate(sale?.created_at)}
                </p>
              )}
              {(mergedSettings.showPO !== false) && (
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#6b7280' }}>
                  <strong>{t('poNumber') || 'PO No'}:</strong> <strong>PO-2024-789</strong>
                </p>
              )}
              {(mergedSettings.showDueDate !== false) && (
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#6b7280' }}>
                  <strong>{t('dueDate') || 'Due Date'}:</strong> <strong>{formatDate(sale?.created_at)}</strong>
                </p>
              )}
            </div>
          </header>
        )}
        
        {/* Driver & Vehicle Info */}
        {(mergedSettings.showDriver !== false) && (
          <div style={{
            background: mergedSettings.bgColor || '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            borderLeft: `2px solid ${mergedSettings.borderColor || '#000000'}`,
            border: `1px solid ${mergedSettings.borderColor || '#000000'}`
          }}>
            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
              {safeCompanyInfo.driverName && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{t('driver') || 'DRIVER'}:</span>
                  <strong style={{ marginLeft: '8px' }}>{safeCompanyInfo.driverName}</strong>
                </div>
              )}
              {safeCompanyInfo.vehicleNumber && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{t('vehicleNo') || 'VEHICLE NO'}:</span>
                  <strong style={{ marginLeft: '8px' }}>{safeCompanyInfo.vehicleNumber}</strong>
                </div>
              )}
              {safeCompanyInfo.phone && (
                <div>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{t('phoneNo') || 'PHONE NO'}:</span>
                  <strong style={{ marginLeft: '8px' }}>{safeCompanyInfo.phone}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TO and Delivery Details Section */}
        {(mergedSettings.showSender !== false || mergedSettings.showReceiver !== false) && (
          <section className="grid grid-cols-2 gap-8 mb-8">
            {/* Sender */}
            {(mergedSettings.showSender !== false) && (
              <div style={{
                background: mergedSettings.bgColor || '#ffffff',
                padding: '16px',
                borderRadius: '8px',
                border: `1px solid ${mergedSettings.borderColor || '#000000'}`
              }}>
                <h3 className="font-semibold uppercase tracking-wider mb-2" style={{ 
                  color: mergedSettings.fontColor || '#000000',
                  borderBottom: `2px solid ${mergedSettings.borderColor || '#000000'}`,
                  paddingBottom: '6px',
                  fontSize: '14px',
                  margin: '0 0 10px 0'
                }}>{trans.sender}</h3>
                <p style={{ margin: '4px 0', fontWeight: '600' }}>{safeCompanyInfo.name}</p>
                {safeCompanyInfo.address && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '13px' }}>{safeCompanyInfo.address}</p>}
                {safeCompanyInfo.phone && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '13px' }}>{t('pic') || 'PIC'}: {senderName || safeCompanyInfo.name}</p>}
              </div>
            )}

            {/* Receiver */}
            {(mergedSettings.showReceiver !== false) && (
              <div style={{ 
                background: mergedSettings.bgColor || '#ffffff', 
                padding: '16px', 
                borderRadius: '8px',
                border: `1px solid ${mergedSettings.borderColor || '#000000'}`
              }}>
                <h3 className="font-semibold uppercase tracking-wider mb-2" style={{ 
                  color: mergedSettings.fontColor || '#000000',
                  borderBottom: `2px solid ${mergedSettings.borderColor || '#000000'}`,
                  paddingBottom: '6px',
                  fontSize: '14px',
                  margin: '0 0 10px 0'
                }}>{trans.receiver}</h3>
                {sale?.customer && sale?.customer?.name && sale?.customer?.name !== 'Pelanggan Umum' && sale?.customer?.name !== 'Default Customer' ? (
                  <>
                    <p style={{ margin: '4px 0', fontWeight: '600' }}>{sale?.customer?.name}</p>
                    {sale?.customer?.address && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '13px' }}>{sale?.customer?.address}</p>}
                    {sale?.customer?.phone && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '13px' }}>{sale?.customer?.phone}</p>}
                  </>
                ) : (
                  <p style={{ margin: '4px 0', fontWeight: '600' }}>{trans.defaultCustomer}</p>
                )}
                <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '13px' }}>{t('pic') || 'PIC'}: {receiverName || t('name') || 'NAME'}</p>
              </div>
            )}
          </section>
        )}

        {/* Items Table Section */}
        <section className="mb-12">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ ...getTableHeaderStyle() }}>
                {(mergedSettings.colNumber !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'center', width: '50px' }}>{trans.no}</th>
                )}
                {(mergedSettings.colItem !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'left' }}>{trans.itemDescription}</th>
                )}
                {(mergedSettings.colQty !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'center', width: '80px' }}>{trans.qty}</th>
                )}
                {(mergedSettings.colUnit !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'center', width: '80px' }}>{trans.unit}</th>
                )}
                {(mergedSettings.colWeight !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'center', width: '100px' }}>{t('weight') || 'Weight'}</th>
                )}
                {(showPrice && mergedSettings.colPrice !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'right', width: '120px' }}>{trans.unitPrice}</th>
                )}
                {(showPrice && mergedSettings.colPrice !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'right', width: '120px' }}>{trans.amount}</th>
                )}
                {(mergedSettings.colNotes !== false) && (
                  <th style={{ ...getTableBorderStyle(), padding: '12px', textAlign: 'left' }}>{trans.notes}</th>
                )}
              </tr>
            </thead>
            <tbody style={{ color: mergedSettings.fontColor || '#000000' }}>
              {sale?.items?.map((item, index) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <tr key={index} style={{ 
                    borderBottom: `1px solid ${mergedSettings.tableBorderColor || '#000000'}`,
                    background: mergedSettings.bgColor || '#ffffff'
                  }}>
                    {(mergedSettings.colNumber !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'center' }}>{index + 1}</td>
                    )}
                    {(mergedSettings.colItem !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px' }}>{item.product_name || item.name}</td>
                    )}
                    {(mergedSettings.colQty !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</td>
                    )}
                    {(mergedSettings.colUnit !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'center' }}>{item.unit || '-'}</td>
                    )}
                    {(mergedSettings.colWeight !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'center' }}>{item.weight || '-'}</td>
                    )}
                    {(showPrice && mergedSettings.colPrice !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.price)}</td>
                    )}
                    {(showPrice && mergedSettings.colPrice !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(itemTotal)}</td>
                    )}
                    {(mergedSettings.colNotes !== false) && (
                      <td style={{ ...getTableBorderStyle(), padding: '10px', fontSize: '13px', color: '#6b7280' }}>{item.notes || '-'}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Notes Section */}
        {(mergedSettings.showNotes !== false) && (
          <section className="mb-8">
            <div style={{
              background: mergedSettings.bgColor || '#ffffff',
              borderLeft: `2px solid ${mergedSettings.borderColor || '#000000'}`,
              border: `1px solid ${mergedSettings.borderColor || '#000000'}`,
              padding: '12px 16px',
              borderRadius: '4px',
              marginBottom: '30px'
            }}>
              <p style={{ margin: '0', fontSize: '13px', color: '#374151' }}>
                <strong>{trans.notes}:</strong> {t('deliveryNoteNote') || 'Barang yang sudah diterima tidak dapat dikembalikan. Harap periksa kondisi barang sebelum menandatangani dokumen ini.'}
              </p>
            </div>
          </section>
        )}

        {/* Footer Section - Signatures */}
        {(mergedSettings.showSignatures !== false) && (
          <footer className="mt-auto pt-12" style={getSignaturePositionStyle()}>
            {generateSignatureBoxes()}
          </footer>
        )}
      </div>
    </div>
  );
  
  // Helper function to lighten color
  function lightenColor(color, opacity) {
    // Convert hex to RGB
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    
    // Lighten by mixing with white
    r = Math.round(r + (255 - r) * opacity);
    g = Math.round(g + (255 - g) * opacity);
    b = Math.round(b + (255 - b) * opacity);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
});

DeliveryNote.displayName = 'DeliveryNote';

export default DeliveryNote;