import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

const HPP_FEE = 50000;

export default function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();

  const planDuration = Number(params.get('plan') || 1);
  const basePrice = Number(params.get('price') || 50000);
  const isRenew = params.get('renew') === '1';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [useHPP, setUseHPP] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => basePrice + (useHPP ? HPP_FEE : 0), [basePrice, useHPP]);

  const handleChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Langkah 1: Buat permintaan pembayaran terlebih dahulu
      const merchantOrderId = `ORDER-${Date.now()}-${form.email}`;
      const productDetails = `Langganan ${planDuration} bulan${useHPP ? ' (+HPP)' : ''}`;

      // Simpan data registrasi di localStorage untuk digunakan setelah pembayaran
      localStorage.setItem('pendingRegistration', JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        planDuration,
        useHPP,
        merchantOrderId
      }));

      // Buat permintaan pembayaran tanpa autentikasi (karena user belum terdaftar)
      const payRes = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/duitku-payment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentAmount: total,
          productDetails,
          merchantOrderId,
          customerVaName: form.name || form.email,
          customerEmail: form.email,
          paymentMethod: 'ALL',
          callbackUrl: `${window.location.origin}/payment-callback?register=1` // Tambahkan parameter untuk menandai ini adalah registrasi
        })
      });
      
      const payJson = await payRes.json();
      if (!payRes.ok) throw new Error(payJson.error || payJson.message || 'Failed to create payment request');

      if (payJson.paymentUrl) {
        // Redirect ke halaman pembayaran Duitku
        window.location.href = payJson.paymentUrl;
        return;
      }

      toast({ title: 'Payment created', description: 'Redirecting to payment page...' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: err.message || 'Checkout failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Daftar dan Checkout</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded bg-muted">
            <div className="text-sm">Paket dipilih: <b>{planDuration} bulan</b></div>
            <div className="text-sm">Harga dasar: <b>Rp{basePrice.toLocaleString('id-ID')}</b></div>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={useHPP}
                onChange={(e) => setUseHPP(e.target.checked)}
              />
              <span>Gunakan HPP (+Rp{HPP_FEE.toLocaleString('id-ID')}). Jika dipilih, nilai tagihan akan bertambah.</span>
            </label>
            <div className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => navigate('/hpp-info')}>
                Pelajari fungsi HPP
              </Button>
            </div>
            <div className="text-sm mt-2">Total: <b>Rp{total.toLocaleString('id-ID')}</b></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input name="name" placeholder="Nama" value={form.name} onChange={handleChange} required />
            <Input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
            <Input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Memproses...' : (isRenew ? 'Perpanjang & Bayar' : 'Daftar & Bayar')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          Dengan melanjutkan, Anda setuju dengan syarat dan ketentuan.
        </CardFooter>
      </Card>
    </div>
  );
}
