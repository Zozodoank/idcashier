import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { Mail, Lock, User } from 'lucide-react';
import { authAPI } from '@/lib/api';
import mcpRegisterClient from '@/lib/mcpRegisterClient';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Use the custom logo.png file
  const logoUrl = "/logo.png";

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!name || !email || !password) {
      toast({ title: 'Error', description: 'Semua field harus diisi', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      // Register user using MCP Register Client
      const registrationResult = await mcpRegisterClient.registerUserWithTrial({
        name: name,
        email: email,
        password: password,
        role: 'owner'
      });

      if (!registrationResult.success) {
        throw new Error(registrationResult.error || 'Registrasi gagal');
      }

      toast({ 
        title: 'Registrasi Berhasil!', 
        description: registrationResult.data.message || 'Akun Anda telah dibuat dengan trial 7 hari gratis.' 
      });

      // Auto-login after successful registration
      const loginResult = await authAPI.login(email, password);

      if (loginResult.user) {
        navigate('/dashboard');
      } else {
        toast({ 
          title: 'Login Gagal', 
          description: 'Silakan login secara manual.', 
          variant: 'destructive' 
        });
        navigate('/login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Registrasi gagal. Silakan coba lagi.', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('register')} - idCashier</title>
        <meta name="description" content={t('registerMetaDesc')} />
      </Helmet>
      
      <div className="min-h-screen gradient-bg flex flex-col">
        <header className="p-4 flex justify-between items-center">
          <LanguageSelector />
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="glass-effect rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="inline-block mb-4"
                >
                  <img src={logoUrl} alt="idCashier Logo" className="w-24 h-24" onError={(e) => {
                    // Fallback to a simple div with text if image fails to load
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }} />
                  <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl mx-auto" 
                       style={{ display: 'none' }}>
                    IC
                  </div>
                </motion.div>
                <h1 className="text-4xl font-bold text-white mb-2">idCashier</h1>
                <p className="text-white/80">{t('tagline')}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">{t('name')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('namePlaceholder') || "Nama Lengkap"}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">{t('email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('emailPlaceholder')}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">{t('password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      placeholder={t('passwordPlaceholder')}
                      required
                      minLength={6}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-purple-600 hover:bg-white/90 font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? t('registering') || 'Mendaftarkan...' : t('register') || 'Daftar'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-white/80">
                  {t('alreadyHaveAccount') || 'Sudah punya akun?'}{' '}
                  <Link 
                    to="/login" 
                    className="text-white hover:text-white underline transition-colors"
                  >
                    {t('login')}
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <footer className="p-6 text-center text-white/80 space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{t('address')}:</span> {t('footerAddress')}
          </p>
          <p className="text-sm">
            <span className="font-semibold">{t('contact')}:</span> {t('footerContact')}
          </p>
        </footer>
      </div>
    </>
  );
}