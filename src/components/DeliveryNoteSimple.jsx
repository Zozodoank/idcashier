import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

const DeliveryNoteSimple = forwardRef(({ 
  sale, 
  companyInfo, 
  vehicleNumber = '',
  showPrice = true,
  receiverName = '',
  senderName = '',
  showSignatureLine = true,
  showNameDottedLine = true,
  designSettings = {},
  customerIdMode = 'auto',
  manualCustomerId = '',
  useTwoDecimals
}, ref) => {
  const { t } = useLanguage();
  
  // Merge default settings with provided designSettings
  const settings = {
    showLogo: true,
    showCompanyInfo: true,
    showBorder: false,
    titleAlign: 'right',
    showDocNumber: true,
    invoiceFormat: 'SJ/2024/001234',
    showDate: true,
    dateFormat: 'DD MMMM YYYY',
    showPO: true,
    showDueDate: false,
    showDriver: true,
    showSender: true,
    showReceiver: true,
    colNumber: true,
    colBarcode: true,
    colItem: true,
    colQty: true,
    colUnit: true,
    colNotes: true,
    colPrice: false,
    colWeight: false,
    showSignatures: true,
    signSender: true,
    signReceiver: true,
    signDriver: false,
    signWarehouse: false,
    signFinance: false,
    signaturePosition: 'relative',
    namePosition: 'below-field',
    showNotes: true,
    showPrice: true,
    borderColor: '#000000',
    bgColor: '#ffffff',
    fontColor: '#000000',
    tableHeaderBg: '#000000',
    tableHeaderText: '#ffffff',
    tableBorderColor: '#000000',
    fontFamily: 'Inter',
    fontSize: 14,
    language: 'id',
    currency: 'IDR',
    decimalSeparator: ',',
    thousandSeparator: '.',
    decimalPlaces: typeof useTwoDecimals !== 'undefined' ? (useTwoDecimals ? 2 : 0) : 0,
    ...designSettings
  };

  // Override decimalPlaces if useTwoDecimals prop is explicitly provided
  if (typeof useTwoDecimals !== 'undefined') {
    settings.decimalPlaces = useTwoDecimals ? 2 : 0;
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: localeId });
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'Rp 0';
    
    const decimalPlaces = settings.decimalPlaces || 0;
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    }).format(amount);
    
    let result = formatted;
    if (settings.thousandSeparator !== '.') {
      result = result.replace(/\./g, settings.thousandSeparator);
    }
    if (settings.decimalSeparator !== ',' && decimalPlaces > 0) {
      result = result.replace(/,/g, settings.decimalSeparator);
    }
    
    const currencySymbol = settings.currency === 'USD' ? '$' : 
                          settings.currency === 'EUR' ? '€' : 
                          settings.currency === 'CNY' ? '¥' : 'Rp';
    
    return `${currencySymbol} ${result}`;
  };

  // Count visible columns
  const visibleColumns = [
    settings.colNumber,
    settings.colBarcode,
    settings.colItem,
    settings.colQty,
    settings.colUnit,
    showPrice, // Replaces colNotes/colPrice
    settings.colWeight
  ].filter(Boolean).length;

  return (
    <div ref={ref} style={{ 
      width: '210mm', 
      minHeight: '148mm',
      padding: '10mm',
      backgroundColor: settings.bgColor,
      fontFamily: settings.fontFamily,
      fontSize: `${settings.fontSize}px`,
      color: settings.fontColor,
      boxSizing: 'border-box',
      border: settings.showBorder ? `2px solid ${settings.borderColor}` : 'none'
    }}>
      
      {/* Header */}
      <div style={{ 
        marginBottom: '5mm', 
        borderBottom: `2px solid ${settings.borderColor}`, 
        paddingBottom: '3mm' 
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start' 
        }}>
          <div style={{ flex: 1 }}>
            {settings.showLogo && companyInfo?.logo && (
              <img src={companyInfo.logo} alt="Logo" style={{ maxHeight: '15mm', marginBottom: '2mm' }} />
            )}
            {settings.showCompanyInfo && (
              <>
                <div style={{ fontWeight: 'bold', fontSize: `${settings.fontSize + 2}px` }}>
                  {companyInfo?.name || 'Nama Perusahaan'}
                </div>
                <div style={{ fontSize: `${settings.fontSize - 2}px`, marginTop: '1mm' }}>
                  {companyInfo?.address || ''}
                </div>
                <div style={{ fontSize: `${settings.fontSize - 2}px` }}>
                  Telp: {companyInfo?.phone || ''}
                </div>
              </>
            )}
          </div>
          <div style={{ textAlign: settings.titleAlign || 'right' }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: `${settings.fontSize + 5}px`, 
              marginBottom: '2mm' 
            }}>
              {t('deliveryNoteTitle')}
            </div>
            {settings.showDocNumber && (
              <div style={{ fontSize: `${settings.fontSize - 2}px` }}>
                {t('expenseNumber') || 'No'}: {sale?.invoice_number || settings.invoiceFormat || 'SJ/2024/001'}
              </div>
            )}
            {settings.showDate && (
              <div style={{ fontSize: `${settings.fontSize - 2}px` }}>
                {t('dateLabel')}: {formatDate(sale?.created_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Info */}
      <div style={{ marginBottom: '5mm', display: 'flex', gap: '10mm' }}>
        {settings.showReceiver && (
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{t('to')}:</div>
            <div style={{ fontSize: `${settings.fontSize + 4}px`, fontWeight: 'bold' }}>{sale?.customer?.name || 'Customer'}</div>
            {/* Customer ID Display */}
            {((customerIdMode === 'manual' && manualCustomerId) || (customerIdMode === 'auto' && (sale?.customer?.member_id || sale?.customer?.id))) && (
               <div style={{ fontSize: `${settings.fontSize - 2}px`, fontWeight: 'normal' }}>
                 ID Pelanggan: {customerIdMode === 'manual' ? manualCustomerId : (sale?.customer?.member_id || sale?.customer?.id)}
               </div>
            )}
            <div style={{ fontSize: `${settings.fontSize - 2}px`, fontWeight: 'normal' }}>{sale?.customer?.address || ''}</div>
            <div style={{ fontSize: `${settings.fontSize - 2}px`, fontWeight: 'normal' }}>{sale?.customer?.phone || ''}</div>
          </div>
        )}
        {settings.showDriver && vehicleNumber && (
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{t('vehicle')}:</div>
            <div>{vehicleNumber}</div>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        marginBottom: '5mm'
      }}>
        <thead>
          <tr style={{ 
            backgroundColor: settings.tableHeaderBg, 
            color: settings.tableHeaderText 
          }}>
            {settings.colNumber && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'center', 
                width: '8%' 
              }}>{t('expenseNumber') || 'No'}</th>
            )}
            {settings.colBarcode && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'center',
                width: '15%'
              }}>{t('barcode') || 'Barcode'}</th>
            )}
            {settings.colItem && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'left' 
              }}>{t('productLabel')}</th>
            )}
            {settings.colQty && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'center', 
                width: '12%' 
              }}>{t('qtyLabel')}</th>
            )}
            {settings.colUnit && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'center', 
                width: '10%' 
              }}>{t('unit')}</th>
            )}
            {/* Notes column replaced by Price/Total as requested */}
            {showPrice && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'right', 
                width: '15%' 
              }}>{t('priceLabel')}</th>
            )}
            {settings.colWeight && (
              <th style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'center', 
                width: '10%' 
              }}>{t('weight')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sale?.items?.map((item, index) => (
            <tr key={index}>
              {settings.colNumber && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'center' 
                }}>{index + 1}</td>
              )}
              {settings.colBarcode && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'center'
                }}>{item.barcode || item.product?.barcode || '-'}</td>
              )}
              {settings.colItem && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm' 
                }}>{item.product_name || item.name}</td>
              )}
              {settings.colQty && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'center' 
                }}>{item.quantity}</td>
              )}
              {settings.colUnit && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'center' 
                }}>{item.unit || 'pcs'}</td>
              )}
              {showPrice && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'right' 
                }}>{formatCurrency(item.price * item.quantity)}</td>
              )}
              {settings.colWeight && (
                <td style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'center' 
                }}>{item.weight || '-'}</td>
              )}
            </tr>
          )) || (
            <tr>
              <td 
                colSpan={visibleColumns} 
                style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '5mm', 
                  textAlign: 'center', 
                  fontStyle: 'italic' 
                }}
              >
                {t('noItemsFound')}
              </td>
            </tr>
          )}
        </tbody>
        {showPrice && sale?.items?.length > 0 && (
          <tfoot>
            <tr style={{ fontWeight: 'bold' }}>
              <td 
                colSpan={visibleColumns - 1} 
                style={{ 
                  border: `1px solid ${settings.tableBorderColor}`, 
                  padding: '2mm', 
                  textAlign: 'right' 
                }}
              >{t('totalLabel')}:</td>
              <td style={{ 
                border: `1px solid ${settings.tableBorderColor}`, 
                padding: '2mm', 
                textAlign: 'right' 
              }}>
                {formatCurrency(sale?.total_amount || 0)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Notes */}
      {settings.showNotes && sale?.notes && (
        <div style={{ marginBottom: '5mm', fontSize: `${settings.fontSize - 2}px` }}>
          <strong>{t('notes')}:</strong> {sale.notes}
        </div>
      )}

      {/* Signatures */}
      {settings.showSignatures && (
        <div style={{ 
          marginTop: '10mm',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10mm'
        }}>
          {/* Pengirim */}
          {settings.signSender && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ marginBottom: '1mm' }}>{t('sender')}</div>
              <div style={{ height: '15mm' }}></div>
              <div style={{ 
                borderTop: showSignatureLine ? `1px solid ${settings.fontColor}` : 'none', 
                paddingTop: '2mm',
                marginTop: '2mm',
                maxWidth: '120px',
                margin: '0 auto'
              }}>
                {senderName ? (
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{senderName}</p>
                ) : (
                  <p style={{ margin: 0 }}>                                    </p>
                )}
              </div>
            </div>
          )}

          {/* Penerima */}
          {settings.signReceiver && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ marginBottom: '1mm' }}>{t('receiver')}</div>
              <div style={{ height: '15mm' }}></div>
              <div style={{ 
                borderTop: showSignatureLine ? `1px solid ${settings.fontColor}` : 'none', 
                paddingTop: '2mm',
                marginTop: '2mm',
                maxWidth: '120px',
                margin: '0 auto'
              }}>
                {receiverName ? (
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{receiverName}</p>
                ) : (
                  <p style={{ margin: 0 }}>                                    </p>
                )}
              </div>
            </div>
          )}

          {/* Driver */}
          {settings.signDriver && vehicleNumber && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ marginBottom: '1mm' }}>{t('driver')}</div>
              <div style={{ height: '15mm' }}></div>
              <div style={{ 
                borderTop: showSignatureLine ? `1px solid ${settings.fontColor}` : 'none', 
                paddingTop: '2mm',
                marginTop: '2mm',
                maxWidth: '120px',
                margin: '0 auto'
              }}>
                {showNameDottedLine && (
                  null
                )}
                {!showNameDottedLine && (
                  <p style={{ margin: 0 }}></p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DeliveryNoteSimple.displayName = 'DeliveryNoteSimple';

export default DeliveryNoteSimple;
