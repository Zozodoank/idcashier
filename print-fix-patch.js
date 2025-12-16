// Step-by-step patch untuk memperbaiki print preview loading issue

// STEP 1: Basic improvement - tambahkan error handling
console.log('Applying print preview fix...');

// Replace fungsi printInNewTab yang ada dengan versi yang diperbaiki
const originalPrintInNewTab = printInNewTab;

const improvedPrintInNewTab = (contentRef, title) => {
  const content = contentRef.current;
  if (!content) {
    console.warn('Content not ready for printing');
    return;
  }

  console.log('Opening print window...');
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast({ title: t('error'), description: t('popupBlocked'), variant: "destructive" });
    return;
  }

  try {
    // Get all stylesheets
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
          <link rel="preload" href="/logo.png" as="image" />
          ${styles}
          <style>
            body { 
              background-color: white; 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
            }
            #loading-message {
              text-align: center;
              padding: 50px;
              font-size: 18px;
              color: #666;
            }
            #print-content { 
              display: none; 
              visibility: visible; 
              background: white;
              color: black;
            }
          </style>
        </head>
        <body>
          <div id="loading-message">Loading print preview...</div>
          <div id="print-content"></div>
          <script>
            function init() {
              console.log('Print window initialized');
              setTimeout(() => window.print(), 2000);
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Inject content after delay
    setTimeout(() => {
      try {
        const contentEl = printWindow.document.getElementById('print-content');
        const loadingEl = printWindow.document.getElementById('loading-message');
        
        if (contentEl) {
          contentEl.innerHTML = content.outerHTML;
          contentEl.style.display = 'block';
        }
        if (loadingEl) {
          loadingEl.style.display = 'none';
        }
        console.log('Content injected successfully');
      } catch (error) {
        console.error('Error injecting content:', error);
      }
    }, 300);

  } catch (error) {
    console.error('Error in printInNewTab:', error);
    printWindow.close();
  }
};

// Patch function
if (typeof printInNewTab !== 'undefined') {
  window.printInNewTab = improvedPrintInNewTab;
  console.log('Print preview fix applied successfully!');
} else {
  console.error('printInNewTab function not found');
}

// Cara penggunaan:
// 1. Buka browser developer console
// 2. Copy-paste kode ini
// 3. Test print functionality