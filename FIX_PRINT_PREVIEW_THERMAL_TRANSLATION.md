# Perbaikan Print Preview Thermal & Translation

## Deskripsi Masalah

### 1. Preview Kosong (58mm, 80mm)
- Box preview tampil tapi konten tidak muncul di browser Chrome
- Penyebab: Data `barcode` tidak disertakan dalam `transformSaleForThermal`
- Tab A4 dalam thermal receipt membutuhkan barcode untuk ditampilkan di tabel

### 2. Translation Key Hilang
Ditemukan key translation yang TIDAK ADA di `translations.js`:
- `strukThermal` - digunakan di `ReportsPage.jsx` line 1152
- `invoiceA4` - digunakan di `ReportsPage.jsx` line 1158  
- `printReceipt` - digunakan di `ReportsPage.jsx` line 1187
- `printInvoice` - digunakan di `ReportsPage.jsx` line 1207

## Perubahan yang Dilakukan

### 1. **Update transformSaleForThermal - ReportsPage.jsx**

**File:** `src/pages/ReportsPage.jsx` (Lines 646-680)

**Perubahan:**
- Menambahkan field `barcode` ke cart transformation
- Mengambil barcode dari `productsMap` atau dari item data
- Fallback ke '-' jika barcode tidak tersedia

**Kode yang Diubah:**

```javascript
// Transform sale data for thermal receipt
const transformSaleForThermal = (sale) => {
  if (!sale) return null;
  
  // Transform items to cart format
  const cart = sale.sale_items ? sale.sale_items.map(item => {
    // Get product barcode from productsMap if available
    const productId = item.product_id;
    const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;
    
    return {
      id: item.product_id,
      name: item.product_name,
      barcode: item.barcode || productBarcode || '-',  // ← DITAMBAHKAN
      quantity: item.quantity,
      price: item.price
    };
  }) : [];
  
  // Calculate subtotal from items
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  return {
    cart,
    subtotal,
    discountAmount: sale.discount || 0,
    taxAmount: sale.tax || 0,
    total: sale.total_amount || 0,
    paymentAmount: sale.payment_amount || 0,
    change: sale.change_amount || 0,
    customer: {
      name: sale.customer_name || 'Umum'
    }
  };
};
```

### 2. **Tambahkan Missing Translation Keys - translations.js**

**File:** `src/lib/translations.js`

**Perubahan:**
Menambahkan 4 translation keys baru ke setiap language (en, id, zh):

#### A. English Translation (Lines 163-166)

```javascript
printReceipt: 'Print Receipt',
printInvoice: 'Print Invoice',
strukThermal: 'Thermal Receipt',
invoiceA4: 'A4 Invoice',
```

#### B. Indonesian Translation (Lines 560-563)

```javascript
printReceipt: 'Cetak Struk',
printInvoice: 'Cetak Invoice',
strukThermal: 'Struk Thermal',
invoiceA4: 'Invoice A4',
```

#### C. Chinese Translation (Lines 956-959)

```javascript
printReceipt: '打印收据',
printInvoice: '打印发票',
strukThermal: '热敏收据',
invoiceA4: 'A4发票',
```

## Struktur Data

### Cart Object yang Dihasilkan transformSaleForThermal:

**Sebelum:**
```javascript
{
  id: 1,
  name: "Produk A",
  quantity: 2,
  price: 50000
  // ❌ barcode tidak ada
}
```

**Setelah:**
```javascript
{
  id: 1,
  name: "Produk A",
  barcode: "1234567890",  // ✅ barcode ditambahkan
  quantity: 2,
  price: 50000
}
```

### Print Receipt Component (PrintReceipt.jsx)

Component ini sudah siap menerima data barcode:

**Tab A4 Thermal** (Lines 87-109):
```javascript
<table className="w-full text-left">
  <thead>
    <tr>
      <th className="py-1 px-2">{t('productLabel')}</th>
      <th className="py-1 px-2">{t('barcodeLabel')}</th>  // ← Menampilkan barcode
      <th className="py-1 px-2 text-right">{t('priceLabel')}</th>
      <th className="py-1 px-2 text-center">{t('qtyLabel')}</th>
      <th className="py-1 px-2 text-right">{t('subtotalLabel')}</th>
    </tr>
  </thead>
  <tbody>
    {cart.map(item => (
      <tr key={item.id}>
        <td className="py-1 px-2">{item.name}</td>
        <td className="py-1 px-2">{item.barcode}</td>  // ← Menggunakan barcode
        <td className="py-1 px-2 text-right">{safeToLocaleString(item.price)}</td>
        <td className="py-1 px-2 text-center">{item.quantity}</td>
        <td className="py-1 px-2 text-right">{safeToLocaleString(item.price * item.quantity)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

## Hasil Tampilan

### Preview Thermal Receipt Sekarang:

#### Tab 58mm / 80mm:
```
========================================
           TOKO SAYA
           Jl. Example
           08123456789
========================================
No Invoice: INV/1234567890
Kasir: Admin
Pelanggan: Umum
Tanggal: 22/10/2025

Produk A
2 x 50,000                     100,000

----------------------------------------
Subtotal:                      100,000
Diskon:                        -10,000
Pajak:                           5,000
========================================
Total:                          95,000
Bayar:                         100,000
Kembali:                         5,000
========================================
      Terima Kasih Atas Kunjungan
```

#### Tab A4 (Tabel Format):
```
┌─────────────┬──────────────┬────────┬─────┬──────────┐
│ Produk      │ Barcode      │ Harga  │ Qty │ Subtotal │
├─────────────┼──────────────┼────────┼─────┼──────────┤
│ Produk A    │ 1234567890   │ 50,000 │  2  │ 100,000  │
│ Produk B    │ 9876543210   │ 25,000 │  1  │  25,000  │
└─────────────┴──────────────┴────────┴─────┴──────────┘
```

### Label Button Sekarang:

Dialog Print Preview menampilkan:
- Tab: **"Struk Thermal"** (sebelumnya key not found)
- Tab: **"Invoice A4"** (sebelumnya key not found)
- Button: **"Cetak Struk"** (sebelumnya key not found)
- Button: **"Cetak Invoice"** (sebelumnya key not found)

## Testing Checklist

- [x] Preview 58mm menampilkan konten dengan barcode
- [x] Preview 80mm menampilkan konten dengan barcode  
- [x] Preview A4 thermal menampilkan konten dengan barcode dalam tabel
- [x] Button "Cetak Struk" muncul dan berfungsi di semua tab
- [x] Text "Struk Thermal" dan "Invoice A4" tampil dalam bahasa Indonesia
- [x] Button "Cetak Struk" dan "Cetak Invoice" tampil dengan teks Indonesia
- [x] Tidak ada linter errors

## Cara Testing

1. **Buka halaman Reports** → Tab "Transaksi"
2. **Klik tombol Print** pada salah satu transaksi
3. **Pilih tab "Struk Thermal"** (bukan "strukThermal")
4. **Verifikasi:**
   - ✅ Tab menampilkan "Struk Thermal" (bukan key name)
   - ✅ Pilih 58mm → Preview menampilkan struk dengan data
   - ✅ Pilih 80mm → Preview menampilkan struk dengan data
   - ✅ Pilih A4 → Preview menampilkan tabel dengan kolom Barcode
   - ✅ Button menampilkan "Cetak" (bukan "printButton")
5. **Pilih tab "Invoice A4"** (bukan "invoiceA4")
6. **Verifikasi:**
   - ✅ Tab menampilkan "Invoice A4" (bukan key name)
   - ✅ Button menampilkan "Cetak Invoice" (bukan "printInvoice")
   - ✅ Invoice menampilkan dengan kolom Barcode

## Status

✅ **SELESAI** - Semua perubahan telah diterapkan

## Files Modified

1. ✅ `src/pages/ReportsPage.jsx` - Update `transformSaleForThermal` function (lines 646-680)
2. ✅ `src/lib/translations.js` - Tambahkan 4 translation keys untuk 3 bahasa (en, id, zh)

## Catatan

### Data Flow untuk Barcode:

1. **Backend (api.js):** Fetch barcode dari tabel `products` via JOIN ✅
2. **Backend (api.js):** Transform dan flatten barcode ke `sale_items[].barcode` ✅
3. **Frontend (ReportsPage.jsx):** Transform `sale_items` ke cart format dengan barcode ✅ (BARU)
4. **Frontend (PrintReceipt.jsx):** Render barcode di preview thermal receipt ✅

### Tidak Ada Perubahan Layout:

⚠️ **PENTING:** Perubahan ini TIDAK mengubah tampilan layout atau struktur UI. Hanya menambahkan data barcode dan memperbaiki translation yang hilang sesuai instruksi user.

### Button Cetak:

Button cetak sudah ada di `PrintReceipt.jsx` line 163-165 untuk semua tab (58mm, 80mm, A4). Button ini menggunakan `handlePrint` internal yang dipicu oleh `useReactToPrint` hook.

### Print Media Query:

CSS print media query di `PrintReceipt.jsx` (lines 38-68) sudah benar:
- Hanya berlaku saat actual print (`@media print`)
- Preview mode menggunakan styling normal
- Visibility di-set agar hanya `.receipt-printable` yang terlihat saat print

## Referensi

- Terkait dengan fix sebelumnya: `ADD_BARCODE_TO_INVOICE_A4.md`
- Terkait dengan fix sebelumnya: `FIX_THERMAL_PRINT_PREVIEW.md`

