import React, { forwardRef, useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyUtil, getCurrencyFromStorage } from '@/lib/utils';
import { storeSettingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const InvoiceA4 = forwardRef(({ sale, companyInfo, useTwoDecimals = true, context, userId, designSettings = {} }, ref) => {
  const { t, language } = useLanguage();
  const { user, token } = useAuth();
  const [loadedDesignSettings, setLoadedDesignSettings] = useState({});
  
  // Get currency from storage
  const currencyCode = getCurrencyFromStorage(userId);

  // Default design settings
  const defaultDesignSettings = {
    // Header settings
    showLogo: true,
    showCompanyInfo: true,
    showBorder: true,
    titleAlign: 'right',
    
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
    showBankInfo: true,
    showNotes: true,
    
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
    fontFamily: 'sans-serif',
    fontSize: 14,
    
    // Other
    language: 'id',
    currency: 'IDR'
  };

  // Style for user-inputted data (italic, gray) - indicates dynamic data from forms
  const userDataStyle = {
    fontStyle: 'italic',
    color: '#808080'
  };

  // Load saved design settings
  useEffect(() => {
    const loadDesignSettings = async () => {
      // If designSettings prop is provided with actual values (like in design mode), don't load from storage
      if (Object.keys(designSettings).length > 0) {
        return; // Use the prop values directly via mergedSettings
      }
      
      if (!user?.id && !userId) return;
      
      const ownerId = user?.role === 'cashier' ? user?.tenantId : (user?.id || userId);
      
      try {
        if (token) {
          const allSettings = await storeSettingsAPI.load(token);
          if (allSettings.invoiceA4Design) {
            setLoadedDesignSettings(allSettings.invoiceA4Design);
            return;
          }
        }
      } catch (error) {
        console.warn('Could not load invoice design settings from API:', error);
      }
      
      // Fallback to localStorage
      try {
        const storedSettings = localStorage.getItem(`idcashier_invoice_a4_design_${ownerId}`);
        if (storedSettings) {
          setLoadedDesignSettings(JSON.parse(storedSettings));
        }
      } catch (localStorageError) {
        console.warn('Could not load design settings from localStorage:', localStorageError);
      }
    };
    
    loadDesignSettings();
  }, [user, token, userId]); // Removed designSettings from dependency array since it causes re-loads
  
  // Merge all settings with priority: prop > loaded > defaults
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
    invoicePrefix: companyInfo?.invoicePrefix || mergedSettings.invoicePrefix || 'INV',
    bankAccount: companyInfo?.bankAccount || '',
    bankName: companyInfo?.bankName || '',
    accountHolder: companyInfo?.accountHolder || '',
    businessOwnerName: companyInfo?.businessOwnerName || '',
    position: companyInfo?.position || ''
  };

  // Format date in Indonesian locale
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format currency using dynamic currency code
  const formatCurrency = (amount) => {
    return formatCurrencyUtil(amount, currencyCode, useTwoDecimals);
  };

  // Ensure logo is always displayed with a fallback
  const getLogoSrc = () => {
    if (safeCompanyInfo.logoUrl && safeCompanyInfo.logoUrl !== '') {
      return safeCompanyInfo.logoUrl;
    }
    return '/logo.png';
  };

  // Calculate totals
  const discountPercent = Number(sale.discount_percent || 0);
  const taxPercent = Number(sale.tax_percent || 0);
  const subtotal = Number(sale.subtotal || 0);
  const discountAmount = sale.discount_amount !== undefined
    ? Number(sale.discount_amount)
    : subtotal * (discountPercent / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = sale.tax_amount !== undefined
    ? Number(sale.tax_amount)
    : taxableAmount * (taxPercent / 100);
  const totalAmount = Number(sale.total_amount || subtotal - discountAmount + taxAmount);

  // Get invoice number
  const invoiceNumber = safeCompanyInfo.invoicePrefix 
    ? `${safeCompanyInfo.invoicePrefix}-${sale.id || 'TEMP'}`
    : `INV-${sale.id || 'TEMP'}`;

  return (

    <div ref={ref} className="printable-invoice-area">
      <div
        className="invoice-container mx-auto"
        style={{
          width: '21cm',
          minHeight: '29.7cm',
          padding: '20mm 15mm',
          backgroundColor: mergedSettings.bgColor || '#ffffff',
          color: mergedSettings.fontColor || '#000000',
          fontFamily: mergedSettings.fontFamily || 'sans-serif',
          fontSize: `${mergedSettings.fontSize || 14}px`
        }}
      >
        {/* INVOICE Title and Number - Position based on titleAlign setting */}
        <header style={{ textAlign: mergedSettings.titleAlign || 'center', marginBottom: '20px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            margin: '0',
            color: mergedSettings.fontColor || '#000000'
          }}>
            {t('invoiceTitle')}
          </h1>
          {mergedSettings.showInvoiceNumber !== false && (
            <p style={{ ...userDataStyle, marginTop: '4px', fontSize: '14px' }}>{invoiceNumber}</p>
          )}
        </header>


        {/* Logo Section */}
        {mergedSettings.showLogo !== false && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e0e0' }}>
              {safeCompanyInfo.logoUrl && safeCompanyInfo.logoUrl !== '' ? (
                <img 
                  src={safeCompanyInfo.logoUrl} 
                  alt={t('companyLogoAlt') || 'Company Logo'} 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `<span style="color: #808080; font-weight: bold; font-size: 14px;">${t('logo')}</span>`;
                  }}
                />
              ) : (
                <span style={{ color: '#808080', fontWeight: 'bold', fontSize: '14px' }}>{t('logo')}</span>
              )}
            </div>
          </div>
        )}

        {/* Company Info and Recipient Section */}
        <section style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          {/* Left: Company Info */}
          {mergedSettings.showCompanyInfo !== false && (
            <div style={{ maxWidth: '45%' }}>
              {/* Company Name */}
              <p style={{ ...userDataStyle, fontSize: '18px', marginBottom: '8px' }}>
                {safeCompanyInfo.name || t('defaultCompanyName')}
              </p>
              
              {/* Address */}
              {safeCompanyInfo.address && (
                <div style={{ display: 'flex', marginBottom: '4px' }}>
                  <span style={{ width: '60px' }}>{t('address')}</span>
                  <span style={{ marginRight: '8px' }}>:</span>
                  <span style={userDataStyle}>{safeCompanyInfo.address}</span>
                </div>
              )}
              
              {/* Phone */}
              {safeCompanyInfo.phone && (
                <div style={{ display: 'flex', marginBottom: '8px' }}>
                  <span style={{ width: '60px' }}>{t('phone')}</span>
                  <span style={{ marginRight: '8px' }}>:</span>
                  <span style={userDataStyle}>{safeCompanyInfo.phone}</span>
                </div>
              )}
              
              {/* Date */}
              {mergedSettings.showDate !== false && (
                <div style={{ display: 'flex', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', width: '150px' }}>{t('dateLabel')}:</span>
                  <span>{formatDate(sale.created_at)}</span>
                </div>
              )}
              
              {/* Due Date */}
              {mergedSettings.showDueDate !== false && (
                <div style={{ display: 'flex' }}>
                  <span style={{ fontWeight: 'bold', width: '150px' }}>{t('showDueDate') || t('dueDate') || 'Due Date'}:</span>
                  <span>{sale.due_date ? formatDate(sale.due_date) : formatDate(sale.created_at)}</span>
                </div>
              )}
            </div>
          )}

          {/* Right: Customer Info (Kepada) */}
          {mergedSettings.showCustomerInfo !== false && (
            <div style={{ maxWidth: '45%' }}>
              <p style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>{t('to')}:</p>
              
              {/* Customer Name */}
              {sale.customer && sale.customer.name && sale.customer.name !== 'Pelanggan Umum' && sale.customer.name !== 'Default Customer' && sale.customer.name !== '默认客户' ? (
                <>
                  <p style={{ ...userDataStyle, fontSize: '18px', marginBottom: '8px' }}>
                    {sale.customer.name}
                  </p>
                  
                  {/* Customer Address */}
                  {mergedSettings.showCustomerAddress !== false && sale.customer.address && (
                    <div style={{ display: 'flex', marginBottom: '4px' }}>
                      <span style={{ width: '60px' }}>{t('address')}</span>
                      <span style={{ marginRight: '8px' }}>:</span>
                      <span style={userDataStyle}>{sale.customer.address}</span>
                    </div>
                  )}
                  
                  {/* Customer Phone */}
                  {mergedSettings.showCustomerPhone !== false && sale.customer.phone && (
                    <div style={{ display: 'flex' }}>
                      <span style={{ width: '60px' }}>{t('phone')}</span>
                      <span style={{ marginRight: '8px' }}>:</span>
                      <span style={userDataStyle}>{sale.customer.phone}</span>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ ...userDataStyle, fontSize: '18px' }}>
                  {t('defaultCustomer')}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Items Table Section */}
        <section style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${mergedSettings.tableBorderColor || '#000000'}` }}>
                {mergedSettings.colNumber !== false && (
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', width: '8%' }}>{t('expenseNumber') || 'No.'}</th>
                )}
                {mergedSettings.colItem !== false && (
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', width: '42%' }}>{t('descriptionLabel')}</th>
                )}
                {mergedSettings.colPrice !== false && (
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', width: '20%' }}>{t('priceLabel')}</th>
                )}
                {mergedSettings.colQty !== false && (
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', width: '10%' }}>{t('qtyLabel')}</th>
                )}
                {mergedSettings.colTotal !== false && (
                  <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', width: '20%' }}>{t('totalLabel')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => {
                const itemSubtotal = item.price * item.quantity;
                return (
                  <tr key={index} style={{ borderBottom: `1px solid ${mergedSettings.tableBorderColor || '#e5e5e5'}` }}>
                    {mergedSettings.colNumber !== false && (
                      <td style={{ padding: '10px 8px', textAlign: 'left' }}>{index + 1}</td>
                    )}
                    {mergedSettings.colItem !== false && (
                      <td style={{ padding: '10px 8px', textAlign: 'left' }}>{item.product_name || item.name}</td>
                    )}
                    {mergedSettings.colPrice !== false && (
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                    )}
                    {mergedSettings.colQty !== false && (
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{item.quantity}</td>
                    )}
                    {mergedSettings.colTotal !== false && (
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatCurrency(itemSubtotal)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Summary Section - Right aligned */}
        <section style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div style={{ width: '280px' }}>
            {mergedSettings.showSubtotal !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontWeight: 'bold' }}>{t('subtotalLabel')}</span>
                <span>:</span>
                <span style={{ minWidth: '100px', textAlign: 'right' }}>{formatCurrency(subtotal)}</span>
              </div>
            )}
            {mergedSettings.showTax !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontWeight: 'bold' }}>{t('taxLabel')}</span>
                <span>:</span>
                <span style={{ minWidth: '100px', textAlign: 'right' }}>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            {mergedSettings.showDiscount !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ fontWeight: 'bold' }}>{t('discountLabel')}</span>
                <span>:</span>
                <span style={{ minWidth: '100px', textAlign: 'right' }}>{formatCurrency(discountAmount)}</span>
              </div>
            )}
            {mergedSettings.showTotal !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #000', marginTop: '4px' }}>
                <span style={{ fontWeight: 'bold' }}>{t('totalLabel')}</span>
                <span>:</span>
                <span style={{ minWidth: '100px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Footer Section - Notes/Payment Info on Left, Signature on Right */}
        <footer style={{ display: 'flex', justifyContent: 'space-between' }}>
          {/* Left: Notes and Payment Info */}
          <div style={{ maxWidth: '50%' }}>
            {/* Notes */}
            {mergedSettings.showNotes !== false && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>{t('notes')}:</p>
                <p style={{ fontSize: '14px', color: '#4b5563' }}>{sale.notes || ''}</p>
              </div>
            )}
            
            {/* Payment Information */}
            {mergedSettings.showBankInfo !== false && (
              <div>
                <p style={{ fontWeight: 'bold', marginBottom: '12px' }}>{t('paymentInfo')}:</p>
                
                {/* Account Number */}
                <div style={{ display: 'flex', marginBottom: '6px' }}>
                  <span style={{ width: '180px' }}>{t('accountNumber')}</span>
                  <span style={{ marginRight: '8px' }}>:</span>
                  <span style={userDataStyle}>{safeCompanyInfo.bankAccount || ''}</span>
                </div>
                
                {/* Account Holder */}
                <div style={{ display: 'flex', marginBottom: '6px' }}>
                  <span style={{ width: '180px' }}>{t('accountHolderName')}</span>
                  <span style={{ marginRight: '8px' }}>:</span>
                  <span style={userDataStyle}>{safeCompanyInfo.accountHolder || ''}</span>
                </div>
                
                {/* Bank Name */}
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '180px' }}>{t('bankName')}</span>
                  <span style={{ marginRight: '8px' }}>:</span>
                  <span style={userDataStyle}>{safeCompanyInfo.bankName || ''}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Right: Signature */}
          {mergedSettings.showSignatures !== false && (
            <div style={{ textAlign: 'center', minWidth: '200px', marginTop: '40px' }}>
              {/* Hormat Kami */}
              <p style={{ marginBottom: '60px' }}>{t('sincerely')},</p>
              
              {/* Name - from account settings (dynamic) */}
              <p style={{ ...userDataStyle, marginBottom: '4px' }}>
                {user?.name || user?.full_name || safeCompanyInfo.businessOwnerName || t('ownerName')}
              </p>
              
              {/* Signature Line - solid continuous line */}
              <div style={{ 
                borderBottom: `1px solid ${mergedSettings.fontColor || '#000000'}`,
                width: '150px',
                margin: '0 auto 4px auto'
              }} />
              
              {/* Position - from settings (dynamic) */}
              <p style={userDataStyle}>
                {safeCompanyInfo.position || t('position')}
              </p>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
});

InvoiceA4.displayName = 'InvoiceA4';

export default InvoiceA4;
