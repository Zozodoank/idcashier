import React, { forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyUtil, getCurrencyFromStorage } from '@/lib/utils';

const DeliveryNote = forwardRef(({ sale, companyInfo, useTwoDecimals = true, showPrice = true, receiverName = '', senderName = '', context, userId }, ref) => {
  const { t } = useLanguage();
  
  // Get currency from storage
  const currencyCode = getCurrencyFromStorage(userId);

  // Ensure we have proper defaults
  const safeCompanyInfo = {
    name: companyInfo.name || 'Toko',
    address: companyInfo.address || '',
    phone: companyInfo.phone || '',
    logoUrl: companyInfo.logoUrl || companyInfo.logo || '/logo.png',
    bankAccount: companyInfo.bankAccount || '',
    bankName: companyInfo.bankName || '',
    accountHolder: companyInfo.accountHolder || '',
    businessOwnerName: companyInfo.businessOwnerName || '',
    invoicePrefix: companyInfo.invoicePrefix || ''
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
    // Fallback to default logo
    return '/logo.png';
  };

  // Ensure company info is displayed with fallbacks
  const companyName = safeCompanyInfo.name;
  const companyAddress = safeCompanyInfo.address;
  const companyPhone = safeCompanyInfo.phone;

  // Dynamic horizontal padding adjustments per page context
  const baseLeftCh = 8;
  const baseRightCh = 2;
  const leftCh = context === 'sales' ? Math.max(0, baseLeftCh - 3) : context === 'reports' ? Math.max(0, baseLeftCh - 2) : baseLeftCh;
  const rightCh = context === 'reports' ? Math.max(0, baseRightCh - 2) : baseRightCh;

  return (
    <div ref={ref} className="printable-invoice-area">
      <div
        className="invoice-container bg-white mx-auto font-sans"
        style={{
          width: '21cm',
          minHeight: '29.7cm',
          paddingTop: '25mm',
          paddingBottom: '25mm',
          paddingLeft: `${leftCh}ch`,
          paddingRight: `${rightCh}ch`
        }}
      >
        {/* Header Section */}
        <header className="mb-6">
          {/* Header dengan Logo di Kiri dan Info di Tengah */}
          <div className="flex items-start mb-6">
            {/* Logo di Kiri */}
            <div className="mr-6">
              <img 
                src={getLogoSrc()} 
                alt={t('companyLogoAlt')} 
                className="h-20 w-auto"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            
            {/* Info Perusahaan di Tengah (flex-1 untuk mengambil sisa space) */}
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold text-gray-800 mb-1">{companyName}</h1>
              {companyAddress && <p className="text-xs text-gray-600">{companyAddress}</p>}
              {companyPhone && <p className="text-xs text-gray-600">Wa: {companyPhone}</p>}
              {safeCompanyInfo.bankAccount && safeCompanyInfo.bankName && (
                <p className="text-xs text-gray-600">
                  No rek: {safeCompanyInfo.bankName} {safeCompanyInfo.bankAccount} 
                  {safeCompanyInfo.accountHolder && ` A/n ${safeCompanyInfo.accountHolder}`}
                </p>
              )}
            </div>
          </div>

          {/* Judul SURAT JALAN tanpa border */}
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold uppercase tracking-wider text-gray-900">
              {t('deliveryNote') || 'SURAT JALAN'}
            </h2>
          </div>

          {/* Info Tanggal, Nomor, Nama Supplier dengan spacing tetap */}
          <div className="mb-4 text-sm">
            <p>
              <span className="inline-block font-semibold" style={{width: '120px'}}>Tanggal</span>
              <span>: {formatDate(sale.created_at)}</span>
            </p>
            <p>
              <span className="inline-block font-semibold" style={{width: '120px'}}>Nomor</span>
              <span>: {safeCompanyInfo.invoicePrefix ? `${safeCompanyInfo.invoicePrefix}/${sale.id}` : sale.id}</span>
            </p>
            <p>
              <span className="inline-block font-semibold" style={{width: '120px'}}>Nama Supplier</span>
              <span>: {companyName}{safeCompanyInfo.businessOwnerName && ` (${safeCompanyInfo.businessOwnerName})`}</span>
            </p>
          </div>
        </header>

        {/* Body Section - Items Table */}
        <main className="mb-8">
          <table className="w-full text-left text-xs border border-gray-800">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-2 font-bold text-gray-800 text-center border-r border-gray-800" style={{ width: '40px' }}>
                  NO
                </th>
                <th className="p-2 font-bold text-gray-800 text-center border-r border-gray-800" style={{ width: '100px' }}>
                  KODE
                </th>
                <th className="p-2 font-bold text-gray-800 border-r border-gray-800">
                  Nama Produk
                </th>
                <th className="p-2 font-bold text-gray-800 text-center border-r border-gray-800" style={{ width: '60px' }}>
                  QTY
                </th>
                {showPrice && (
                  <>
                    <th className="p-2 font-bold text-gray-800 text-center border-r border-gray-800" style={{ width: '100px' }}>
                      HARGA<br/>SATUAN
                    </th>
                    <th className="p-2 font-bold text-gray-800 text-center border-r border-gray-800" style={{ width: '80px' }}>
                      Dis 5%
                    </th>
                    <th className="p-2 font-bold text-gray-800 text-center" style={{ width: '100px' }}>
                      JUMLAH
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => {
                const itemTotal = item.quantity * item.price;
                const discount5 = itemTotal * 0.05;
                const totalAfterDiscount = itemTotal - discount5;
                
                return (
                  <tr key={index} className="border-b border-gray-800">
                    <td className="p-2 text-center border-r border-gray-800">{index + 1}</td>
                    <td className="p-2 text-center border-r border-gray-800">{item.barcode || item.product_barcode || '-'}</td>
                    <td className="p-2 border-r border-gray-800">{item.product_name}</td>
                    <td className="p-2 text-center border-r border-gray-800">{item.quantity}</td>
                    {showPrice && (
                      <>
                        <td className="p-2 text-right border-r border-gray-800">{formatCurrency(item.price)}</td>
                        <td className="p-2 text-right border-r border-gray-800">{formatCurrency(discount5)}</td>
                        <td className="p-2 text-right">{formatCurrency(totalAfterDiscount)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
              
              {/* Total Row */}
              {showPrice && (
                <tr className="font-bold border-t-2 border-gray-800">
                  <td colSpan="3" className="p-2 text-center border-r border-gray-800">Total</td>
                  <td className="p-2 text-center border-r border-gray-800">
                    {sale.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </td>
                  <td colSpan="2" className="p-2 border-r border-gray-800"></td>
                  <td className="p-2 text-right">
                    {formatCurrency(sale.total_amount || sale.items.reduce((sum, item) => {
                      const itemTotal = item.quantity * item.price;
                      return sum + (itemTotal * 0.95);
                    }, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </main>

        {/* Footer Section - Signature Area */}
        <section className="flex justify-between items-end mt-20 mb-12">
          {/* Penerima (Kiri) */}
          <div className="flex flex-col items-center">
            <div className="mb-16 h-16"></div>
            <div className="border-t-2 border-gray-800 w-48 mb-1"></div>
            <p className="text-sm font-semibold text-gray-700">Penerima</p>
            {receiverName && (
              <p className="text-xs text-gray-600 mt-1">({receiverName})</p>
            )}
          </div>

          {/* Pengirim (Kanan) */}
          <div className="flex flex-col items-center">
            <div className="mb-16 h-16"></div>
            <div className="border-t-2 border-gray-800 w-48 mb-1"></div>
            <p className="text-sm font-semibold text-gray-700">Pengirim</p>
            {senderName && (
              <p className="text-xs text-gray-600 mt-1">({senderName})</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
});

DeliveryNote.displayName = 'DeliveryNote';

export default DeliveryNote;

