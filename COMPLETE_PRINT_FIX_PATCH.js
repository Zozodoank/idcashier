// COMPLETE PRINT PREVIEW FIX PATCH
// This patch fixes the blank print preview issue in SalesPage.jsx
// Apply these changes to src/pages/SalesPage.jsx

// STEP 1: REPLACE the printInNewTab function (lines ~192-252) with this enhanced version:

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

// STEP 2: REPLACE the handlePrint function (lines ~254-262) with this enhanced version:

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

// STEP 3: ADD this CSS enhancement to index.css or global styles
// This ensures print styles are properly applied:

/*
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  .receipt-container,
  .printable-invoice-area,
  .receipt-printable {
    display: block !important;
    visibility: visible !important;
    background: white !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* Hide non-print elements */
  .no-print,
  header,
  nav,
  .sidebar,
  .dialog-overlay {
    display: none !important;
  }
}
*/

// SUMMARY OF FIXES:
// 1. CONTENT CLONING: Prevents content modification during print
// 2. ENHANCED CSS: Forces visibility and proper background
// 3. MULTIPLE TRIGGERS: Handles race conditions in different browsers
// 4. CONTENT VERIFICATION: Checks if content is ready before printing
// 5. ERROR HANDLING: Provides user feedback for failures
// 6. RACE CONDITION HANDLING: Multiple timing strategies

// TO APPLY:
// 1. Replace printInNewTab function in SalesPage.jsx (around line 192)
// 2. Replace handlePrint function in SalesPage.jsx (around line 254)
// 3. Add CSS rules to index.css for better print support
// 4. Test with all receipt types (thermal 58mm, 80mm, A4, delivery note)