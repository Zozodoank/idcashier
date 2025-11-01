import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI } from '@/lib/api';
import mcpRegisterClient from '@/lib/mcpRegisterClient';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Register Akun Baru</CardTitle>
          <CardDescription className="text-center">
            Buat akun baru untuk menggunakan idCashier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Mendaftarkan...' : 'Daftar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-gray-600 text-center">
            Sudah punya akun?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:underline font-medium"
              disabled={isLoading}
            >
              Masuk di sini
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}