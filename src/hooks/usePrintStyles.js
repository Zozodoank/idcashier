import { useEffect } from 'react';

/**
 * Custom hook untuk inject CSS print secara dinamis
 * Hanya CSS untuk tipe yang dipilih yang dimuat ke <head>
 * Otomatis cleanup saat unmount atau type berubah
 */
export const usePrintStyles = (printType) => {
  useEffect(() => {
    if (!printType) return;

    // Definisikan CSS untuk setiap tipe cetak
    const styles = {
      'invoice-a4': `
        @media print {
          @page { 
            size: A4; 
            margin: 15mm; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          [role="dialog"], 
          [role="dialog"] * { 
            visibility: visible; 
          }
          
          [role="dialog"] {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            transform: none !important;
          }
          
          .printable-invoice-area,
          .printable-invoice-area * {
            visibility: visible;
          }
          
          .invoice-container {
            padding: 20px !important;
            font-size: 14px;
            color: #000 !important;
            background: #fff !important;
          }
          
          .invoice-container table th,
          .invoice-container table td {
            padding: 8px;
            font-size: 13px;
          }
          
          .invoice-container h1,
          .invoice-container h2 {
            font-size: 18px;
          }
        }
      `,
      
      'thermal-58mm': `
        @media print {
          @page { 
            size: 58mm 200mm; 
            margin: 2mm; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          [role="dialog"], 
          [role="dialog"] * { 
            visibility: visible; 
          }
          
          .receipt-printable,
          .receipt-printable * {
            visibility: visible !important;
          }
          
          .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 54mm !important;
            padding: 5px !important;
            font-size: 10px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
          }
          
          .receipt-printable img {
            max-width: 48px !important;
            margin: 0 auto !important;
          }
          
          .receipt-printable table th,
          .receipt-printable table td {
            padding: 2px 4px !important;
            font-size: 9px !important;
          }
          
          .receipt-printable hr {
            margin: 5px 0 !important;
          }
        }
      `,
      
      'thermal-80mm': `
        @media print {
          @page { 
            size: 80mm 200mm; 
            margin: 2mm; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          [role="dialog"], 
          [role="dialog"] * { 
            visibility: visible; 
          }
          
          .receipt-printable,
          .receipt-printable * {
            visibility: visible !important;
          }
          
          .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 76mm !important;
            padding: 10px !important;
            font-size: 12px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
          }
          
          .receipt-printable img {
            max-width: 64px !important;
            margin: 0 auto !important;
          }
          
          .receipt-printable table th,
          .receipt-printable table td {
            padding: 3px 5px !important;
            font-size: 11px !important;
          }
          
          .receipt-printable hr {
            margin: 8px 0 !important;
          }
        }
      `,
      
      'thermal-a4': `
        @media print {
          @page { 
            size: A4; 
            margin: 10mm; 
          }
          
          body * { 
            visibility: hidden; 
          }
          
          [role="dialog"], 
          [role="dialog"] * { 
            visibility: visible; 
          }
          
          .receipt-printable,
          .receipt-printable * {
            visibility: visible !important;
          }
          
          .receipt-printable {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 300px !important;
            margin: 0 auto !important;
            padding: 15px !important;
            font-size: 12px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
            border: 1px dashed #ccc !important;
          }
          
          .receipt-printable table th,
          .receipt-printable table td {
            padding: 4px 6px !important;
            font-size: 11px !important;
          }
        }
      `,
    };

    // Buat elemen <style> dan tambahkan ke <head>
    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-print-styles';
    styleElement.innerHTML = styles[printType] || '';
    document.head.appendChild(styleElement);

    // Cleanup: hapus style saat unmount atau printType berubah
    return () => {
      const existingStyle = document.getElementById('dynamic-print-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [printType]);
};

