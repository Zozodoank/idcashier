# Perbaikan Kalkulasi Diskon & Pajak di Invoice A4 dan Struk Thermal

## Deskripsi Masalah

### 1. Invoice A4 - Kalkulasi Salah
- Kolom diskon dan pajak menampilkan nilai persentase (10) bukan nominal (Rp. 200)
- Penyebab: `transformSaleForA4` menggunakan `sale.discount` dan `sale.tax` langsung sebagai amount

### 2. Struk Thermal - Format Display Salah
- Diskon tampil: "-10" (seharusnya "Diskon (10%): -Rp 200")
- Pajak tampil: "10" (seharusnya "Pajak (10%): Rp 90")
- Penyebab: 
  - `transformSaleForThermal` menggunakan persentase sebagai nominal
  - Label tidak menampilkan persentase

## Perubahan yang Dilakukan

### 1. **Fix transformSaleForThermal** - ReportsPage.jsx (Lines 650-693)

**Masalah:**
```javascript
// ❌ SALAH
return {
  cart,
  subtotal,
  discountAmount: sale.discount || 0,  // Persentase (10)
  taxAmount: sale.tax || 0,            // Persentase (5)
  ...
};
```

**Perbaikan:**
```javascript
// ✅ BENAR
// Calculate subtotal from items
const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

// Calculate nominal discount and tax from percentages
const discountPercent = sale.discount || 0;
const taxPercent = sale.tax || 0;
const discountAmount = subtotal * (discountPercent / 100);
const taxableAmount = subtotal - discountAmount;
const taxAmount = taxableAmount * (taxPercent / 100);

return {
  cart,
  subtotal,
  discountPercent,        // ← Tambah persentase
  discountAmount,         // ← Nominal (Rp 200)
  taxPercent,             // ← Tambah persentase
  taxAmount,              // ← Nominal (Rp 90)
  total: sale.total_amount || 0,
  paymentAmount: sale.payment_amount || 0,
  change: sale.change_amount || 0,
  customer: {
    name: sale.customer_name || 'Umum'
  }
};
```

---

### 2. **Fix transformSaleForA4** - ReportsPage.jsx (Lines 695-735)

**Masalah:**
```javascript
// ❌ SALAH
return {
  ...sale,
  items: items,
  subtotal: subtotal,
  discount_amount: sale.discount || 0,  // Persentase (10)
  tax_amount: sale.tax || 0,            // Persentase (5)
  ...
};
```

**Perbaikan:**
```javascript
// ✅ BENAR
// Calculate subtotal from items
const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

// Calculate nominal discount and tax from percentages
const discountAmount = subtotal * ((sale.discount || 0) / 100);
const taxableAmount = subtotal - discountAmount;
const taxAmount = taxableAmount * ((sale.tax || 0) / 100);

return {
  ...sale,
  items: items,
  subtotal: subtotal,
  discount_amount: discountAmount,  // ← Nominal (Rp 200)
  tax_amount: taxAmount,            // ← Nominal (Rp 90)
  total_amount: sale.total_amount || 0,
  ...
};
```

---

### 3. **Update PrintReceipt Component** - PrintReceipt.jsx

#### A. Update Props Signature (Line 8)

**Sebelum:**
```javascript
const ReceiptContent = forwardRef(({ cart, subtotal, discountAmount, taxAmount, total, ... }, ref) => {
```

**Sesudah:**
```javascript
const ReceiptContent = forwardRef(({ cart, subtotal, discountPercent, discountAmount, taxPercent, taxAmount, total, ... }, ref) => {
```

#### B. Update Display Labels (Lines 145-146)

**Sebelum:**
```javascript
{discountAmount > 0 && <div className="flex justify-between"><p>{t('discountLabel')}:</p><p>-{safeToLocaleString(discountAmount)}</p></div>}
{taxAmount > 0 && <div className="flex justify-between"><p>{t('taxLabel')}:</p><p>{safeToLocaleString(taxAmount)}</p></div>}
```

**Sesudah:**
```javascript
{discountAmount > 0 && <div className="flex justify-between"><p>{t('discountLabel')} ({discountPercent}%):</p><p>-{safeToLocaleString(discountAmount)}</p></div>}
{taxAmount > 0 && <div className="flex justify-between"><p>{t('taxLabel')} ({taxPercent}%):</p><p>{safeToLocaleString(taxAmount)}</p></div>}
```

## Formula Kalkulasi

### Formula yang Digunakan (Sama di Semua Tempat):

```javascript
// 1. Hitung subtotal
subtotal = Σ(item.price * item.quantity)

// 2. Hitung nominal diskon
discountAmount = subtotal * (discountPercent / 100)

// 3. Hitung taxable amount
taxableAmount = subtotal - discountAmount

// 4. Hitung nominal pajak
taxAmount = taxableAmount * (taxPercent / 100)

// 5. Hitung total
total = taxableAmount + taxAmount
```

### Contoh Perhitungan:

**Input:**
- Produk: Rp. 2.000 × 1 = Rp. 2.000
- Diskon: 10%
- Pajak: 5%

**Kalkulasi:**
```
1. Subtotal = 2.000
2. Diskon = 2.000 * (10 / 100) = 200
3. Taxable = 2.000 - 200 = 1.800
4. Pajak = 1.800 * (5 / 100) = 90
5. Total = 1.800 + 90 = 1.890
```

## Hasil Tampilan

### Struk Thermal (58mm/80mm):

**SEBELUM:**
```
========================================
Subtotal:                        2,000
Diskon:                           -10  ❌ (persentase mentah)
Pajak:                             5   ❌ (persentase mentah)
========================================
Total:                           1,890
```

**SESUDAH:**
```
========================================
Subtotal:                        2,000
Diskon (10%):                    -200  ✅ (persentase + nominal)
Pajak (5%):                        90  ✅ (persentase + nominal)
========================================
Total:                           1,890
```

### Invoice A4:

**SEBELUM:**
```
┌─────────────────────────────┐
│ Subtotal      Rp     2.000  │
│ Diskon        Rp        10  │ ❌
│ Pajak         Rp         5  │ ❌
│ Total         Rp     1.890  │
└─────────────────────────────┘
```

**SESUDAH:**
```
┌─────────────────────────────┐
│ Subtotal      Rp     2.000  │
│ Diskon        Rp       200  │ ✅
│ Pajak         Rp        90  │ ✅
│ Total         Rp     1.890  │
└─────────────────────────────┘
```

## Data Flow

### Thermal Receipt:
```
1. ReportsPage: transformSaleForThermal()
   ├─ Input: sale.discount (10), sale.tax (5)
   ├─ Kalkulasi: discountAmount = 200, taxAmount = 90
   └─ Output: { discountPercent: 10, discountAmount: 200, taxPercent: 5, taxAmount: 90 }

2. PrintReceipt: ReceiptContent
   ├─ Receive: discountPercent, discountAmount, taxPercent, taxAmount
   └─ Display: "Diskon (10%): -200", "Pajak (5%): 90"
```

### Invoice A4:
```
1. ReportsPage: transformSaleForA4()
   ├─ Input: sale.discount (10), sale.tax (5)
   ├─ Kalkulasi: discountAmount = 200, taxAmount = 90
   └─ Output: { discount_amount: 200, tax_amount: 90 }

2. InvoiceA4: Component
   ├─ Receive: discount_amount, tax_amount
   └─ Display: "Rp 200", "Rp 90"
```

## Testing Checklist

- [ ] Buat transaksi dengan diskon 10% dan pajak 5%
- [ ] Buka Reports → Transaksi → Print → Struk Thermal
- [ ] Verifikasi tampilan: "Diskon (10%): -200"
- [ ] Verifikasi tampilan: "Pajak (5%): 90"
- [ ] Buka Reports → Transaksi → Print → Invoice A4
- [ ] Verifikasi kolom Diskon: Rp 200 (bukan Rp 10)
- [ ] Verifikasi kolom Pajak: Rp 90 (bukan Rp 5)
- [ ] Print actual receipt → Verify output benar

## Cara Testing

### 1. Testing Struk Thermal:

```
1. Buat transaksi di Sales Page:
   - Produk Rp. 2.000 (qty: 1)
   - Diskon: 10%
   - Pajak: 5%
   - Save

2. Buka Reports → Tab Transaksi
3. Klik Print pada transaksi
4. Pilih tab "Struk Thermal"
5. Pilih ukuran 58mm atau 80mm
6. Verifikasi preview:
   - ✅ "Diskon (10%): -200"
   - ✅ "Pajak (5%): 90"
   
7. Klik "Cetak" → Chrome print preview
8. Verifikasi print output sama
```

### 2. Testing Invoice A4:

```
1. Dari Reports → Tab Transaksi
2. Klik Print pada transaksi yang sama
3. Pilih tab "Invoice A4"
4. Verifikasi preview:
   - ✅ Subtotal: Rp 2.000
   - ✅ Diskon: Rp 200 (bukan 10)
   - ✅ Pajak: Rp 90 (bukan 5)
   - ✅ Total: Rp 1.890
   
5. Klik "Cetak Invoice" → Chrome print preview
6. Verifikasi print output sama
```

## Status

✅ **SELESAI** - Semua perubahan telah diterapkan

## Files Modified

1. ✅ `src/pages/ReportsPage.jsx`
   - Lines 650-693: Fix `transformSaleForThermal` dengan kalkulasi nominal
   - Lines 695-735: Fix `transformSaleForA4` dengan kalkulasi nominal

2. ✅ `src/components/PrintReceipt.jsx`
   - Line 8: Update props signature untuk terima `discountPercent` dan `taxPercent`
   - Lines 145-146: Update display labels untuk tampilkan persentase

## Catatan

### Konsistensi dengan SalesPage

Formula kalkulasi sekarang **100% konsisten** dengan SalesPage.jsx:
- `SalesPage.jsx` lines 290-293: Kalkulasi saat create sale
- `ReportsPage.jsx` lines 672-677: Kalkulasi saat transform untuk thermal
- `ReportsPage.jsx` lines 716-719: Kalkulasi saat transform untuk A4

### Mengapa Perlu Tampilkan Persentase?

User meminta tampilan "10%" di struk thermal karena:
1. **Informasi Lengkap**: User tahu berapa persen diskon yang diberikan
2. **Transparansi**: Customer bisa verifikasi kalkulasi
3. **Standard Practice**: Kebanyakan receipt menampilkan "Diskon (10%): Rp 200"

### Data di Database Tetap Persentase

Database tetap menyimpan persentase (0-100) karena:
- Lebih flexible untuk recalculation
- Lebih compact (integer vs decimal)
- Audit trail lebih mudah

### Tidak Ada Perubahan Layout

⚠️ **PENTING:** Perubahan ini HANYA memperbaiki:
1. Kalkulasi nominal di Invoice A4
2. Kalkulasi nominal di Struk Thermal
3. Format display label di Struk Thermal

Tidak ada perubahan struktur UI, layout, atau posisi element. Sesuai instruksi: "JANGAN MERUBAH TAMPILAN FRONTEND TANPA INSTRUKSI".

## Referensi

- Previous fix: `FIX_DISCOUNT_TAX_NOMINAL_DISPLAY.md` (fix display di tab Transaksi)
- Source: `src/pages/SalesPage.jsx` lines 290-293 (kalkulasi original)
- Konsisten dengan semua bagian aplikasi yang menampilkan diskon dan pajak

