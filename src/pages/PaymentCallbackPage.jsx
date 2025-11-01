import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Memproses pembayaran...');
  const isRegistration = params.get('register') === '1';
  const isRenewal = params.get('renewal') === '1';

  useEffect(() => {
    const processPaymentCallback = async () => {
      try {
        // Cek status pembayaran dari parameter URL
        const paymentStatus = params.get('status') || '';
        const resultCode = params.get('resultCode') || params.get('resultcode') || '';
        const result = params.get('result') || '';
        
        // Determine success from multiple indicators: status, resultCode, and result
        const isSuccess = 
          paymentStatus.toLowerCase() === 'success' || 
          paymentStatus.toLowerCase() === 'paid' ||
          resultCode === '00' ||
          result.toLowerCase() === 'success';
        
        if (isSuccess) {
          setStatus('success');
          setMessage('Pembayaran berhasil!');

          // Jika ini adalah proses registrasi, lakukan pendaftaran di Supabase
          if (isRegistration) {
            const pendingRegistration = JSON.parse(localStorage.getItem('pendingRegistration'));

            if (!pendingRegistration) {
              throw new Error('Data registrasi tidak ditemukan');
            }

            // Daftarkan pengguna di Supabase
            const registerRes = await fetch('https://eypfeiqtvfxxiimhtycc.supabase.co/functions/v1/auth-register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: pendingRegistration.name,
                email: pendingRegistration.email,
                password: pendingRegistration.password,
                planDuration: pendingRegistration.planDuration,
                useHPP: pendingRegistration.useHPP,
                merchantOrderId: pendingRegistration.merchantOrderId,
                paymentCompleted: true
              })
            });

            const regJson = await registerRes.json();
            if (!registerRes.ok) throw new Error(regJson.error || regJson.message || 'Register failed');

            // Login otomatis setelah registrasi berhasil
            const loginRes = await login(pendingRegistration.email, pendingRegistration.password);
            if (!loginRes.success || !loginRes.token) {
              throw new Error(loginRes.error || 'Login failed after register');
            }

            // Hapus data pendaftaran dari localStorage
            localStorage.removeItem('pendingRegistration');

            // Redirect ke dashboard setelah 3 detik
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          } else if (isRenewal) {
            // New renewal logic
            toast({
              title: 'Pembayaran Berhasil!',
              description: 'Langganan Anda telah diperpanjang.',
            });

            // Redirect to subscription page after 3 seconds
            setTimeout(() => {
              navigate('/subscription');
            }, 3000);
          } else {
            // Jika bukan registrasi, redirect ke halaman subscription
            setTimeout(() => {
              navigate('/subscription');
            }, 3000);
          }
        } else {
          setStatus('failed');
          setMessage('Pembayaran gagal atau dibatalkan');
          
          // Hapus data pendaftaran dari localStorage jika ini adalah proses registrasi
          if (isRegistration) {
            localStorage.removeItem('pendingRegistration');
          }
          
          // Redirect ke halaman utama setelah 5 detik
          setTimeout(() => {
            navigate('/');
          }, 5000);
        }
      } catch (error) {
        console.error('Payment callback error:', error);
        setStatus('error');
        setMessage(`Error: ${error.message || 'Terjadi kesalahan saat memproses pembayaran'}`);
        
        // Hapus data pendaftaran dari localStorage jika ini adalah proses registrasi
        if (isRegistration) {
          localStorage.removeItem('pendingRegistration');
        }
        
        // Redirect ke halaman utama setelah 5 detik
        setTimeout(() => {
          navigate('/');
        }, 5000);
      }
    };
    
    processPaymentCallback();
  }, [params, navigate, toast, login, isRegistration]);
  
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && 'Memproses Pembayaran'}
            {status === 'success' && 'Pembayaran Berhasil'}
            {status === 'failed' && 'Pembayaran Gagal'}
            {status === 'error' && 'Error'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{message}</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p>{message}</p>
              <p className="text-sm text-muted-foreground">
                {isRegistration
                  ? "Akun Anda telah berhasil dibuat. Anda akan diarahkan ke dashboard dalam beberapa detik."
                  : isRenewal
                  ? "Langganan Anda telah berhasil diperpanjang. Anda akan diarahkan ke halaman langganan dalam beberapa detik."
                  : "Pembayaran Anda telah berhasil diproses. Anda akan diarahkan ke halaman langganan dalam beberapa detik."
                }
              </p>
            </div>
          )}
          
          {status === 'failed' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p>{message}</p>
              <p className="text-sm text-muted-foreground">
                Anda akan diarahkan ke halaman utama dalam beberapa detik.
              </p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-yellow-100 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p>{message}</p>
              <p className="text-sm text-muted-foreground">
                Anda akan diarahkan ke halaman utama dalam beberapa detik.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="w-full max-w-xs"
          >
            Kembali ke Halaman Utama
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
