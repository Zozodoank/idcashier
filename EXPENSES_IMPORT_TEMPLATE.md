# Template Import Pengeluaran (Expenses)

## Format File Excel

File Excel untuk import pengeluaran harus memiliki kolom-kolom berikut:

### Kolom Wajib (Required)

1. **Tanggal** - Tanggal pengeluaran
   - Format: `dd/MM/yyyy` atau `yyyy-MM-dd` atau Excel date
   - Contoh: `27/10/2025` atau `2025-10-27`

2. **Jenis Pengeluaran** - Jenis atau tipe pengeluaran (teks bebas)
   - Contoh: `Listrik`, `Internet`, `Gaji`, `Bahan Baku`, dll.

3. **Harga** - Jumlah nominal pengeluaran
   - Format: Angka (bisa dengan atau tanpa "Rp", titik, atau koma)
   - Contoh: `500000` atau `Rp 500.000` atau `500,000`

### Kolom Opsional (Optional)

4. **Kategori** - Nama kategori pengeluaran
   - Jika kategori belum ada, akan dibuat otomatis
   - Jika kosong, pengeluaran tidak akan memiliki kategori
   - Contoh: `Operasional`, `Utilitas`, `Gaji Karyawan`, dll.

5. **Keterangan** - Catatan atau deskripsi tambahan
   - Teks bebas
   - Contoh: `Bayar listrik bulan Oktober`, `Gaji karyawan Marketing`, dll.

## Contoh Template Excel

| Tanggal    | Jenis Pengeluaran | Kategori     | Harga   | Keterangan                    |
|------------|-------------------|--------------|---------|-------------------------------|
| 01/10/2025 | Listrik           | Utilitas     | 850000  | Bayar listrik bulan Oktober   |
| 05/10/2025 | Internet          | Utilitas     | 500000  | Paket internet bulanan        |
| 10/10/2025 | Gaji Marketing    | Gaji         | 5000000 | Gaji karyawan Marketing       |
| 15/10/2025 | Bahan Baku        | Operasional  | 2500000 | Pembelian bahan baku          |
| 20/10/2025 | Transport         | Operasional  | 150000  | Ongkos kirim barang           |
| 25/10/2025 | Pulsa             | Komunikasi   | 100000  | Pulsa telepon kantor          |

## Cara Import

1. **Persiapkan File Excel** dengan kolom-kolom di atas
2. **Buka Halaman Pengeluaran** di aplikasi
3. **Klik Tombol Import** (icon Download)
4. **Pilih File Excel** (.xlsx atau .xls)
5. **Tunggu Proses Import** - Aplikasi akan:
   - Validasi kolom yang diperlukan
   - Parsing tanggal otomatis
   - Membuat kategori baru jika belum ada
   - Parsing angka dari berbagai format
   - Import semua data yang valid
6. **Lihat Hasil** - Notifikasi akan menampilkan jumlah data yang berhasil dan gagal diimport

## Tips Import

✅ **Do's:**
- Pastikan kolom header sesuai: `Tanggal`, `Jenis Pengeluaran`, `Harga`
- Gunakan format tanggal yang konsisten
- Hapus baris kosong di antara data
- Cek data sebelum import (tidak ada nilai negatif, tanggal valid, dll.)

❌ **Don'ts:**
- Jangan ubah nama kolom wajib
- Jangan kosongkan kolom Tanggal, Jenis Pengeluaran, atau Harga
- Jangan gunakan nilai negatif untuk Harga
- Jangan tambahkan kolom extra yang tidak diperlukan

## Error Handling

Jika import gagal:
- **"File Excel kosong"** → File tidak memiliki data
- **"Kolom yang diperlukan: ..."** → Header kolom tidak sesuai format
- **"X berhasil, Y gagal"** → Beberapa baris tidak valid (nilai 0, tanggal invalid, dll.)
- **"Gagal membaca file Excel"** → File corrupt atau format tidak didukung

## Fitur Auto-Create Category

Sistem akan otomatis membuat kategori baru jika:
- Kolom Kategori diisi
- Kategori dengan nama tersebut belum ada di database
- Kategori baru akan langsung tersedia untuk filter dan pengeluaran lainnya

## Validasi Data

Setiap baris akan divalidasi:
- ✓ Tanggal harus valid (bisa diparsing)
- ✓ Harga harus angka > 0
- ✓ Jenis Pengeluaran tidak boleh kosong
- ✓ Kategori opsional (bisa kosong)
- ✓ Keterangan opsional (bisa kosong)

Baris yang tidak valid akan dilewati dan dihitung sebagai "gagal".

## Download Template

Untuk memudahkan, Anda bisa membuat template Excel sendiri dengan struktur di atas, atau copy-paste contoh di atas ke Excel dan simpan sebagai `.xlsx`.

