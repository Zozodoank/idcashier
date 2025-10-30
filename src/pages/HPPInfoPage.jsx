import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const HPPInfoPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Apa itu HPP di idCashier?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p>
            HPP (Harga Pokok Penjualan) pada halaman checkout berfungsi sebagai biaya tambahan tetap 
            yang dapat Anda pilih untuk mengaktifkan fitur-fitur akuntansi biaya di aplikasi, seperti:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Pencatatan biaya dasar barang/produk.</li>
            <li>Laporan laba kotor yang lebih akurat.</li>
            <li>Kontrol stok dan pengeluaran yang lebih detail.</li>
          </ul>
          <p>
            Jika Anda mencentang opsi HPP saat checkout, total tagihan akan bertambah sebesar 
            <b> Rp50.000</b>. Biaya ini digunakan untuk mengaktifkan modul biaya tambahan di akun Anda.
          </p>
          <p>
            Anda dapat tetap berlangganan tanpa HPP. Namun, mengaktifkan HPP membantu bisnis Anda 
            memantau margin dan profitabilitas dengan lebih presisi.
          </p>
          <div className="pt-2">
            <Button onClick={() => navigate(-1)}>Kembali</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HPPInfoPage;


