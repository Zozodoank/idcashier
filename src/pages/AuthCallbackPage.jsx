import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Memproses login...');

  // Helper untuk memproses pembayaran ke Duitku
  const processDuitkuPayment = async (plan, user, token) => {
    try {
      setMessage('Menyiapkan pembayaran...');

      const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';

      const paymentResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duitku-payment-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentAmount: parseInt(plan.planPrice, 10),
          productDetails: plan.planName,
          customerVaName: userName,
          email: user.email,
          userId: user.id, // User ID Authentication
          isRegistration: true,
          paymentMethod: plan.paymentMethod
        })
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        throw new Error(paymentData.error || paymentData.message || 'Gagal menyiapkan pembayaran');
      }

      if (paymentData.paymentUrl) {
        // Simpan data pending registration agar bisa diproses setelah bayar
        localStorage.setItem('pendingRegistration', JSON.stringify({
          name: userName,
          email: user.email,
          password: null, // OAuth tidak ada password
          planDuration: parseInt(plan.planDuration, 10),
          merchantOrderId: paymentData.merchantOrderId,
          useHPP: false,
          role: 'owner',
          oauthProvider: 'google'
        }));

        // Hapus data temporary plan
        localStorage.removeItem('pendingOAuthPlan');

        // Redirect ke Payment Gateway
        window.location.href = paymentData.paymentUrl;
        return true;
      } else {
        throw new Error('Payment URL tidak ditemukan');
      }
    } catch (error) {
      console.error('Payment Error:', error);
      setStatus('error');
      setMessage(error.message);

      // Kembalikan ke register jika gagal prepare payment
      setTimeout(() => {
        const params = new URLSearchParams();
        if (plan.planName) params.append('plan', plan.planName);
        if (plan.planPrice) params.append('price', plan.planPrice);
        navigate(`/register?${params.toString()}`);
      }, 3000);
      return false;
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1. Ambil Session dari URL Hash (Supabase default behavior)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          throw new Error('Sesi tidak ditemukan. Silakan login ulang.');
        }

        const user = session.user;
        console.log('✅ Session active for:', user.email);

        // 2. Cek apakah ada Payment Plan yang tertunda (Price Card Flow)
        const pendingOAuthPlan = localStorage.getItem('pendingOAuthPlan');
        const urlParams = new URLSearchParams(window.location.search);
        const isFromPriceCard = !!pendingOAuthPlan || urlParams.get('plan');

        let pendingPlan = {};
        if (pendingOAuthPlan) {
          try { pendingPlan = JSON.parse(pendingOAuthPlan); } catch (e) { }
        }
        // Gabungkan dengan URL params jika ada
        if (urlParams.get('plan')) pendingPlan.planName = urlParams.get('plan');
        if (urlParams.get('price')) pendingPlan.planPrice = urlParams.get('price');
        if (urlParams.get('duration')) pendingPlan.planDuration = urlParams.get('duration');
        if (urlParams.get('paymentMethod')) pendingPlan.paymentMethod = urlParams.get('paymentMethod');

        // 3. Pastikan User Profile ada di Database (Public.Users)
        // INI BAGIAN KRUSIAL: Jangan stuck fetch, tapi langsung INSERT jika tidak ada.
        let profileExists = false;

        try {
          // Coba select simple
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (existingUser) profileExists = true;
        } catch (e) {
          console.warn('Check profile failed, assuming false');
        }

        if (!profileExists) {
          console.log('📝 New User detected. Inserting to DB...');
          // Langsung insert tanpa Auth Function yang ribet
          // Kita set status 'inactive' jika dari price card (sesuai request)
          // Namun karena tabel users mungkin belum punya kolom 'status', kita insert yang standard dulu
          // Status aktif/tidak aktif biasanya dihandle via Subscription table

          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
              role: 'owner',
              tenant_id: user.id,
              // status: isFromPriceCard ? 'inactive' : 'active' // Uncomment jika kolom status sudah ada
            });

          if (insertError) {
            // Ignore if duplicate (race condition)
            if (!insertError.message.includes('duplicate')) {
              console.error('Failed to create user profile:', insertError);
              // Lanjut saja, mungkin backend trigger sudah handle atau store-setup nanti handle
            }
          } else {
            console.log('✅ User profile created via Direct Insert');
          }
        }

        // 4. Logic Routing
        if (isFromPriceCard && pendingPlan.planName) {
          // Flow: Register -> Payment
          console.log('💰 Redirecting to Payment for:', pendingPlan.planName);
          setMessage('Mengarahkan ke pembayaran...');

          if (pendingPlan.paymentMethod) {
            // Proses langsung ke Duitku
            await processDuitkuPayment(pendingPlan, user, session.access_token);
          } else {
            // Payment method belum dipilih, kembali ke register untuk pilih
            toast({ title: 'Info', description: 'Silakan pilih metode pembayaran.' });

            const params = new URLSearchParams();
            params.append('plan', pendingPlan.planName);
            if (pendingPlan.planPrice) params.append('price', pendingPlan.planPrice);
            if (pendingPlan.planDuration) params.append('duration', pendingPlan.planDuration);

            navigate(`/register?${params.toString()}`);
          }
        } else {
          // Flow: Standard Login / Register tanpa paket
          console.log('✅ Standard Login. Redirecting to Dashboard.');
          setStatus('success');
          setMessage('Login berhasil!');

          // Simpan token manual untuk app context
          localStorage.setItem('idcashier_token', session.access_token);

          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        }

      } catch (error) {
        console.error('Auth Callback Failed:', error);
        setStatus('error');
        setMessage(error.message || 'Gagal memproses login.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Mohon Tunggu</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <h2 className="text-xl font-semibold mb-2">Berhasil!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">✗</div>
            <h2 className="text-xl font-semibold mb-2">Masalah Terjadi</h2>
            <p className="text-red-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
