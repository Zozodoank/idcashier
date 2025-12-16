import React, { useRef, forwardRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import Barcode from 'react-barcode';

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
    itemSeparator: 'line',
    
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
    margin: 10,
    
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
    switch (mergedSettings.lineSpacing) {
      case 'compact': return '1.2';
      case 'relaxed': return '1.8';
      default: return '1.5';
    }
  };
  
  const styles = {
    '58mm': { width: '58mm', fontSize: `${getFontSize()}px`, padding: `${mergedSettings.margin || 10}px`, lineHeight: getLineHeight() },
    '80mm': { width: '80mm', fontSize: `${getFontSize()}px`, padding: `${mergedSettings.margin || 10}px`, lineHeight: getLineHeight() },
    'A4': { width: '210mm', fontSize: '12px', padding: `${mergedSettings.margin || 10}px`, lineHeight: getLineHeight() },
  };
  
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
    <div ref={ref} style={styles[paperSize]} className="receipt-printable bg-white text-black font-mono">
      {/* Header Section */}
      <div className={getAlignment()}>
        {shouldShowLogo && (
          <img src={getLogoSrc()} alt={t('logoAlt')} className="w-16 mx-auto mb-2" onError={(e) => {
            e.target.style.display = 'none';
          }} />
        )}
        <h2 className={`text-lg ${mergedSettings.boldHeader !== false ? 'font-bold' : ''}`}>{mergedSettings.name || t('defaultStoreName')}</h2>
        {mergedSettings.showHeader !== false && mergedSettings.headerText && <p>{mergedSettings.headerText}</p>}
        {shouldShowAddress && <p>{mergedSettings.address}</p>}
        {shouldShowPhone && <p>{mergedSettings.phone}</p>}
        {shouldShowEmail && <p>{mergedSettings.email}</p>}
        <hr className="border-dashed border-black my-2" />
      </div>
      
      {/* Transaction Info Section */}
      <div>
        {shouldShowTransactionId && <p>{t('invoiceNumber')}: {transactionId || `INV/${new Date().getTime()}`}</p>}
        {shouldShowCashier && <p>{t('cashierLabel')}: {cashierName || 'Admin'}</p>}
        <p>{t('customerLabel')}: {customer?.name || t('generalCustomer')}</p>
        {shouldShowDateTime && <p>{t('dateLabel')}: {new Date().toLocaleString('id-ID')}</p>}
      </div>
      <hr className="border-dashed border-black my-2" />
      
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
        cart.map(item => (
          <div key={item.id} className={mergedSettings.itemSeparator === 'line' ? 'border-b border-dashed border-gray-300 pb-1 mb-1' : mergedSettings.itemSeparator === 'space' ? 'mb-2' : ''}>
            {shouldShowItemName && <p>{item.name}</p>}
            {shouldShowItemCode && item.barcode && <p className="text-xs text-gray-600">{item.barcode}</p>}
            <div className="flex justify-between">
              {shouldShowQuantity && shouldShowPrice && (
                <span>{item.quantity} x {safeToLocaleString(item.price)}</span>
              )}
              {shouldShowSubtotalPerItem && (
                <span>{safeToLocaleString(item.price * item.quantity)}</span>
              )}
            </div>
          </div>
        ))
      )}
      <hr className="border-dashed border-black my-2" />
      
      {/* Financial Summary Section */}
      <div className="space-y-1">
        {shouldShowSubtotalLine && (
          <div className="flex justify-between"><p>{t('subtotalLabel')}:</p><p>{safeToLocaleString(subtotal)}</p></div>
        )}
        {shouldShowDiscount && discountAmount > 0 && (
          <div className="flex justify-between"><p>{t('discountLabel')} ({discountPercent}%):</p><p>-{safeToLocaleString(discountAmount)}</p></div>
        )}
        {shouldShowTax && taxAmount > 0 && (
          <div className="flex justify-between"><p>{t('taxLabel')} ({taxPercent}%):</p><p>{safeToLocaleString(taxAmount)}</p></div>
        )}
        <hr className="border-dashed border-black my-1" />
        {shouldShowTotal && (
          <div className={`flex justify-between ${mergedSettings.boldTotal !== false ? 'font-bold' : ''}`}>
            <p>{t('totalLabel')}:</p><p>{safeToLocaleString(total)}</p>
          </div>
        )}
        {shouldShowPayment && paymentAmount > 0 && (
          <div className="flex justify-between"><p>{t('payLabel')}:</p><p>{safeToLocaleString(paymentAmount)}</p></div>
        )}
        {shouldShowChange && change > 0 && (
          <div className="flex justify-between"><p>{t('changeLabel')}:</p><p>{safeToLocaleString(change)}</p></div>
        )}
      </div>
      <hr className="border-dashed border-black my-2" />
      
      {/* Footer Section */}
      <div className={getAlignment()}>
        {mergedSettings.showFooter !== false && mergedSettings.footerText && <p>{mergedSettings.footerText}</p>}
        {shouldShowNotes && <p className="mt-2 text-sm">{mergedSettings.customNote}</p>}
      </div>
      
      {/* Barcode Section - Only for thermal receipts */}
      {shouldShowBarcode && paperSize !== 'A4' && (() => {
        const itemsWithBarcode = cart.filter(item => item.barcode && item.barcode.toString().trim().length > 0);
        
        if (itemsWithBarcode.length === 0) {
          return null; // No items with barcode, don't show section
        }
        
        return (
          <>
            <hr className="border-dashed border-black my-2" />
            <div className="text-center space-y-2">
              {itemsWithBarcode.map((item, index) => {
                // Prepare barcode value - use as-is for CODE128
                const barcodeValue = item.barcode.toString().trim();
                
                return (
                  <div key={`${item.id}-${index}`} className="mb-3">
                    <div style={{ display: 'inline-block' }}>
                      <Barcode 
                        value={barcodeValue}
                        format="CODE128"
                        width={paperSize === '58mm' ? 1.2 : 1.5}
                        height={paperSize === '58mm' ? 35 : 45}
                        displayValue={true}
                        fontSize={10}
                        margin={5}
                        background="#ffffff"
                      />
                    </div>
                  </div>
                );
              })}
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