// FIXED printInNewTab function untuk mengatasi loading issue di browser preview
// Replace fungsi printInNewTab yang ada di SalesPage.jsx dengan versi ini

const printInNewTab = (contentRef, title) => {
  const content = contentRef.current;
  if (!content) {
    toast({ title: t('error'), description: 'Content not ready for printing', variant: "destructive" });
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

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="preload" href="/logo.png" as="image" onload="console.log('Logo loaded successfully')" onerror="console.log('Logo failed to load')" />
          ${styles}
          <style>
            body { 
              background-color: white; 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              min-height: 100vh;
            }
            @media print {
              @page { margin: 0; }
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            /* Loading indicator styles */
            #loading-message {
              text-align: center;
              padding: 50px;
              font-family: Arial, sans-serif;
              font-size: 18px;
              color: #666;
              background: white;
            }
            /* Enhanced visibility for print content */
            #print-content { 
              display: none !important; 
              position: static !important; 
              visibility: visible !important; 
              width: 100%;
              min-height: 100vh;
              background: white;
              color: black;
            }
            /* Fallback for logo loading issues */
            img[src*="logo.png"] {
              max-width: 64px !important;
              height: auto !important;
            }
            /* Force all text to be visible */
            * {
              color: black !important;
            }
          </style>
        </head>
        <body>
          <div id="loading-message">
            <div style="font-size: 18px; margin-bottom: 10px;">Loading print preview...</div>
            <div style="font-size: 14px; color: #999;">Please wait while content loads</div>
          </div>
          <div id="print-content">
          </div>
          <script>
            // Enhanced print initialization with better timing
            function initializePrint() {
              console.log('Print window initialized, ready for content injection');
              
              // Notify parent window that we're ready
              window.parent.postMessage({ type: 'print-window-ready', title: '${title}' }, '*');
              
              // Auto print after content is injected and loaded (increased delay)
              setTimeout(() => {
                console.log('Initiating print...');
                window.print();
              }, 2500);
              
              // Safety timeout - always print after 6 seconds max
              setTimeout(() => {
                console.log('Safety timeout reached, forcing print');
                if (document.getElementById('print-content').children.length > 0) {
                  window.print();
                } else {
                  console.error('No content to print after safety timeout');
                }
              }, 6000);
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initializePrint);
            } else {
              initializePrint();
            }
            
            // Also listen for when window fully loads
            window.addEventListener('load', () => {
              console.log('Window fully loaded');
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Enhanced content injection with better timing and error handling
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        try {
          const contentElement = printWindow.document.getElementById('print-content');
          const loadingElement = printWindow.document.getElementById('loading-message');
          
          if (contentElement) {
            // Inject content
            contentElement.innerHTML = content.outerHTML;
            
            // Hide loading and show content
            if (loadingElement) {
              loadingElement.style.display = 'none';
            }
            contentElement.style.display = 'block';
            
            console.log('Content injected successfully into print window');
          } else {
            console.error('Could not find print-content element in print window');
          }
        } catch (error) {
          console.error('Error injecting content into print window:', error);
          // Try to show error in print window
          try {
            const loadingElement = printWindow.document.getElementById('loading-message');
            if (loadingElement) {
              loadingElement.innerHTML = '<div style="color: red;">Error loading content. Please try again.</div>';
            }
          } catch (e) {
            console.error('Could not update loading message:', e);
          }
        }
      } else {
        console.warn('Print window was closed before content injection');
      }
    }, 500); // Increased delay to ensure DOM is ready

  } catch (error) {
    console.error('Error in printInNewTab:', error);
    toast({ title: t('error'), description: `Print error: ${error.message}`, variant: "destructive" });
    printWindow.close();
  }
};

// Cara implementasi:
// 1. Buka src/pages/SalesPage.jsx
// 2. Temukan fungsi printInNewTab yang ada (sekitar baris 192)
// 3. Ganti seluruh fungsi tersebut dengan kode di atas
// 4. Save file
// 5. Test print functionality