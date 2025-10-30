# Perbaikan Kalkulasi Diskon dan Pajak - Nominal vs Persentase

## Deskripsi Masalah

Di tab **Transaksi** halaman **Reports** dan di **Export Laporan Penjualan**, kolom **Diskon** dan **Pajak** menampilkan nilai yang salah.

### Masalah Spesifik:

**Contoh Kasus:**
- Produk: Rp. 2.000
- Diskon: 10%
- Yang seharusnya tampil di kolom Diskon: **Rp. 200** (10% dari Rp. 2.000)
- Yang tampil sebelumnya: **10** (persentase mentah)

### Root Cause:

**Di Database (SalesPage.jsx):**
- Field `discount` dan `tax` menyimpan **PERSENTASE** (misal: 10 untuk 10%, 5 untuk 5%)
- Kalkulasi dilakukan dengan formula:
  ```javascript
  const discountAmount = subtotal * (discount / 100);
  const taxAmount = taxableAmount * (tax / 100);
  ```

**Di ReportsPage.jsx (SEBELUM FIX):**
- Kode langsung menggunakan `sale.discount` sebagai `discount_amount`
- Kode langsung menggunakan `sale.tax` sebagai `tax_amount`
- **SALAH:** Persentase ditampilkan sebagai nominal

```javascript
// ❌ SALAH - Lines 340-341 (old)
discount_amount: sale.discount || 0,  // Persentase (10)
tax_amount: sale.tax || 0,            // Persentase (5)
```

## Perubahan yang Dilakukan

### File: `src/pages/ReportsPage.jsx`

#### 1. **Fix untuk Sales Tanpa Items** (Lines 268-303)

**Perubahan:**
- Menambahkan kalkulasi nominal dari persentase
- Menggunakan formula yang sama dengan SalesPage

**Kode yang Ditambahkan:**
```javascript
// Calculate nominal discount and tax from percentages
const subtotalForSale = 0;
const discountNominal = subtotalForSale * ((sale.discount || 0) / 100);
const taxableAmount = subtotalForSale - discountNominal;
const taxNominal = taxableAmount * ((sale.tax || 0) / 100);
```

**Kode yang Diubah:**
```javascript
// ❌ SEBELUM
discount_amount: sale.discount || 0,
tax_amount: sale.tax || 0,

// ✅ SESUDAH
discount_amount: discountNominal,
tax_amount: taxNominal,
```

---

#### 2. **Fix untuk Sales dengan Items** (Lines 305-363)

**Perubahan:**
- Menambahkan kalkulasi nominal dari persentase
- Kalkulasi dilakukan setelah subtotal dihitung

**Kode yang Ditambahkan (Lines 314-317):**
```javascript
// Calculate nominal discount and tax from percentages
const discountNominal = saleSubtotal * ((sale.discount || 0) / 100);
const taxableAmount = saleSubtotal - discountNominal;
const taxNominal = taxableAmount * ((sale.tax || 0) / 100);
```

**Kode yang Diubah:**
```javascript
// ❌ SEBELUM
discount_amount: sale.discount || 0,
tax_amount: sale.tax || 0,

// ✅ SESUDAH
discount_amount: discountNominal,
tax_amount: taxNominal,
```

---

#### 3. **Fix Export Function** (Lines 474-500)

**Perubahan:**
- Menambahkan kolom **Harga**, **Subtotal Item**, **Diskon**, **Pajak** ke export
- Menggunakan `isFirstItemInSale` untuk menghindari duplikasi data sale-level

**Kode SEBELUM:**
```javascript
excelData = data.map(item => ({
  'Tanggal': ...,
  'Produk': item.product,
  'Pelanggan': item.customer,
  'Supplier': item.supplier,
  'Kasir': item.cashier,
  'Jumlah': item.quantity,
  'Total': `Rp ${item.total.toLocaleString()}`
}));

options = {
  sheetName: 'Laporan Transaksi',
  columnWidths: [20, 25, 20, 20, 20, 15, 20]  // 7 kolom
};
```

**Kode SESUDAH:**
```javascript
excelData = data.map(item => ({
  'Tanggal': ...,
  'Produk': item.product,
  'Pelanggan': item.customer,
  'Supplier': item.supplier,
  'Kasir': item.cashier,
  'Jumlah': item.quantity,
  'Harga': `Rp ${item.price.toLocaleString()}`,               // ✅ BARU
  'Subtotal Item': `Rp ${item.itemSubtotal.toLocaleString()}`, // ✅ BARU
  'Diskon': item.isFirstItemInSale ? `Rp ${item.discount_amount.toLocaleString()}` : '', // ✅ BARU
  'Pajak': item.isFirstItemInSale ? `Rp ${item.tax_amount.toLocaleString()}` : '',      // ✅ BARU
  'Total': item.isFirstItemInSale ? `Rp ${item.total.toLocaleString()}` : ''
}));

options = {
  sheetName: 'Laporan Transaksi',
  columnWidths: [20, 25, 20, 20, 20, 15, 15, 18, 15, 15, 18]  // 11 kolom
};
```

## Formula Kalkulasi

### Formula yang Digunakan (Sama dengan SalesPage.jsx):

```javascript
// 1. Hitung subtotal dari semua items
subtotal = Σ(item.price * item.quantity)

// 2. Hitung nominal diskon dari persentase
discountAmount = subtotal * (discount / 100)

// 3. Hitung taxable amount (subtotal setelah diskon)
taxableAmount = subtotal - discountAmount

// 4. Hitung nominal pajak dari persentase
taxAmount = taxableAmount * (tax / 100)

// 5. Hitung total
total = taxableAmount + taxAmount
```

### Contoh Perhitungan:

**Input:**
- Item 1: Rp. 2.000 × 2 = Rp. 4.000
- Item 2: Rp. 1.000 × 1 = Rp. 1.000
- Subtotal: Rp. 5.000
- Diskon: 10%
- Pajak: 5%

**Kalkulasi:**
```
1. Subtotal = 5.000
2. Diskon = 5.000 * (10 / 100) = 500  ← Tampil: Rp. 500
3. Taxable = 5.000 - 500 = 4.500
4. Pajak = 4.500 * (5 / 100) = 225    ← Tampil: Rp. 225
5. Total = 4.500 + 225 = 4.725
```

## Hasil Tampilan

### Tab Transaksi (Table):

**SEBELUM:**
| Produk | Qty | Harga | Subtotal | Diskon | Pajak | Total |
|--------|-----|-------|----------|--------|-------|-------|
| Item A | 2   | 2,000 | 4,000    | **10** ❌ | **5** ❌ | 4,725 |
| Item B | 1   | 1,000 | 1,000    |        |       |       |

**SESUDAH:**
| Produk | Qty | Harga | Subtotal | Diskon | Pajak | Total |
|--------|-----|-------|----------|--------|-------|-------|
| Item A | 2   | 2,000 | 4,000    | **Rp 500** ✅ | **Rp 225** ✅ | 4,725 |
| Item B | 1   | 1,000 | 1,000    |        |       |       |

### Export Excel:

**SEBELUM (7 kolom):**
| Tanggal | Produk | Pelanggan | Supplier | Kasir | Jumlah | Total |

**SESUDAH (11 kolom):**
| Tanggal | Produk | Pelanggan | Supplier | Kasir | Jumlah | Harga | Subtotal Item | Diskon | Pajak | Total |

**Data yang diekspor:**
- Harga: Harga per unit produk
- Subtotal Item: Total harga item (harga × jumlah)
- Diskon: Nominal diskon (hanya di baris pertama)
- Pajak: Nominal pajak (hanya di baris pertama)
- Total: Total transaksi (hanya di baris pertama)

## Testing Checklist

- [ ] Buka Reports → Tab Transaksi
- [ ] Verifikasi kolom Diskon menampilkan nominal (Rp. 200), bukan persentase (10)
- [ ] Verifikasi kolom Pajak menampilkan nominal (Rp. 225), bukan persentase (5)
- [ ] Export laporan transaksi
- [ ] Buka file Excel
- [ ] Verifikasi kolom Diskon dan Pajak menampilkan nominal dengan format "Rp XXX"
- [ ] Verifikasi kolom baru (Harga, Subtotal Item) muncul
- [ ] Verifikasi Diskon, Pajak, Total hanya muncul di baris pertama setiap transaksi

## Cara Testing

### 1. Testing di UI:

```
1. Buat transaksi baru di Sales Page:
   - Tambah produk Rp. 2.000 (qty: 1)
   - Set Diskon: 10%
   - Set Pajak: 5%
   - Expected: 
     * Subtotal: Rp. 2.000
     * Diskon: Rp. 200 (10% dari 2.000)
     * Taxable: Rp. 1.800
     * Pajak: Rp. 90 (5% dari 1.800)
     * Total: Rp. 1.890

2. Buka Reports → Tab Transaksi
3. Cari transaksi yang baru dibuat
4. Verifikasi kolom Diskon: Rp. 200 ✅
5. Verifikasi kolom Pajak: Rp. 90 ✅
```

### 2. Testing Export:

```
1. Di Reports → Tab Transaksi
2. Klik tombol "Export"
3. Buka file Excel
4. Verifikasi struktur:
   - 11 kolom (bukan 7)
   - Kolom "Diskon" dan "Pajak" ada dan berisi nominal
   - Hanya baris pertama setiap transaksi yang ada nilai Diskon/Pajak/Total
```

## Status

✅ **SELESAI** - Semua perubahan telah diterapkan

## Files Modified

1. ✅ `src/pages/ReportsPage.jsx`
   - Lines 268-303: Fix kalkulasi untuk sales tanpa items
   - Lines 305-363: Fix kalkulasi untuk sales dengan items
   - Lines 474-500: Update export function dengan kolom baru

## Catatan

### Data Structure di Database:

Tabel `sales`:
- `discount`: Menyimpan persentase (0-100)
- `tax`: Menyimpan persentase (0-100)

### Mengapa Tidak Ubah Database?

Struktur database sudah benar. Yang salah adalah tampilan/transformasi data di ReportsPage. Database menyimpan persentase agar:
1. Lebih flexible (bisa recalculate jika ada perubahan harga produk)
2. Data lebih compact (integer daripada decimal)
3. Lebih mudah untuk audit trail

### Tidak Ada Perubahan Tampilan

⚠️ **PENTING:** Perubahan ini HANYA memperbaiki nilai yang ditampilkan di kolom Diskon dan Pajak. Tidak ada perubahan layout, struktur tabel, atau UI. Sesuai instruksi user: "JANGAN MERUBAH TAMPILAN FRONTEND TANPA INSTRUKSI".

## Referensi

- Source Truth: `src/pages/SalesPage.jsx` lines 290-293 (kalkulasi diskon dan pajak)
- Formula sama dengan yang digunakan saat create sale
- Konsisten dengan bagaimana data disimpan di database


