import React, { useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Barcode from 'react-barcode';
import {
  getDefaultThermalMargin,
  getThermalReceiptLayout,
  resolveReceiptMargin,
} from '@/lib/thermalReceiptLayout';

const ReceiptContent = forwardRef(({ cart, subtotal, discountPercent, discountAmount, taxPercent, taxAmount, total, paymentAmount, change, customer, paperSize, settings = {}, useTwoDecimals = true, t, transactionId, cashierName }, ref) => {
  const isA4 = paperSize === 'A4';
  
  // Merge default settings with provided settings
  const mergedSettings = {
    // Header & Footer
    headerText: '',
    footerText: t('thankYouVisit'),
    showHeader: true,
    showFooter: true,
    showAddress: true,
    showPhone: true,
    showEmail: false,
    showLogo: false,
    
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
    itemSeparator: paperSize === 'A4' ? 'line' : 'none',
    
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
    margin: paperSize === 'A4' ? 10 : getDefaultThermalMargin(paperSize),
    
    // Additional
    showBarcode: false,
    showQRCode: false,
    showNotes: true,
    customNote: '',
    
    // Format
    decimalPlaces: 0,
    
    // Override with provided settings
    ...settings
  };

  const thermalLayout = getThermalReceiptLayout(paperSize, mergedSettings.lineSpacing);
  const resolvedMargin = resolveReceiptMargin(paperSize, mergedSettings.margin);
  
  // Get font size based on settings
  const getFontSize = () => {
    const baseSize = paperSize === '58mm' ? 10 : 12;
    switch (mergedSettings.fontSize) {
      case 'small': return baseSize - 2;
      case 'large': return baseSize + 2;
      default: return baseSize;
    }
  };
  
  // Get line spacing based on settings
  const getLineHeight = () => {
    if (thermalLayout) {
      return thermalLayout.lineHeight;
    }

    switch (mergedSettings.lineSpacing) {
      case 'compact': return '1.2';
      case 'relaxed': return '1.8';
      default: return '1.5';
    }
  };

  const getReceiptPadding = () => {
    if (thermalLayout) {
      return `${thermalLayout.verticalPaddingPx}px ${resolvedMargin}px`;
    }

    return `${resolvedMargin}px`;
  };
  
  const styles = {
    '58mm': {
      width: '58mm',
      fontSize: `${getFontSize()}px`,
      padding: getReceiptPadding(),
      lineHeight: getLineHeight(),
      boxSizing: 'border-box',
    },
    '80mm': {
      width: '80mm',
      fontSize: `${getFontSize()}px`,
      padding: getReceiptPadding(),
      lineHeight: getLineHeight(),
      boxSizing: 'border-box',
    },
    'A4': {
      width: '210mm',
      fontSize: '12px',
      padding: `${resolvedMargin}px`,
      lineHeight: getLineHeight(),
      boxSizing: 'border-box',
    },
  };

  const compactTextStyle = thermalLayout ? { margin: 0 } : undefined;
  const compactRuleStyle = thermalLayout ? { margin: `${thermalLayout.hrMarginYpx}px 0` } : undefined;
  const compactLogoStyle = thermalLayout ? { marginBottom: `${thermalLayout.noteGapPx}px` } : undefined;
  const compactHeaderStyle = thermalLayout ? { margin: 0, lineHeight: thermalLayout.lineHeight } : undefined;
  const compactSectionStyle = thermalLayout ? { display: 'flex', flexDirection: 'column', gap: 0 } : undefined;
  const compactFinancialStyle = thermalLayout
    ? { display: 'flex', flexDirection: 'column', gap: `${thermalLayout.itemLineGapPx}px` }
    : undefined;
  const compactFooterNoteStyle = thermalLayout
    ? { marginTop: `${thermalLayout.noteGapPx}px` }
    : undefined;
  const compactBarcodeWrapperStyle = thermalLayout
    ? { marginBottom: `${thermalLayout.barcodeMarginBottomPx}px` }
    : undefined;
  const compactItemNameStyle = thermalLayout
    ? { ...compactTextStyle, minWidth: 0, overflowWrap: 'anywhere' }
    : compactTextStyle;
  const compactItemMetaStyle = thermalLayout
    ? { margin: 0, justifySelf: 'end', textAlign: 'right', whiteSpace: 'nowrap' }
    : undefined;
  
  // Get text alignment based on settings
  const getAlignment = () => {
    switch (mergedSettings.alignment) {
      case 'left': return 'text-left';
      case 'right': return 'text-right';
      default: return 'text-center';
    }
  };

  // Format number based on settings
  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    const decimalPlaces = mergedSettings.decimalPlaces ?? (useTwoDecimals ? 2 : 0);
    return num.toLocaleString('id-ID', { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces });
  };

  const safeToLocaleString = (num) => {
    return formatNumber(num);
  };

  const getThermalItemDetail = (item) => {
    if (shouldShowQuantity && shouldShowPrice) {
      return `${item.quantity} x ${safeToLocaleString(item.price)}`;
    }

    if (shouldShowQuantity) {
      return String(item.quantity);
    }

    if (shouldShowPrice) {
      return safeToLocaleString(item.price);
    }

    return null;
  };

  const getThermalItemGridTemplateColumns = (detailLabel, subtotalLabel) => {
    const columns = [];

    if (shouldShowItemName) {
      columns.push('minmax(0, 1fr)');
    }

    if (detailLabel) {
      columns.push('auto');
    }

    if (subtotalLabel) {
      columns.push('auto');
    }

    return columns.length > 0 ? columns.join(' ') : '1fr';
  };

  // Ensure logo is always displayed with a fallback
  const getLogoSrc = () => {
    if (mergedSettings.logo && mergedSettings.logo !== '') {
      return mergedSettings.logo;
    }
    return '/logo.png';
  };

  // Check visibility based on settings - all settings default to their merged values
  // Use !== false for settings that should show by default
  // Use === true for settings that should hide by default
  const shouldShowLogo = mergedSettings.showLogo === true;
  const shouldShowAddress = mergedSettings.showAddress !== false && Boolean(mergedSettings.address);
  const shouldShowPhone = mergedSettings.showPhone !== false && Boolean(mergedSettings.phone);
  const shouldShowEmail = mergedSettings.showEmail === true && Boolean(mergedSettings.email);
  const shouldShowDateTime = mergedSettings.showDateTime !== false;
  const shouldShowCashier = mergedSettings.showCashier !== false;
  const shouldShowTransactionId = mergedSettings.showTransactionId !== false;
  const shouldShowSubtotalLine = mergedSettings.showSubtotalLine !== false;
  const shouldShowDiscount = mergedSettings.showDiscount !== false;
  const shouldShowTax = mergedSettings.showTax !== false;
  const shouldShowTotal = mergedSettings.showTotal !== false;
  const shouldShowPayment = mergedSettings.showPayment !== false;
  const shouldShowChange = mergedSettings.showChange !== false;
  const shouldShowNotes = mergedSettings.showNotes !== false && Boolean(mergedSettings.customNote);
  const shouldShowBarcode = mergedSettings.showBarcode === true;
  const shouldShowItemName = mergedSettings.showItemName !== false;
  const shouldShowItemCode = mergedSettings.showItemCode === true;
  const shouldShowQuantity = mergedSettings.showQuantity !== false;
  const shouldShowPrice = mergedSettings.showPrice !== false;
  const shouldShowSubtotalPerItem = mergedSettings.showSubtotal !== false;

  return (
    <div
      ref={ref}
      style={styles[paperSize]}
      className="receipt-printable bg-white text-black font-mono"
      data-receipt-paper-size={paperSize}
    >
      {/* Header Section */}
      <div className={getAlignment()} style={compactSectionStyle}>
        {shouldShowLogo && (
          <img src={getLogoSrc()} alt={t('logoAlt')} className="w-16 mx-auto mb-2" style={compactLogoStyle} data-thermal-logo={thermalLayout ? '' : undefined} onError={(e) => {
            e.target.style.display = 'none';
          }} />
        )}
        <h2 className={`text-lg ${mergedSettings.boldHeader !== false ? 'font-bold' : ''}`} style={compactHeaderStyle}>{mergedSettings.name || t('defaultStoreName')}</h2>
        {mergedSettings.showHeader !== false && mergedSettings.headerText && <p style={compactTextStyle}>{mergedSettings.headerText}</p>}
        {shouldShowAddress && <p style={compactTextStyle}>{mergedSettings.address}</p>}
        {shouldShowPhone && <p style={compactTextStyle}>{mergedSettings.phone}</p>}
        {shouldShowEmail && <p style={compactTextStyle}>{mergedSettings.email}</p>}
        <hr className="border-dashed border-black my-2" style={compactRuleStyle} />
      </div>
      
      {/* Transaction Info Section */}
      <div style={compactSectionStyle}>
        {shouldShowTransactionId && <p style={compactTextStyle}>{t('invoiceNumber')}: {transactionId || `INV/${new Date().getTime()}`}</p>}
        {shouldShowCashier && <p style={compactTextStyle}>{t('cashierLabel')}: {cashierName || 'Admin'}</p>}
        <p style={compactTextStyle}>{t('customerLabel')}: {customer?.name || t('generalCustomer')}</p>
        {shouldShowDateTime && <p style={compactTextStyle}>{t('dateLabel')}: {new Date().toLocaleString('id-ID')}</p>}
      </div>
      <hr className="border-dashed border-black my-2" style={compactRuleStyle} />
      
      {/* Items Section */}
      {isA4 ? (
        <table className="w-full text-left">
          <thead>
            <tr>
              {shouldShowItemName && <th className="py-1 px-2">{t('productLabel')}</th>}
              {shouldShowItemCode && <th className="py-1 px-2">{t('barcodeLabel')}</th>}
              {shouldShowPrice && <th className="py-1 px-2 text-right">{t('priceLabel')}</th>}
              {shouldShowQuantity && <th className="py-1 px-2 text-center">{t('qtyLabel')}</th>}
              {shouldShowSubtotalPerItem && <th className="py-1 px-2 text-right">{t('subtotalLabel')}</th>}
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                {shouldShowItemName && <td className="py-1 px-2">{item.name}</td>}
                {shouldShowItemCode && <td className="py-1 px-2">{item.barcode}</td>}
                {shouldShowPrice && <td className="py-1 px-2 text-right">{safeToLocaleString(item.price)}</td>}
                {shouldShowQuantity && <td className="py-1 px-2 text-center">{item.quantity}</td>}
                {shouldShowSubtotalPerItem && <td className="py-1 px-2 text-right">{safeToLocaleString(item.price * item.quantity)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        cart.map((item, index) => {
          const detailLabel = getThermalItemDetail(item);
          const subtotalLabel = shouldShowSubtotalPerItem
            ? safeToLocaleString(item.price * item.quantity)
            : null;

          return (
            <div
              key={item.id}
              style={thermalLayout ? {
                marginBottom: index === cart.length - 1 ? 0 : `${thermalLayout.itemLineGapPx}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: shouldShowItemCode && item.barcode ? `${Math.max(1, thermalLayout.itemLineGapPx - 1)}px` : 0,
              } : undefined}
              data-thermal-item-row={thermalLayout ? '' : undefined}
            >
              <div
                style={thermalLayout ? {
                  display: 'grid',
                  gridTemplateColumns: getThermalItemGridTemplateColumns(detailLabel, subtotalLabel),
                  columnGap: `${thermalLayout.itemLineGapPx * 2}px`,
                  alignItems: 'start',
                } : undefined}
              >
                {shouldShowItemName && <p style={compactItemNameStyle}>{item.name}</p>}
                {detailLabel && <span style={compactItemMetaStyle}>{detailLabel}</span>}
                {subtotalLabel && <span style={compactItemMetaStyle}>{subtotalLabel}</span>}
              </div>
              {shouldShowItemCode && item.barcode && (
                <p className="text-xs text-gray-600" style={compactTextStyle}>{item.barcode}</p>
              )}
            </div>
          );
        })
      )}
      <hr className="border-dashed border-black my-2" style={compactRuleStyle} />
      
      {/* Financial Summary Section */}
      <div className={thermalLayout ? '' : 'space-y-1'} style={compactFinancialStyle}>
        {shouldShowSubtotalLine && (
          <div className="flex justify-between"><p style={compactTextStyle}>{t('subtotalLabel')}:</p><p style={compactTextStyle}>{safeToLocaleString(subtotal)}</p></div>
        )}
        {shouldShowDiscount && discountAmount > 0 && (
          <div className="flex justify-between"><p style={compactTextStyle}>{t('discountLabel')} ({discountPercent}%):</p><p style={compactTextStyle}>-{safeToLocaleString(discountAmount)}</p></div>
        )}
        {shouldShowTax && taxAmount > 0 && (
          <div className="flex justify-between"><p style={compactTextStyle}>{t('taxLabel')} ({taxPercent}%):</p><p style={compactTextStyle}>{safeToLocaleString(taxAmount)}</p></div>
        )}
        <hr className="border-dashed border-black my-1" style={compactRuleStyle} />
        {shouldShowTotal && (
          <div className={`flex justify-between ${mergedSettings.boldTotal !== false ? 'font-bold' : ''}`}>
            <p style={compactTextStyle}>{t('totalLabel')}:</p><p style={compactTextStyle}>{safeToLocaleString(total)}</p>
          </div>
        )}
        {shouldShowPayment && paymentAmount > 0 && (
          <div className="flex justify-between"><p style={compactTextStyle}>{t('payLabel')}:</p><p style={compactTextStyle}>{safeToLocaleString(paymentAmount)}</p></div>
        )}
        {shouldShowChange && change > 0 && (
          <div className="flex justify-between"><p style={compactTextStyle}>{t('changeLabel')}:</p><p style={compactTextStyle}>{safeToLocaleString(change)}</p></div>
        )}
      </div>
      <hr className="border-dashed border-black my-2" style={compactRuleStyle} />
      
      {/* Footer Section */}
      <div className={getAlignment()} style={compactSectionStyle}>
        {mergedSettings.showFooter !== false && mergedSettings.footerText && <p style={compactTextStyle}>{mergedSettings.footerText}</p>}
        {shouldShowNotes && <p className="mt-2 text-sm" style={{ ...compactTextStyle, ...compactFooterNoteStyle }} data-thermal-note={thermalLayout ? '' : undefined}>{mergedSettings.customNote}</p>}
      </div>
      
      {/* Barcode Section - Only for thermal receipts */}
      {shouldShowBarcode && paperSize !== 'A4' && (() => {
        // Display single barcode for transaction ID (or temporary ID)
        // This replaces the item-level barcode list to ensure accumulation/single barcode per receipt
        const barcodeValue = transactionId || `INV/${new Date().getTime()}`;
        
        return (
          <>
            <hr className="border-dashed border-black my-2" style={compactRuleStyle} />
            <div className="text-center mb-3" style={compactBarcodeWrapperStyle} data-thermal-barcode={thermalLayout ? '' : undefined}>
              <div style={{ display: 'inline-block' }}>
                <Barcode 
                  value={barcodeValue}
                  format="CODE128"
                  width={paperSize === '58mm' ? 1.2 : 1.5}
                  height={paperSize === '58mm' ? 35 : 45}
                  displayValue={true}
                  fontSize={10}
                  margin={thermalLayout ? thermalLayout.barcodeMarginPx : 5}
                  background="#ffffff"
                />
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
});

ReceiptContent.displayName = 'ReceiptContent';
export { ReceiptContent };

const PrintReceipt = forwardRef(({ paperSize, setPaperSize, settings, hideInternalPrintButton = false, ...props }, ref) => {
  const componentRef = ref || useRef();
  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `receipt-idcashier-${new Date().getTime()}`,
  });
  const { t } = useLanguage();

  return (
    <div>
      {/* Only show paper size tabs when not in design mode */}
      {!hideInternalPrintButton && (
        <Tabs value={paperSize} onValueChange={setPaperSize} className="mb-4">
          <TabsList>
            <TabsTrigger value="58mm">58mm</TabsTrigger>
            <TabsTrigger value="80mm">80mm</TabsTrigger>
            <TabsTrigger value="A4">A4</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {!hideInternalPrintButton && (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-muted-foreground">
            {t('paperSize')}: {paperSize}
          </div>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> {t('printButton')}
          </Button>
        </div>
      )}
      <div className={hideInternalPrintButton ? '' : 'bg-gray-200 p-4 rounded-md overflow-auto max-h-[60vh]'}>
        <div style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
          <ReceiptContent {...props} settings={settings} paperSize={paperSize} t={t} ref={componentRef} />
        </div>
      </div>
    </div>
  );
});

PrintReceipt.displayName = 'PrintReceipt';

export default PrintReceipt;
