import React from 'react';
import { Helmet } from 'react-helmet';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import RegisterPage from '@/pages/RegisterPage';
import RenewalPage from '@/pages/RenewalPage';
import LoginPage from '@/pages/LoginPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PaymentCallbackPage from '@/pages/PaymentCallbackPage';
import DashboardLayout from '@/components/DashboardLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import { HPPProvider } from '@/contexts/HPPContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDisableNumberInputScroll } from '@/hooks/useDisableNumberInputScroll';
import Toaster from '@/components/Toaster';

// ProtectedRoute component to handle authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading user session...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  // Disable mouse wheel scroll on number inputs globally
  useDisableNumberInputScroll();

  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <NavigationProvider>
            <HPPProvider>
              <Router future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true
              }}>
                <Helmet>
                  <title>idCashier - Point of Sale System</title>
                  <meta name="description" content="Modern multi-tenant Point of Sale system for your business" />
                </Helmet>
                <Toaster />
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/renewal" element={<RenewalPage />} />
                  <Route path="/payment-callback" element={<PaymentCallbackPage />} />
                  <Route path="/dashboard/*" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Router>
            </HPPProvider>
          </NavigationProvider>
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;