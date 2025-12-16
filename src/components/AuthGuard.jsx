import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ensureSession } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const AuthGuard = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);

        // 1) Jika token aplikasi ada (hasil login biasa), anggap sudah terautentikasi
        if (token) {
          setIsAuthenticated(true);
          return;
        }

        // 2) Jika tidak ada token aplikasi, cek session Supabase (untuk login via magic link / email)
        const session = await ensureSession();

        if (session?.user) {
          setIsAuthenticated(true);
        } else {
          // Tidak ada sesi valid, redirect ke login
          const redirectTo = location.pathname + location.search;
          
          // Check if we are already redirection to prevent loops
          if (location.pathname !== '/login') {
             navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (location.pathname !== '/login') {
            navigate('/login', { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location, token]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render children only if authenticated
  return isAuthenticated ? children : null;
};

export default AuthGuard;