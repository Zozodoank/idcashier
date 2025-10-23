import React, { forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const InvoiceA4 = forwardRef(({ sale, companyInfo, useTwoDecimals = true }, ref) => {
  const { t } = useLanguage();

  // Ensure we have proper defaults
  const safeCompanyInfo = {
    name: companyInfo.name || 'Toko',
    address: companyInfo.address || '',
    phone: companyInfo.phone || '',
    logoUrl: companyInfo.logoUrl || companyInfo.logo || '/logo.png'
  };

  // Format date in Indonesian locale
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format currency in Indonesian Rupiah
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: useTwoDecimals ? 2 : 0,
      maximumFractionDigits: useTwoDecimals ? 2 : 0
    }).format(amount);
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

  return (
    <div ref={ref} className="printable-invoice-area">
      <div className="invoice-container bg-white p-8 rounded-lg shadow-lg w-full mx-auto font-sans">
        {/* Header Section */}
        <header className="mb-8">
          {/* Baris Atas: Logo & Info Perusahaan di Kiri, Tanggal di Kanan */}
          <div className="flex justify-between items-start mb-4">
            {/* Kiri: Logo dan Info Perusahaan */}
            <div className="text-left">
              <img 
                src={getLogoSrc()} 
                alt={t('companyLogoAlt')} 
                className="h-16 w-auto mb-4"
                onError={(e) => {
                  // If even the fallback fails, show no logo
                  e.target.style.display = 'none';
                }}
              />
              <h1 className="text-xl font-bold text-gray-800">{companyName}</h1>
              {companyAddress && <p className="text-sm text-gray-600">{companyAddress}</p>}
              {companyPhone && <p className="text-sm text-gray-600">{t('phoneLabel')}: {companyPhone}</p>
}
            </div>
            
            {/* Kanan: Tanggal Invoice */}
            <div className="text-right">
              <p className="text-sm text-gray-600">{t('invoiceDateLabel')}:</p>
              <p className="text-md text-gray-800 mb-4">{formatDate(sale.created_at)}</p>
              {/* Customer Information */}
              {sale.customer && sale.customer.name && sale.customer.name !== 'Pelanggan Umum' && sale.customer.name !== 'Default Customer' && sale.customer.name !== '默认客户' && (
                <div className="text-right">
                  <p className="text-md font-bold text-gray-800">{sale.customer.name}</p>
                  {sale.customer.address && (
                    <p className="text-sm text-gray-600">{sale.customer.address}</p>
                  )}
                  {sale.customer.phone && (
                    <p className="text-sm text-gray-600">{t('phoneLabel')}: {sale.customer.phone}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Baris Tengah: Judul "INVOICE" */}
          <div className="text-center my-8">
            <h2 className="text-3xl font-bold uppercase tracking-wider text-gray-900">{t('invoiceTitle')}</h2>
          </div>
        </header>

        {/* Body Section - Items Table */}
        <main className="mb-8">
          <table className="w-full text-left text-base border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-3 font-bold uppercase text-gray-700">{t('descriptionLabel')}</th>
                <th className="p-3 font-bold uppercase text-gray-700">Barcode</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-center">{t('quantityLabel')}</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-right">Harga</th>
                <th className="p-3 font-bold uppercase text-gray-700 text-right">{t('subtotalLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => {
                const subtotal = item.price * item.quantity;
                return (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3">{item.barcode || '-'}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                    <td className="p-3 text-right">{formatCurrency(subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </main>

        {/* Totals Section */}
        <section className="flex justify-end mb-2">
          <div className="w-1/3 text-base">
            {sale.subtotal > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{t('subtotalLabel')}</span>
                <span className="font-bold text-gray-800">{formatCurrency(sale.subtotal)}</span>
              </div>
            )}
            {sale.discount_amount > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{t('discountLabel')}</span>
                <span className="font-bold text-gray-800">
                  {formatCurrency(sale.discount_amount)} {sale.discount_percent ? `(${sale.discount_percent}%)` : ''}
                </span>
              </div>
            )}
            {sale.tax_amount > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="text-gray-600">{t('taxLabel')}</span>
                <span className="font-bold text-gray-800">
                  {formatCurrency(sale.tax_amount)} {sale.tax_percent ? `(${sale.tax_percent}%)` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-300">
              <span className="text-gray-600">{t('totalLabel')}</span>
              <span className="font-bold text-gray-800">{formatCurrency(sale.total_amount)}</span>
            </div>
          </div>
        </section>

        {/* Footer Section - No signature, clean finish */}
        <footer className="mt-8 pt-4">
          <p className="text-center text-sm text-gray-500">{t('thankYouMessage') || 'Terima kasih atas pembelian Anda'}</p>
        </footer>
      </div>
    </div>
  );
});

InvoiceA4.displayName = 'InvoiceA4';

export default InvoiceA4;
