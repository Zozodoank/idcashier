# 🧪 Testing Checklist - Fitur Retur Barang

## ✅ Pre-requisites

- [ ] Migration SQL sudah dijalankan di Supabase
- [ ] Tabel `returns` dan `return_items` sudah ada
- [ ] Column `return_status` sudah ada di tabel `sales`
- [ ] RPC function `increment_stock` sudah dibuat
- [ ] Dev server sudah running (`npm run dev`)
- [ ] Browser sudah dibuka di localhost

---

## 📝 Test Case 1: Stock Return (Kembalikan Stok)

### Objective
Test bahwa retur dengan tipe "Kembalikan Stok" berfungsi dengan benar:
- Stok produk bertambah
- Pendapatan berkurang
- Laporan keuangan updated

### Steps:

1. **Persiapan:**
   - [ ] Catat stok produk sebelum testing (misal: Produk A = 10 pcs)
   - [ ] Catat total pendapatan di Laporan Keuangan

2. **Buat Transaksi Baru:**
   - [ ] Buka halaman Penjualan
   - [ ] Buat transaksi: Jual 2 pcs Produk A, harga Rp 50.000
   - [ ] Pilih metode: Tunai
   - [ ] Bayar dan selesaikan transaksi
   - [ ] **Expected:** Stok Produk A menjadi 8 pcs

3. **Proses Retur Stock:**
   - [ ] Buka halaman Laporan → Tab "Transaksi"
   - [ ] Klik transaksi yang baru dibuat
   - [ ] Klik tombol "Retur"
   - [ ] **Expected:** Dialog retur terbuka dengan detail transaksi

4. **Isi Form Retur:**
   - [ ] Pilih tipe: "Kembalikan Stok"
   - [ ] Isi alasan: "Produk cacat"
   - [ ] Qty retur: 2 pcs (full return)
   - [ ] **Expected:** Total retur: Rp 100.000

5. **Submit Retur:**
   - [ ] Klik "Proses Retur & Kembalikan Stok"
   - [ ] Konfirmasi dialog yang muncul
   - [ ] **Expected:** Toast sukses muncul

6. **Verifikasi Stok:**
   - [ ] Buka halaman Produk
   - [ ] Check stok Produk A
   - [ ] **Expected:** Stok kembali ke 10 pcs (8 + 2 = 10) ✅

7. **Verifikasi Laporan Keuangan:**
   - [ ] Buka Tab "Laporan Keuangan"
   - [ ] Check card "PENDAPATAN"
   - [ ] **Expected:** Ada row "Retur (Kembalikan Stok): -Rp 100.000" ✅
   - [ ] **Expected:** Total Pendapatan Bersih berkurang Rp 100.000 ✅

8. **Verifikasi Export Excel:**
   - [ ] Klik tombol Export di Tab Laporan Keuangan
   - [ ] Buka file Excel
   - [ ] **Expected:** Ada row "Retur (Kembalikan Stok)" dengan nilai -Rp 100.000 ✅

### Result: ✅ / ❌

---

## 📝 Test Case 2: Loss Return (Retur Rugi)

### Objective
Test bahwa retur dengan tipe "Rugi" berfungsi dengan benar:
- Stok produk TIDAK bertambah
- Beban operasional bertambah
- Laporan keuangan updated

### Steps:

1. **Persiapan:**
   - [ ] Catat stok produk sebelum testing (misal: Produk B = 15 pcs)
   - [ ] Catat total beban di Laporan Keuangan

2. **Buat Transaksi Baru:**
   - [ ] Jual 3 pcs Produk B, harga Rp 75.000
   - [ ] Metode: Tunai, bayar dan selesaikan
   - [ ] **Expected:** Stok Produk B menjadi 12 pcs

3. **Proses Retur Loss:**
   - [ ] Buka Laporan → Tab "Transaksi"
   - [ ] Klik transaksi Produk B
   - [ ] Klik tombol "Retur"

4. **Isi Form Retur:**
   - [ ] Pilih tipe: "Rugi"
   - [ ] Isi alasan: "Produk rusak tidak bisa dijual"
   - [ ] Qty retur: 3 pcs (full return)
   - [ ] **Expected:** Total retur: Rp 225.000

5. **Submit Retur:**
   - [ ] Klik "Proses Retur sebagai Rugi"
   - [ ] Konfirmasi
   - [ ] **Expected:** Toast sukses muncul

6. **Verifikasi Stok:**
   - [ ] Check stok Produk B
   - [ ] **Expected:** Stok tetap 12 pcs (TIDAK bertambah) ✅

7. **Verifikasi Laporan Keuangan:**
   - [ ] Tab "Laporan Keuangan" → Card "BEBAN"
   - [ ] **Expected:** Ada row "Retur Rugi (Tidak Kembali): Rp 225.000" ✅
   - [ ] Tab "Laporan Keuangan" → Card "LABA/RUGI"
   - [ ] **Expected:** Ada row "Retur Rugi: -Rp 225.000" ✅
   - [ ] **Expected:** Laba Bersih berkurang Rp 225.000 ✅

8. **Verifikasi Export Excel:**
   - [ ] Export → Check section BEBAN
   - [ ] **Expected:** Ada row "Retur Rugi (Tidak Dikembalikan): Rp 225.000" ✅

### Result: ✅ / ❌

---

## 📝 Test Case 3: Partial Return (Retur Sebagian)

### Objective
Test retur sebagian item dari transaksi

### Steps:

1. **Buat Transaksi Multi-Item:**
   - [ ] Jual: 5 pcs Produk C @ Rp 20.000 = Rp 100.000
   - [ ] Jual: 3 pcs Produk D @ Rp 30.000 = Rp 90.000
   - [ ] Total: Rp 190.000
   - [ ] Bayar dan selesaikan

2. **Retur Partial:**
   - [ ] Buka dialog retur
   - [ ] Ubah qty Produk C menjadi 2 pcs (dari 5)
   - [ ] Ubah qty Produk D menjadi 0 pcs (tidak diretur)
   - [ ] **Expected:** Total retur: Rp 40.000

3. **Submit:**
   - [ ] Pilih tipe: Kembalikan Stok
   - [ ] Submit retur
   - [ ] **Expected:** Sukses

4. **Verifikasi:**
   - [ ] Stok Produk C bertambah 2 pcs ✅
   - [ ] Stok Produk D tidak berubah ✅
   - [ ] Pendapatan berkurang Rp 40.000 ✅
   - [ ] Transaction status: `partial` (di database)

### Result: ✅ / ❌

---

## 📝 Test Case 4: Edge Cases

### 4.1 Double Return (Retur 2x)

- [ ] Coba retur transaksi yang sudah diretur full
- [ ] **Expected:** Error message "Transaksi ini sudah diretur sepenuhnya" ✅

### 4.2 Zero Quantity Return

- [ ] Buka dialog retur
- [ ] Set semua qty menjadi 0
- [ ] Coba submit
- [ ] **Expected:** Error message "Pilih minimal 1 item untuk diretur" ✅

### 4.3 Credit Transaction Return

- [ ] Buat transaksi kredit (unpaid)
- [ ] Coba retur
- [ ] **Expected:** Dialog retur terbuka dan bisa diproses ✅

### 4.4 Database Integrity

- [ ] Buka Supabase Table Editor → `returns`
- [ ] **Expected:** Ada record retur dengan `return_type` = 'stock' atau 'loss' ✅
- [ ] Check `return_items` → **Expected:** Ada detail item yang diretur ✅
- [ ] Check `sales.return_status` → **Expected:** 'partial' atau 'full' ✅

### Result: ✅ / ❌

---

## 📝 Test Case 5: UI/UX Testing

### Dialog Retur:

- [ ] Dialog terbuka dengan smooth animation
- [ ] Transaction info ditampilkan lengkap
- [ ] Dropdown tipe retur berfungsi
- [ ] Input alasan berfungsi
- [ ] Input qty bisa diubah dengan number input
- [ ] Qty tidak bisa melebihi qty asli
- [ ] Qty tidak bisa negatif
- [ ] Total retur calculate real-time saat qty diubah
- [ ] Button "Proses" wording berubah sesuai tipe retur
- [ ] Button "Batal" menutup dialog

### Financial Report:

- [ ] Return rows hanya muncul jika ada returns
- [ ] Conditional rendering bekerja dengan baik
- [ ] Formatting currency correct
- [ ] Color coding sesuai (red untuk deduction)

### Result: ✅ / ❌

---

## 📝 Test Case 6: Performance Testing

### Load Testing:

1. **Multiple Returns:**
   - [ ] Proses 10 retur berturut-turut
   - [ ] **Expected:** Tidak ada lag atau error
   - [ ] Data refresh correctly

2. **Large Transaction Return:**
   - [ ] Buat transaksi dengan 20+ items
   - [ ] Proses retur
   - [ ] **Expected:** Dialog scroll berfungsi
   - [ ] **Expected:** Submit tanpa timeout

### Result: ✅ / ❌

---

## 🎯 Summary Checklist

- [ ] ✅ Stock return mengembalikan stok
- [ ] ✅ Loss return tidak mengembalikan stok
- [ ] ✅ Laporan keuangan updated correctly
- [ ] ✅ Export Excel include returns
- [ ] ✅ Partial return supported
- [ ] ✅ Edge cases handled
- [ ] ✅ UI/UX responsive dan user-friendly
- [ ] ✅ Performance baik
- [ ] ✅ Database integrity maintained

---

## 🐛 Bug Report Template

Jika menemukan bug, catat di sini:

### Bug #1:
- **Deskripsi:** 
- **Steps to reproduce:**
- **Expected behavior:**
- **Actual behavior:**
- **Screenshots:**

---

## ✅ Final Verdict

**Overall Status:** [ PASS / FAIL ]

**Notes:**

**Ready for Production:** [ YES / NO ]

