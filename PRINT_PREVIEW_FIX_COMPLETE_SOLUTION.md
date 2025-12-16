# Print Preview Fix - Complete Solution

## Problem Diagnosis
**Issue**: Receipt content appears blank in browser's print preview after successful payment.

**Root Causes Identified**:
1. **Race Condition**: Print trigger fires before content is fully rendered
2. **DOM Manipulation Conflicts**: Direct content reference causes instability
3. **Inadequate CSS**: Print media queries insufficient for visibility
4. **Single Timing Strategy**: Doesn't handle all browser behaviors
5. **Missing Error Handling**: No feedback when content unavailable

## Solution Architecture

### 1. Enhanced Content Handling
```javascript
// Clone content to prevent DOM conflicts
const clonedContent = content.cloneNode(true);

// Validate content availability
if (!content) {
  console.error('No content found for printing');
  toast({ 
    title: t('error'), 
    description: 'No content found for printing', 
    variant: "destructive" 
  });
  return;
}
```

### 2. Multiple Print Triggers
```javascript
function triggerPrint() {
  try {
    console.log('Triggering print...');
    window.print();
  } catch (error) {
    console.error('Print error:', error);
  }
}

// Multiple timing strategies
window.onload = () => {
  // Immediate trigger (fast browsers)
  setTimeout(triggerPrint, 100);
  // Delayed trigger (styling applied)
  setTimeout(triggerPrint, 500);
  // Final trigger (maximum compatibility)
  setTimeout(triggerPrint, 1000);
};

// Fallback for already-loaded documents
if (document.readyState === 'complete') {
  setTimeout(triggerPrint, 100);
}
```

### 3. Enhanced CSS Rules
```css
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  @page {
    margin: 0 !important;
    size: auto !important;
  }
  
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
  
  #print-content {
    display: block !important;
    position: static !important;
    visibility: visible !important;
    width: 100% !important;
    height: auto !important;
    background: white !important;
  }
  
  .receipt-container {
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }
}
```

### 4. Content Verification
```javascript
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
```

## Implementation Guide

### Step 1: Update SalesPage.jsx
Replace the `printInNewTab` function (around line 192-252):

```javascript
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
```

### Step 2: Update index.css
Add enhanced print media queries:

```css
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
```

## Testing Checklist
- [ ] Thermal 58mm receipt prints correctly
- [ ] Thermal 80mm receipt prints correctly
- [ ] Invoice A4 prints correctly
- [ ] Delivery note prints correctly
- [ ] Print preview shows content (not blank)
- [ ] Error handling works for missing content
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)

## Expected Results
1. **Print Preview**: Will show actual receipt content instead of blank
2. **Reliability**: Multiple timing strategies handle different browser behaviors
3. **Error Feedback**: Users get clear error messages for failures
4. **Stability**: Content cloning prevents DOM conflicts
5. **Compatibility**: Enhanced CSS ensures proper rendering across browsers

## Files Modified
- `src/pages/SalesPage.jsx` - Enhanced printInNewTab and handlePrint functions
- `src/index.css` - Added comprehensive print media queries

## Rollback Plan
If issues occur, restore from:
- `src/pages/SalesPage.jsx.backup`
- Remove enhanced CSS rules from index.css

This solution addresses all identified root causes and provides a robust fix for the print preview blank issue.