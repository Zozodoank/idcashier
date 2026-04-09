import { useEffect } from 'react';
import { getThermalReceiptLayout } from '@/lib/thermalReceiptLayout';

/**
 * Custom hook untuk inject CSS print secara dinamis
 * Hanya CSS untuk tipe yang dipilih yang dimuat ke <head>
 * Otomatis cleanup saat unmount atau type berubah
 */
export const usePrintStyles = (printType) => {
  useEffect(() => {
    if (!printType) return;

    const thermal58 = getThermalReceiptLayout('58mm');
    const thermal80 = getThermalReceiptLayout('80mm');

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
            padding: ${thermal58.verticalPaddingPx}px ${thermal58.defaultHorizontalPaddingPx}px !important;
            font-size: 10px !important;
            line-height: ${thermal58.lineHeight} !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
          }

          .receipt-printable img {
            max-width: ${thermal58.imageMaxWidthPx}px !important;
            margin: 0 auto !important;
          }

          .receipt-printable p,
          .receipt-printable h1,
          .receipt-printable h2,
          .receipt-printable h3,
          .receipt-printable table {
            margin: 0 !important;
          }

          .receipt-printable table th,
          .receipt-printable table td {
            padding: ${thermal58.printTableCellPadding} !important;
            font-size: 9px !important;
            border: none !important;
          }

          .receipt-printable hr {
            margin: ${thermal58.hrMarginYpx}px 0 !important;
          }

          .receipt-printable [data-thermal-logo] {
            margin-bottom: ${thermal58.noteGapPx}px !important;
          }

          .receipt-printable [data-thermal-item-separator="line"] {
            padding-bottom: ${thermal58.itemLineGapPx}px !important;
            margin-bottom: ${thermal58.itemLineGapPx}px !important;
          }

          .receipt-printable [data-thermal-item-separator="space"] {
            margin-bottom: ${thermal58.itemSpaceGapPx}px !important;
          }

          .receipt-printable [data-thermal-note] {
            margin-top: ${thermal58.noteGapPx}px !important;
          }

          .receipt-printable [data-thermal-barcode] {
            margin-bottom: ${thermal58.barcodeMarginBottomPx}px !important;
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
            padding: ${thermal80.verticalPaddingPx}px ${thermal80.defaultHorizontalPaddingPx}px !important;
            font-size: 12px !important;
            line-height: ${thermal80.lineHeight} !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
          }

          .receipt-printable img {
            max-width: ${thermal80.imageMaxWidthPx}px !important;
            margin: 0 auto !important;
          }

          .receipt-printable p,
          .receipt-printable h1,
          .receipt-printable h2,
          .receipt-printable h3,
          .receipt-printable table {
            margin: 0 !important;
          }

          .receipt-printable table th,
          .receipt-printable table td {
            padding: ${thermal80.printTableCellPadding} !important;
            font-size: 11px !important;
            border: none !important;
          }

          .receipt-printable hr {
            margin: ${thermal80.hrMarginYpx}px 0 !important;
          }

          .receipt-printable [data-thermal-logo] {
            margin-bottom: ${thermal80.noteGapPx}px !important;
          }

          .receipt-printable [data-thermal-item-separator="line"] {
            padding-bottom: ${thermal80.itemLineGapPx}px !important;
            margin-bottom: ${thermal80.itemLineGapPx}px !important;
          }

          .receipt-printable [data-thermal-item-separator="space"] {
            margin-bottom: ${thermal80.itemSpaceGapPx}px !important;
          }

          .receipt-printable [data-thermal-note] {
            margin-top: ${thermal80.noteGapPx}px !important;
          }

          .receipt-printable [data-thermal-barcode] {
            margin-bottom: ${thermal80.barcodeMarginBottomPx}px !important;
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
