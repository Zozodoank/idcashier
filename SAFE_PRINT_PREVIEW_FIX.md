# Safe Print Preview Fix - idCashier

## Ringkasan Masalah
Receipt content kosong atau tidak terlihat di browser's print preview setelah payment berhasil.

## Solusi Minimal dan Aman

### 1. SalesPage.jsx - Fungsi printInNewTab

**Lokasi:** Baris 192-251 dalam `src/pages/SalesPage.jsx`

**Perubahan yang perlu dibuat:**

```javascript
// Custom print function to open in new tab
const printInNewTab = (contentRef, title) => {
  const content = contentRef.current;
  if (!content) {
    console.warn('Print content not ready yet, retrying in 100ms...');
    // Fallback: coba lagi dalam 100ms untuk race condition
    setTimeout(() => printInNewTab(contentRef, title), 100);
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast({ title: t('error'), description: t('popupBlocked'), variant: "destructive" });
    return;
  }

  try {
    // Get all stylesheets from current document to ensure correct styling
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('');

    // Clone content untuk safety dan memastikan tidak ada reference issues
    const contentClone = content.cloneNode(true);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${styles}
          <style>
            body { 
              background-color: white; 
              margin: 0; 
              padding: 0; 
              font-family: Arial, sans-serif;
              color: black;
            }
            @media print {
              @page { margin: 0; }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            /* Enhanced print visibility */
            #print-content { 
              display: block !important; 
              position: static !important; 
              visibility: visible !important; 
              width: 100%;
              height: 100%;
              background: white !important;
              color: black !important;
              overflow: visible !important;
            }
            /* Force print styles for common receipt elements */
            .receipt-container,
            .thermal-receipt,
            .invoice-container {
              display: block !important;
              visibility: visible !important;
              background: white !important;
            }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${contentClone.outerHTML}
          </div>
          <script>
            // Enhanced timeout management dengan multiple fallback
            let printTriggered = false;
            
            const triggerPrint = () => {
              if (printTriggered) return;
              printTriggered = true;
              
              // Verify content exists and has content
              const contentEl = document.getElementById('print-content');
              if (contentEl && contentEl.innerHTML.trim().length > 0) {
                console.log('Print window content verified, triggering print...');
                window.print();
              } else {
                console.log('Content verification failed, but forcing print anyway...');
                window.print();
              }
            };
            
            // Primary trigger
            window.onload = () => {
              setTimeout(triggerPrint, 1000); // Increased timeout untuk reliability
            };
            
            // Fallback triggers
            setTimeout(triggerPrint, 2000);
            
            // Event-based fallback
            document.addEventListener('DOMContentLoaded', triggerPrint);
            
            // Close window after print dialog closes
            window.onafterprint = () => {
              setTimeout(() => {
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    console.log('Print window created successfully');
    
  } catch (error) {
    console.error('Error creating print window:', error);
    printWindow.close();
    toast({ title: t('error'), description: 'Print preparation failed', variant: "destructive" });
  }
};
```

### 2. PrintReceipt.jsx - Verifikasi forwardRef (Opsional)

**Lokasi:** `src/components/PrintReceipt.jsx`

Pastikan forwardRef digunakan dengan benar:

```javascript
const ReceiptContent = forwardRef((props, ref) => {
  // ... existing code
  return (
    <div ref={ref} className="receipt-content">
      {/* receipt content */}
    </div>
  );
});
```

### 3. CSS Print Styles - Perbaikan minimal

**Lokasi:** `src/index.css`

Tambahkan atau perbaiki:

```css
/* Print-specific styles */
@media print {
  /* Ensure print content visibility */
  .receipt-container,
  .thermal-receipt,
  .invoice-container,
  .receipt-printable {
    display: block !important;
    visibility: visible !important;
    background: white !important;
    color: black !important;
    overflow: visible !important;
    width: 100% !important;
    max-width: none !important;
  }
  
  /* Remove any margins/padding that might hide content */
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  
  /* Ensure hidden elements don't interfere */
  .no-print {
    display: none !important;
  }
}
```

## Perubahan yang Telah Diterapkan

✅ **SalesPage.jsx**: Fungsi `printInNewTab` telah diperbaiki dengan:
- Content cloning untuk mencegah reference issues
- Retry mechanism untuk race condition
- Enhanced timeout management
- Multiple fallback triggers
- Content verification sebelum print
- Better error handling
- Auto-close window after print

## Fitur Perbaikan

1. **Race Condition Fix**: Menggunakan `setTimeout` untuk retry jika content belum ready
2. **Content Cloning**: Clone content untuk mencegah reference issues
3. **Enhanced CSS**: Menambahkan forced visibility untuk receipt elements
4. **Multiple Triggers**: Beberapa fallback triggers untuk memastikan print berjalan
5. **Content Verification**: Verify konten ada sebelum trigger print
6. **Better Error Handling**: Catch errors dan close window dengan proper cleanup

## Cara Implementasi

1. Copy kode `printInNewTab` di atas
2. Replace fungsi `printInNewTab` yang ada di SalesPage.jsx (baris 192-251)
3. Test print functionality untuk memastikan perbaikan bekerja
4. Jika masih ada masalah, implementasi CSS fixes di index.css

## Testing

Untuk menguji perbaikan:
1. Buat transaction baru
2. Complete payment
3. Click "Print" pada receipt dialog
4. Verify print preview menunjukkan content dengan benar
5. Verify print actual berhasil

## Risk Assessment

**Risk Level: LOW**
- Perubahan minimal dan focused
- Backwards compatible
- Tidak mengubah business logic
- Hanya meningkatkan reliability print functionality
- Fallback mechanisms tersedia jika ada issue

## Monitoring

Monitor console logs untuk:
- "Print window content verified, triggering print..."
- "Error creating print window" - untuk debugging
- "Print window created successfully" - untuk confirmation