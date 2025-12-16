// Print Enhancement Patch for SalesPage.jsx
// This replaces the printInNewTab function to fix blank print preview issue

// REPLACE the existing printInNewTab function (lines 192-251) with this enhanced version:

/*
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
*/