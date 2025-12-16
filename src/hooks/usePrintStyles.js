import { useEffect } from 'react';

/**
 * Custom hook untuk inject CSS print secara dinamis
 * Hanya CSS untuk tipe yang dipilih yang dimuat ke <head>
 * Otomatis cleanup saat unmount atau type berubah
 */
export const usePrintStyles = (printType) => {
  useEffect(() => {
    if (!printType) return;

    const styles = {
      'invoice-a4': `
        @page {
          size: A4;
          margin: 15mm;
        }

        @media print {
          .invoice-container {
            width: 21cm !important;
            min-height: 29.7cm !important;
            padding: 25mm 2ch 25mm 8ch !important;
            font-size: 14px;
            color: #000 !important;
            background: #fff !important;
          }

          .invoice-container table th,
          .invoice-container table td {
            padding: 8px !important;
            font-size: 13px !important;
          }

          .invoice-container h1,
          .invoice-container h2 {
            font-size: 18px !important;
          }
        }
      `,

      'delivery-note': `
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          .invoice-container {
            width: 21cm !important;
            min-height: 29.7cm !important;
            padding: 25mm 2ch 25mm 8ch !important;
            font-size: 14px;
            color: #000 !important;
            background: #fff !important;
          }

          .invoice-container table th,
          .invoice-container table td {
            padding: 8px !important;
            font-size: 13px !important;
          }

          .invoice-container h1,
          .invoice-container h2 {
            font-size: 18px !important;
          }
        }
      `,

      'thermal-58mm': `
        @page {
          size: 58mm auto;
          margin: 0;
        }

        @media print {
          .receipt-printable {
            width: 58mm !important;
            margin: 0 !important;
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
            border: none !important;
          }

          .receipt-printable hr {
            margin: 5px 0 !important;
          }
        }
      `,

      'thermal-80mm': `
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          .receipt-printable {
            width: 80mm !important;
            margin: 0 !important;
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
            border: none !important;
          }

          .receipt-printable hr {
            margin: 8px 0 !important;
          }
        }
      `
    };

    const css = styles[printType];
    if (!css) {
      return;
    }

    const existingStyle = document.getElementById('dynamic-print-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'dynamic-print-styles';
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);

    return () => {
      const styleEl = document.getElementById('dynamic-print-styles');
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, [printType]);
};
