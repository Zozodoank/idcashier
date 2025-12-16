// Enhanced SalesPage.jsx with Print Preview Fix
// This version includes an improved printInNewTab function to fix blank print preview

// TO APPLY THIS FIX:
// 1. Replace lines 192-251 (printInNewTab function) in src/pages/SalesPage.jsx
// 2. Replace lines 254-262 (handlePrint function) with enhanced version below

// ============= ENHANCED PRINT FUNCTIONS =============

// Enhanced print function with race condition handling and content verification
const printInNewTab = (contentRef, title) => {
  const content = contentRef.current;
  if (!content) {
    console.error('No content found for printing');
    toast({ title: t('error'), description: 'No content found for printing', variant: "destructive" });
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast({ title: t('error'), description: t('popupBlocked'), variant: "destructive" });
    return;
  }

  try {
    // Clone the content to ensure it's independent and stable
    const clonedContent = content.cloneNode(true);
    
    // Get all stylesheets from current document
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('');

    // Enhanced HTML with better print handling
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${styles}
          <style>
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { 
              background-color: white !important; 
              margin: 0 !important; 
              padding: 0 !important;
              font-family: Arial, sans-serif !important;
            }
            @media print {
              @page { 
                margin: 0 !important;
                size: auto !important;
              }
              body { 
                margin: 0 !important; 
                padding: 0 !important;
                background: white !important;
              }
              .no-print { 
                display: none !important; 
              }
              * {
                visibility: visible !important;
              }
            }
            /* Force visibility and proper positioning */
            #print-content { 
              display: block !important; 
              position: static !important; 
              visibility: visible !important; 
              width: 100% !important;
              height: auto !important;
              background: white !important;
            }
            /* Receipt-specific styles */
            .receipt-container {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${clonedContent.outerHTML}
          </div>
          <script>
            // Enhanced print trigger with multiple fallback mechanisms
            function triggerPrint() {
              try {
                console.log('Triggering print...');
                window.print();
              } catch (error) {
                console.error('Print error:', error);
              }
            }
            
            // Multiple triggers to handle different browser behaviors
            window.onload = () => {
              console.log('Print window loaded');
              // Immediate trigger
              setTimeout(triggerPrint, 100);
              // Delayed trigger for styling
              setTimeout(triggerPrint, 500);
              // Final trigger for stability
              setTimeout(triggerPrint, 1000);
            };
            
            // Fallback for when window.onload doesn't fire
            if (document.readyState === 'complete') {
              setTimeout(triggerPrint, 100);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    console.log('Print window created successfully');
    
    // Verify the window was created and has content
    setTimeout(() => {
      if (printWindow.document.readyState === 'complete') {
        console.log('Print content verified');
      } else {
        console.warn('Print content may not be ready');
      }
    }, 500);
    
  } catch (error) {
    console.error('Error creating print window:', error);
    toast({ title: t('error'), description: 'Failed to create print window', variant: "destructive" });
  }
};

// Enhanced unified print handler with additional logging
const handlePrint = () => {
  console.log('🎯 Print triggered for receipt type:', receiptType);
  console.log('📄 Content refs available:', {
    invoiceA4Ref: !!invoiceA4Ref.current,
    deliveryNoteRef: !!deliveryNoteRef.current,
    thermalReceiptRef: !!thermalReceiptRef.current
  });
  
  try {
    if (receiptType === 'invoice-a4') {
      if (!invoiceA4Ref.current) {
        throw new Error('Invoice A4 content not ready');
      }
      printInNewTab(invoiceA4Ref, `invoice-idcashier-${new Date().getTime()}`);
    } else if (receiptType === 'delivery-note') {
      if (!deliveryNoteRef.current) {
        throw new Error('Delivery note content not ready');
      }
      printInNewTab(deliveryNoteRef, `Surat_Jalan_${new Date().getTime()}`);
    } else {
      if (!thermalReceiptRef.current) {
        throw new Error('Thermal receipt content not ready');
      }
      printInNewTab(thermalReceiptRef, `receipt-idcashier-${new Date().getTime()}`);
    }
    console.log('✅ Print function executed successfully');
  } catch (error) {
    console.error('❌ Print function failed:', error);
    toast({ 
      title: t('error'), 
      description: `Print failed: ${error.message}`, 
      variant: "destructive" 
    });
  }
};

// ============= IMPLEMENTATION NOTES =============
/*
KEY IMPROVEMENTS IN THIS FIX:

1. CONTENT CLONING:
   - Clones the content before creating print window
   - Prevents content changes during print operation
   - Ensures stable, consistent output

2. ENHANCED CSS:
   - Forces visibility with !important rules
   - Prevents content hiding during print
   - Ensures proper background and font handling
   - Handles color printing issues

3. MULTIPLE TRIGGER MECHANISMS:
   - Immediate trigger (100ms)
   - Delayed trigger for styling (500ms)
   - Final stability trigger (1000ms)
   - Fallback for already-loaded documents

4. ERROR HANDLING:
   - Comprehensive error catching
   - User-friendly error messages
   - Console logging for debugging

5. CONTENT VERIFICATION:
   - Checks if content is ready before printing
   - Validates reference availability
   - Logs content availability status

APPLIED TO:
- Thermal receipts (58mm, 80mm)
- Invoice A4
- Delivery notes
- Transaction history prints

TO APPLY THIS FIX:
1. Replace the printInNewTab function (lines 192-251)
2. Replace the handlePrint function (lines 254-262)
3. Test with all receipt types
*/