## Solusi Timeout Supabase

### Masalah Teridentifikasi
1. ✅ Docker tidak berjalan (Supabase lokal mati)
2. ✅ Menggunakan Supabase Cloud yang lambat
3. ✅ `productsAPI.getAll()` timeout setelah 30 detik
4. ✅ RLS policies mungkin terlalu kompleks

### Solusi Immediate

#### Opsi 1: Tingkatkan Timeout (Quick Fix)
Ubah timeout dari 30s menjadi 60s di `src/lib/api.js`:
```javascript
// Line 670-673
setTimeout(() => {
  console.error('⏰ Products fetch timeout (60s)'); // 30s → 60s
  controller.abort();
}, 60000); // 30000 → 60000
```

#### Opsi 2: Tambahkan Retry Logic (Recommended)
Tambahkan retry dengan exponential backoff:
```javascript
const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
};
```

#### Opsi 3: Optimasi RLS Policy (Long-term)
Simplifikasi RLS policy untuk products table di Supabase Dashboard:
```sql
-- Ganti policy yang kompleks dengan yang sederhana
CREATE POLICY "products_select_policy" ON products FOR SELECT
USING (
  user_id = auth.uid() OR 
  user_id IN (
    SELECT id FROM users 
    WHERE tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  )
);
```

### Rekomendasi
1. **Cek Supabase Dashboard** → Lihat query performance
2. **Simplifikasi RLS** → Kurangi nested query
3. **Tambahkan Index** → `CREATE INDEX idx_products_user_id ON products(user_id);`
4. **Upgrade Plan** jika perlu (jika masih free tier)

### Testing
Setelah fix, test dengan:
1. Buka Chrome DevTools → Network → Slow 3G
2. Refresh halaman
3. Lihat apakah products load atau timeout
