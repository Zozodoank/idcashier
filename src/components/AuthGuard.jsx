import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, ensureSession } from '@/lib/supabaseClient';

const AuthGuard = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check session using our enhanced session checker
        const session = await ensureSession();
        
        if (session?.user) {
          setIsAuthenticated(true);
        } else {
          // No valid session, redirect to login
          // Save the attempted URL to redirect back after login
          const redirectTo = location.pathname + location.search;
          navigate(`/login?redirect=${encodeURIComponent(redirectTo)}`, { replace: true });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        navigate('/login', { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location]);

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