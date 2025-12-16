# Penambahan Kolom Barcode pada Invoice A4

## Deskripsi Perubahan

Telah dilakukan penambahan kolom "Barcode" pada print preview Invoice A4 dan penggantian label kolom "unitPriceLabel" dengan "Harga".

## Perubahan yang Dilakukan

### 1. **Frontend - InvoiceA4.jsx**

**File:** `src/components/InvoiceA4.jsx`

**Perubahan:**
- Menambahkan kolom "Barcode" setelah kolom deskripsi produk
- Mengganti label `{t('unitPriceLabel')}` dengan "Harga"
- Menampilkan barcode produk di setiap baris item (atau "-" jika tidak ada)

**Kode yang Diubah (Lines 97-124):**

```jsx
{/* Body Section - Items Table */}
<main className="mb-8">
  <table className="w-full text-left text-base border-collapse">
    <thead>
      <tr className="bg-gray-100 border-b border-gray-300">
        <th className="p-3 font-bold uppercase text-gray-700">{t('descriptionLabel')}</th>
        <th className="p-3 font-bold uppercase text-gray-700">Barcode</th>
        <th className="p-3 font-bold uppercase text-gray-700 text-center">{t('quantityLabel')}</th>
        <th className="p-3 font-bold uppercase text-gray-700 text-right">Harga</th>
        <th className="p-3 font-bold uppercase text-gray-700 text-right">{t('subtotalLabel')}</th>
      </tr>
    </thead>
    <tbody>
      {sale.items.map((item, index) => {
        const subtotal = item.price * item.quantity;
        return (
          <tr key={index} className="border-b border-gray-200">
            <td className="p-3">{item.product_name}</td>
            <td className="p-3">{item.barcode || '-'}</td>
            <td className="p-3 text-center">{item.quantity}</td>
            <td className="p-3 text-right">{formatCurrency(item.price)}</td>
            <td className="p-3 text-right">{formatCurrency(subtotal)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</main>
```

### 2. **Frontend - ReportsPage.jsx**

**File:** `src/pages/ReportsPage.jsx`

**Perubahan:**
- Update fungsi `transformSaleForA4` untuk menyertakan barcode dari data produk
- Mengambil barcode dari `productsMap` atau dari item data

**Kode yang Diubah (Lines 675-710):**

```javascript
// Transform sale data for A4 invoice
const transformSaleForA4 = (sale) => {
  if (!sale) return null;
  
  // Transform sale_items to items format expected by InvoiceA4
  const items = sale.sale_items ? sale.sale_items.map(item => {
    // Get product barcode from productsMap if available
    const productId = item.product_id;
    const productBarcode = productId && productsMap[productId] ? productsMap[productId].barcode : null;
    
    return {
      product_name: item.product_name || 'Unknown Product',
      barcode: item.barcode || productBarcode || null,
      quantity: item.quantity || 0,
      price: item.price || 0
    };
  }) : [];
  
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  return {
    ...sale,
    items: items, // InvoiceA4 expects 'items', not 'sale_items'
    subtotal: subtotal,
    discount_amount: sale.discount || 0,
    tax_amount: sale.tax || 0,
    total_amount: sale.total_amount || 0,
    created_at: sale.created_at,
    customer: {
      name: sale.customer_name || 'Umum',
      address: sale.customer_address || '',
      phone: sale.customer_phone || ''
    }
  };
};
```

### 3. **Backend API - api.js**

**File:** `src/lib/api.js`

**Perubahan:**
- Menambahkan field `barcode` pada query JOIN products di `salesAPI.getAll()` (Line 771)
- Menambahkan field `barcode` pada query JOIN products di `salesAPI.getById()` (Line 893)
- Menambahkan transformasi `barcode` ke `sale_items` di kedua fungsi (Lines 818 & 929)

**Kode yang Diubah:**

#### A. `salesAPI.getAll()` - Query (Lines 761-777):

```javascript
let salesQuery = supabase
  .from('sales')
  .select(`
    *,
    user:users!sales_user_id_fkey(name, email),
    customer:customers!sales_customer_id_fkey(name, email, phone),
    sale_items(
      *,
      product:products!sale_items_product_id_fkey(
        name,
        barcode,
        price,
        cost,
        supplier:suppliers!products_supplier_id_fkey(name)
      )
    )
  `);
```

#### B. `salesAPI.getAll()` - Transformation (Lines 815-822):

```javascript
sale_items: sale.sale_items?.map(item => ({
  ...item,
  product_name: item.product?.name || null,
  barcode: item.product?.barcode || null,
  product_price: item.product?.price || null,
  product_cost: item.product?.cost || null,
  supplier_name: item.product?.supplier?.name || null
})) || []
```

#### C. `salesAPI.getById()` - Query (Lines 882-902):

```javascript
const { data: rawData, error } = await supabase
  .from('sales')
  .select(`
    *,
    user:users!sales_user_id_fkey(name, email),
    customer:customers!sales_customer_id_fkey(name, email, phone),
    sale_items(
      *,
      product:products!sale_items_product_id_fkey(
        name,
        barcode,
        price,
        cost,
        supplier:suppliers!products_supplier_id_fkey(name)
      )
    )
  `)
  .eq('id', id)
  .eq('user_id', userData.id)
  .single();
```

#### D. `salesAPI.getById()` - Transformation (Lines 926-933):

```javascript
sale_items: rawData.sale_items?.map(item => ({
  ...item,
  product_name: item.product?.name || null,
  barcode: item.product?.barcode || null,
  product_price: item.product?.price || null,
  product_cost: item.product?.cost || null,
  supplier_name: item.product?.supplier?.name || null
})) || []
```

## Struktur Data

### Data Flow:
1. **Backend (api.js):** Fetch barcode dari tabel `products` via JOIN
2. **Backend (api.js):** Transform dan flatten barcode ke `sale_items[].barcode`
3. **Frontend (ReportsPage.jsx):** Transform `sale_items` ke format `items` untuk InvoiceA4
4. **Frontend (InvoiceA4.jsx):** Render barcode di kolom baru

### Expected Data Structure di InvoiceA4:

```javascript
sale = {
  items: [
    {
      product_name: "Nama Produk",
      barcode: "1234567890",  // Baru ditambahkan
      quantity: 2,
      price: 50000
    }
  ],
  subtotal: 100000,
  discount_amount: 0,
  tax_amount: 0,
  total_amount: 100000,
  customer: {
    name: "Nama Pelanggan",
    address: "Alamat",
    phone: "08123456789"
  }
}
```

## Hasil Tampilan

### Tabel Invoice A4 Sekarang Memiliki Kolom:
1. **Deskripsi** - Nama produk
2. **Barcode** ← BARU
3. **Jumlah** - Quantity
4. **Harga** ← Label diubah (sebelumnya "unitPriceLabel")
5. **Subtotal** - Total harga per item

### Tampilan Barcode:
- Jika produk memiliki barcode: menampilkan barcode-nya
- Jika produk tidak memiliki barcode: menampilkan "-"

## Testing

### Untuk menguji perubahan ini:

1. **Buka halaman Reports** → Tab "Transaksi"
2. **Klik tombol Print** pada salah satu transaksi
3. **Pilih format "Invoice A4"**
4. **Verifikasi:**
   - ✅ Kolom "Barcode" muncul setelah kolom "Deskripsi"
   - ✅ Label "Harga" muncul di header (bukan "unitPriceLabel")
   - ✅ Barcode produk ditampilkan di setiap baris (atau "-" jika kosong)
   - ✅ Print preview A4 berfungsi dengan baik
   - ✅ Data terisi dengan lengkap

## Status

✅ **SELESAI** - Semua perubahan telah diterapkan dan tidak ada linter error

## Files Modified

1. ✅ `src/components/InvoiceA4.jsx` - Tambah kolom Barcode, ganti label Harga
2. ✅ `src/pages/ReportsPage.jsx` - Update `transformSaleForA4` untuk include barcode
3. ✅ `src/lib/api.js` - Update query dan transformasi di `salesAPI.getAll()` dan `salesAPI.getById()`

## Catatan

- Perubahan ini **TIDAK mengubah tampilan frontend secara keseluruhan**, hanya menambahkan kolom data sesuai permintaan user
- Barcode diambil dari database melalui backend API
- Fallback "-" digunakan jika barcode tidak tersedia
- Label "Harga" hardcoded dalam bahasa Indonesia sesuai permintaan

