# 🚀 Quick Testing Guide - Fitur Retur

## ⚡ Fast Track Testing (5 menit)

### 1️⃣ Setup Database (WAJIB - 1x saja!)

**Copy & Run SQL ini di Supabase SQL Editor:**

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('returns', 'return_items');

-- If not exist, run full migration:
-- (Copy dari file supabase/migrations/20250127000001_create_returns_table.sql)
```

✅ **Verifikasi:** Tabel `returns` dan `return_items` muncul di Table Editor

---

### 2️⃣ Quick Stock Return Test (2 menit)

**Scenario:** Jual produk → Retur → Check stok kembali

```
┌─────────────────────────────────────────────────────┐
│ 1. BEFORE: Check stok Produk "Laptop" = 5 pcs      │
├─────────────────────────────────────────────────────┤
│ 2. JUAL: 2 pcs Laptop @ Rp 10.000.000 (Tunai)     │
│    → Stok jadi 3 pcs                                │
├─────────────────────────────────────────────────────┤
│ 3. RETUR: Laporan > Transaksi > Klik transaksi     │
│    → Klik "Retur"                                   │
│    → Pilih "Kembalikan Stok"                        │
│    → Qty: 2 pcs                                     │
│    → Submit                                         │
├─────────────────────────────────────────────────────┤
│ 4. VERIFY: Stok Laptop kembali 5 pcs ✅            │
│    Pendapatan berkurang Rp 20.000.000 ✅            │
└─────────────────────────────────────────────────────┘
```

---

### 3️⃣ Quick Loss Return Test (2 menit)

**Scenario:** Retur rugi → Stok TIDAK kembali

```
┌─────────────────────────────────────────────────────┐
│ 1. BEFORE: Check stok Produk "Mouse" = 10 pcs      │
├─────────────────────────────────────────────────────┤
│ 2. JUAL: 3 pcs Mouse @ Rp 50.000 (Tunai)          │
│    → Stok jadi 7 pcs                                │
├─────────────────────────────────────────────────────┤
│ 3. RETUR RUGI:                                      │
│    → Pilih "Rugi"                                   │
│    → Alasan: "Produk rusak"                         │
│    → Qty: 3 pcs                                     │
│    → Submit                                         │
├─────────────────────────────────────────────────────┤
│ 4. VERIFY:                                          │
│    → Stok tetap 7 pcs (tidak kembali) ✅           │
│    → Beban bertambah Rp 150.000 ✅                  │
│    → Laba berkurang ✅                              │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Critical Checks (Must Pass!)

### ✅ Checklist Minimal:

- [ ] **Database Setup**
  - Tabel `returns` ada
  - Tabel `return_items` ada
  - Function `increment_stock` ada

- [ ] **Stock Return Works**
  - Stok bertambah setelah retur
  - Pendapatan berkurang di Laporan Keuangan
  - Dialog retur bisa dibuka

- [ ] **Loss Return Works**
  - Stok TIDAK bertambah setelah retur
  - Beban bertambah di Laporan Keuangan
  - Laba berkurang

- [ ] **UI/UX**
  - Button "Retur" tidak disabled
  - Dialog retur terbuka dengan smooth
  - Toast notification muncul setelah submit

- [ ] **Edge Cases**
  - Tidak bisa retur 2x transaksi yang sama
  - Tidak bisa retur dengan qty = 0
  - Validation error message muncul

---

## 🔍 Where to Look

### Halaman untuk Check:

| Page | Tab | What to Check |
|------|-----|---------------|
| **Penjualan** | - | Buat transaksi baru |
| **Produk** | - | Check stok sebelum/sesudah retur |
| **Laporan** | Transaksi | Klik transaksi → Button "Retur" |
| **Laporan** | Laba Rugi | Check profit changes |
| **Laporan** | Laporan Keuangan | Check PENDAPATAN & BEBAN cards |

### Database untuk Check:

| Table | Check What |
|-------|------------|
| `returns` | Record retur tersimpan |
| `return_items` | Detail item retur |
| `sales` | Column `return_status` updated |
| `products` | Stock updated (for stock return) |

---

## 🐛 Common Issues & Solutions

### Issue 1: Button "Retur" masih disabled
**Solution:** Hard refresh browser (Ctrl + Shift + R)

### Issue 2: Error "Failed to create return"
**Solution:** Check migration sudah dijalankan di Supabase

### Issue 3: Stok tidak bertambah
**Solution:** 
- Check RPC function `increment_stock` sudah dibuat
- Check tipe retur = "stock" (bukan "loss")

### Issue 4: Dialog tidak terbuka
**Solution:** Check console browser untuk error messages

---

## 📊 Expected Results

### After Stock Return:
```
✅ Stock: +2 pcs
✅ Revenue: -Rp 100.000
✅ Profit: -Rp 100.000
✅ Database: return_type = 'stock'
```

### After Loss Return:
```
✅ Stock: No change
✅ Expenses: +Rp 150.000
✅ Profit: -Rp 150.000
✅ Database: return_type = 'loss'
```

---

## 🎬 Testing Video Script

### Record ini untuk dokumentasi:

1. **Setup:**
   - Show Supabase tables
   - Show initial stock

2. **Stock Return:**
   - Create transaction
   - Show stock decreased
   - Open return dialog
   - Select "Kembalikan Stok"
   - Submit
   - Show stock restored
   - Show financial report updated

3. **Loss Return:**
   - Create transaction
   - Show stock decreased
   - Open return dialog
   - Select "Rugi"
   - Submit
   - Show stock NOT restored
   - Show expenses increased

---

## ✅ Sign Off

**Tested By:** _________________

**Date:** _________________

**Status:** [ PASS / FAIL ]

**Notes:**

---

## 📞 Need Help?

Jika menemukan error, catat:
1. Screenshot error
2. Browser console log
3. Network tab (jika API error)
4. Steps yang dilakukan

Kemudian share untuk troubleshooting.

