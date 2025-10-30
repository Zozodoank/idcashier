# Backup Before Removing Duplicate PrintReceipt

## Original Code State (UNTUK ROLLBACK)

### File: `src/pages/ReportsPage.jsx`

#### Line 75 - thermalReceiptRef Declaration
```javascript
const thermalReceiptRef = useRef();
```

#### Lines 626-644 - handlePrintThermal & handlePrintA4
```javascript
const handlePrintThermal = useReactToPrint({
  content: () => thermalReceiptRef.current,
  documentTitle: `receipt-${selectedSaleForPrint?.id || 'preview'}`,
  onAfterPrint: () => {
    // Close dialog after printing
    setShowPrintDialog(false);
    setSelectedSaleForPrint(null);
  }
});

const handlePrintA4 = useReactToPrint({
  content: () => invoiceA4Ref.current,
  documentTitle: `invoice-${selectedSaleForPrint?.id || 'preview'}`,
  onAfterPrint: () => {
    // Close dialog after printing
    setShowPrintDialog(false);
    setSelectedSaleForPrint(null);
  }
});
```

#### Lines 1182-1217 - Dialog Content with External Buttons
```javascript
{!showInvoiceA4 ? (
  // Thermal receipt preview
  <div className="space-y-4">
    {selectedSaleForPrint && (
      <PrintReceipt 
        {...transformSaleForThermal(selectedSaleForPrint)}
        settings={companyInfo} 
        paperSize={paperSize} 
        setPaperSize={setPaperSize} 
      />
    )}
    <Button onClick={handlePrintThermal} className="w-full">
      {t('printReceipt')}
    </Button>
  </div>
) : (
  // A4 invoice preview
  <div className="space-y-4">
    {selectedSaleForPrint && (
      <div className="border rounded-lg p-4 max-h-[50vh] overflow-auto">
        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
          <div className="printable-invoice-area">
            <InvoiceA4 
              sale={transformSaleForA4(selectedSaleForPrint)} 
              companyInfo={companyInfo} 
              useTwoDecimals={useTwoDecimals}
            />
          </div>
        </div>
      </div>
    )}
    <Button onClick={handlePrintA4} className="w-full">
      {t('printInvoice')}
    </Button>
  </div>
)}
```

#### Lines 1222-1240 - Hidden Components for Printing
```javascript
{/* Hidden components for printing */}
<div style={{ display: 'none' }}>
  {selectedSaleForPrint && !showInvoiceA4 && (
    <PrintReceipt 
      ref={thermalReceiptRef}
      {...transformSaleForThermal(selectedSaleForPrint)}
      settings={companyInfo} 
      paperSize={paperSize} 
    />
  )}
  {selectedSaleForPrint && showInvoiceA4 && (
    <InvoiceA4 
      ref={invoiceA4Ref} 
      sale={transformSaleForA4(selectedSaleForPrint)} 
      companyInfo={companyInfo} 
      useTwoDecimals={useTwoDecimals}
    />
  )}
</div>
```

## Changes to Implement (Option A)

### Yang Akan Dihapus:
1. ✅ `thermalReceiptRef` declaration (line 75)
2. ✅ `handlePrintThermal` function (lines 626-634)
3. ✅ External button "Cetak Struk" (lines 1193-1195)
4. ✅ Hidden duplicate PrintReceipt component (lines 1223-1231)

### Yang Tetap:
1. ✅ Preview PrintReceipt component (line 1186) - dengan internal button
2. ✅ `handlePrintA4` function - untuk A4 invoice
3. ✅ Hidden InvoiceA4 component - untuk A4 printing
4. ✅ External button "Cetak Invoice" - untuk A4

## Rollback Instructions

Jika Option A tidak bekerja, restore dengan:
1. Copy kode dari bagian "Original Code State" di atas
2. Paste kembali ke lokasi yang sama di `src/pages/ReportsPage.jsx`
3. Atau jalankan git revert jika sudah commit

## Reasoning

**Mengapa ada duplikasi:**
- Preview component untuk display di dialog
- Hidden component dengan ref untuk external button printing
- Ini menyebabkan 2 instance `.receipt-printable` yang conflict

**Mengapa Option A dipilih:**
- PrintReceipt sudah punya internal button "Cetak" (handlePrint)
- External button "Cetak Struk" redundant
- Mengurangi complexity dengan hanya 1 instance component

## Expected Result

Setelah perubahan:
- ✅ Hanya 1 instance PrintReceipt (preview saja)
- ✅ Button "Cetak" internal di dalam preview box
- ✅ Tidak ada hidden duplicate
- ✅ Print preview seharusnya tidak conflict lagi

