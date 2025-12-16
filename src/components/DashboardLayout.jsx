import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSelector from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHPP } from '@/contexts/HPPContext';
import { subscriptionAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import DashboardPage from '@/pages/DashboardPage';
import SalesPage from '@/pages/SalesPage';
import ProductsPage from '@/pages/ProductsPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import DeveloperPage from '@/pages/DeveloperPage';
import EmployeesPage from '@/pages/EmployeesPage';
import ExpensesPage from '@/pages/ExpensesPage';
import {
  LayoutDashboard,
  CreditCard,
  Code,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  Package,
  BarChart,
  Settings,
  Users,
  CalendarClock,
  Receipt,
} from 'lucide-react';

// Safe storage wrapper
const storage = {
  get(key) {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Error reading from localStorage: ${error}`);
        return null;
      }
    }
    return null;
  },
  set(key, val) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, val);
      } catch (error) {
        console.warn(`Error writing to localStorage: ${error}`);
      }
    }
  },
  remove(key) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Error removing from localStorage: ${error}`);
      }
    }
  }
};

// Helper function to resolve user role
const resolveRole = (rawRole) => {
  const r = String(rawRole || 'owner').trim().toLowerCase();
  const map = { owner: 'owner', admin: 'owner', cashier: 'cashier', kasir: 'cashier' };
  return map[r] || 'owner';
};

// Remove onLogout from props
const DashboardLayout = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Add logout function from useAuth hook
  const { user, token, updateUser, logout } = useAuth();
  const { hppEnabled, refreshHPPSetting } = useHPP();
  const [subscriptionInactive, setSubscriptionInactive] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);

  // Simplified state initialization without localStorage access
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  // Email verification is disabled for all users - all users are auto-verified
  const logoUrl = "/logo.png";

  // Hydrate currentPage from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPage = storage.get('idcashier_current_page');
      if (savedPage) {
        setCurrentPage(savedPage);
      }
    }
  }, []);

  // Set responsive default for sidebarOpen on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(min-width: 768px)');
      setSidebarOpen(mq.matches);
    }
  }, []);

  // Effect 1: Fetch subscription status and handle URL params
  useEffect(() => {
    if (!user || !token) return;

    // Check if we need to force refresh (e.g., after payment)
    const urlParams = new URLSearchParams(window.location.search);
    const forceRefresh = urlParams.get('subscription_refreshed') === 'true';
    const hppRefreshed = urlParams.get('hpp_refreshed') === 'true';
    const pageParam = urlParams.get('page');
    const tabParam = urlParams.get('tab');
    
    if (forceRefresh) {
      // Remove the query parameter
      window.history.replaceState({}, '', window.location.pathname);
      // Clear any cached subscription data
      localStorage.removeItem('idcashier_subscription_cache');
      sessionStorage.removeItem('idcashier_subscription_cache');
    }
    
    // Handle HPP refresh flag
    if (hppRefreshed || localStorage.getItem('idcashier_hpp_refresh_needed') === 'true') {
      // Remove the flag
      localStorage.removeItem('idcashier_hpp_refresh_needed');
      // Remove query parameter
      if (hppRefreshed) {
        urlParams.delete('hpp_refreshed');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }
      // Force refresh HPP setting
      if (refreshHPPSetting) {
        console.log('🔄 Force refreshing HPP setting after payment...');
        refreshHPPSetting();
      }
    }
    
    // Handle page and tab parameters (e.g., from store setup redirect)
    if (pageParam === 'settings') {
      handleNavigate('settings');
      // Tab will be handled by SettingsPage component via URL params
    }

    const fetchSub = async () => {
      try {
        // Determine whitelist based on environment variable (demo/dev accounts)
        const whitelist = (import.meta.env.VITE_APP_DEMO_DEV_WHITELIST || 'demo@idcashier.my.id,jho.j80@gmail.com')
          .split(',')
          .map(e => String(e || '').trim().toLowerCase())
          .filter(Boolean);
        const isWhitelisted = whitelist.includes(String(user.email || '').toLowerCase());

        if (isWhitelisted) {
          // Demo/dev accounts are always treated as active regardless of subscription rows
          setSubscriptionInactive(false);
          return;
        }

        let sub = null;
        try {
          if (subscriptionAPI && typeof subscriptionAPI.getCurrentUserSubscription === 'function') {
            // Add cache-busting parameter if force refresh
            const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
            sub = await subscriptionAPI.getCurrentUserSubscription(token);
          }
        } catch (_) {}

        if (sub && sub.end_date) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = new Date(sub.end_date);
          endDate.setHours(0, 0, 0, 0);
          const isActive = endDate >= today;
          setSubscriptionInactive(!isActive);
          setSubscriptionData(sub);
          console.log('📊 Subscription status updated:', { 
            endDate: sub.end_date, 
            isActive, 
            isInactive: !isActive 
          });
        } else {
          setSubscriptionInactive(true);
          setSubscriptionData(null);
        }
      } catch (e) {
        console.error('Error fetching subscription:', e);
        setSubscriptionInactive(false);
      }
    };
    
    // Call fetchSub
    fetchSub();
  }, [user?.email, token]); // Only depend on email and token

  // Effect 2: Generate Menu Items
  useEffect(() => {
    if (!user) return;
    
    const role = resolveRole(user.role);

    const allMenuItems = [
      { id: 'dashboard', label: t?.('dashboard') || 'Dashboard', icon: LayoutDashboard, role: ['owner', 'cashier'] },
      { id: 'sales', label: t?.('sales') || 'Sales', icon: ShoppingCart, role: ['owner', 'cashier'] },
      { id: 'products', label: t?.('products') || 'Products', icon: Package, role: ['owner', 'cashier'] },
      // Conditional: Only show Employees & Expenses if HPP enabled
      ...(hppEnabled ? [
        { id: 'employees', label: t?.('employees') || 'Employees', icon: Users, role: ['owner'] },
        { id: 'expenses', label: t?.('expenses') || 'Pengeluaran', icon: Receipt, role: ['owner'] },
      ] : []),
      { id: 'reports', label: t?.('reports') || 'Reports', icon: BarChart, role: ['owner', 'cashier'] },
      { id: 'settings', label: t?.('settings') || 'Settings', icon: Settings, role: ['owner'] },
      { id: 'subscription', label: t?.('subscription') || 'Langganan', icon: CreditCard, role: ['owner'] },
    ];

    if (user.email === 'jho.j80@gmail.com' && role === 'owner') {
      allMenuItems.push({ id: 'developer', label: t?.('developer') || 'Developer', icon: Code, role: ['owner'] });
    }

    let filtered = allMenuItems.filter(item => item.role.includes(role));

    if (role === 'cashier') {
      const perms = user.permissions;
      filtered = allMenuItems.filter(item => {
        if (!item.role.includes('cashier')) return false;
        if (item.id === 'dashboard') return true;
        if (perms && typeof perms === 'object') {
          return Boolean(perms[item.id]);
        }
        return true;
      });
    }

    // Pastikan dashboard selalu ada
    if (!filtered.some(i => i.id === 'dashboard')) {
      const dash = allMenuItems.find(i => i.id === 'dashboard');
      if (dash) filtered.unshift(dash);
    }

    setMenuItems(filtered);
  // Use primitive dependencies to avoid object reference loops
  }, [t, language, hppEnabled, user?.role, user?.email, JSON.stringify(user?.permissions)]);

  // Calculate optimistic renewal status at top level
  // This allows it to be used in both the banner and the specific page blocking logic
  const renewalPendingTimestamp = typeof window !== 'undefined' ? localStorage.getItem('idcashier_renewal_pending') : null;
  const isRenewalPending = React.useMemo(() => {
     if (!renewalPendingTimestamp) return false;
     const ts = parseInt(renewalPendingTimestamp, 10);
     return !isNaN(ts) && (Date.now() - ts < 300000); // 5 minutes validity
  }, [renewalPendingTimestamp]);

  // Clean up flag if subscription becomes active OR if expired
  useEffect(() => {
    if (!subscriptionInactive && isRenewalPending) {
        localStorage.removeItem('idcashier_renewal_pending');
    }
    // Also auto-expire the flag after 5 minutes to prevent permanent bypass
    if (isRenewalPending) {
        const timeout = setTimeout(() => {
             localStorage.removeItem('idcashier_renewal_pending');
             // Trigger re-render might be needed, but local storage change won't trigger it automatically
             // User will just see expired again on next reload if server not updated.
        }, 300000);
        return () => clearTimeout(timeout);
    }
  }, [subscriptionInactive, isRenewalPending]);

  // Handle navigation redirect if HPP disabled
  useEffect(() => {
    if (!hppEnabled && (currentPage === 'employees' || currentPage === 'expenses')) {
      setCurrentPage('dashboard');
      storage.set('idcashier_current_page', 'dashboard');
    }
  }, [hppEnabled, currentPage]);

  const handleNavigate = (page) => {
    storage.set('idcashier_current_page', page);
    setCurrentPage(page);
  };

  // Create helper function to handle menu clicks
  const handleMenuClick = (page) => {
    handleNavigate(page);
    // Only close sidebar on mobile devices
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Helper function to handle resend verification - DISABLED (email verification is no longer required)
  // All users are now auto-verified, no email verification needed

  const renderPageContent = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'sales': return <SalesPage user={user} />;
      case 'products': return <ProductsPage user={user} />;
      case 'employees': return <EmployeesPage user={user} onUserUpdate={updateUser} />;
      case 'expenses': return <ExpensesPage user={user} />;
      case 'reports': return <ReportsPage user={user} />;
      case 'settings': return <SettingsPage user={user} onUserUpdate={updateUser} />;
      case 'subscription': return <SubscriptionPage />;
      case 'developer': return user.email === 'jho.j80@gmail.com' ? <DeveloperPage /> : <DashboardPage />;
      default: 
        handleNavigate('dashboard');
        return <DashboardPage />;
    }
  };

  const NavButton = ({ item, onClick, isActive }) => (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start text-base py-6"
      onClick={onClick}
    >
      <item.icon className="w-5 h-5 mr-4" />
      {item.label}
    </Button>
  );

  // Show skeleton/placeholder when user is not available
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:inline-flex"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-2">
              <img src={logoUrl} alt="idCashier Logo" className="w-8 h-8" />
              <span className="font-bold text-xl hidden sm:inline">idCashier</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={async () => {
              // Clean logout: Let AuthContext handle all cleanup
              try {
                await logout();
                // AuthContext will handle the redirect
              } catch (e) {
                console.error('Logout error:', e);
                // Fallback: force redirect if logout fails
                if (window.location.pathname !== '/login') {
                  window.location.replace('/login');
                }
              }
            }}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Email Verification Warning Banner */}
      {(() => {
        const whitelist = (import.meta.env.VITE_APP_DEMO_DEV_WHITELIST || 'demo@idcashier.my.id,jho.j80@gmail.com')
          .split(',')
          .map(e => String(e || '').trim().toLowerCase())
          .filter(Boolean);
        const isWhitelisted = whitelist.includes(String(user?.email || '').toLowerCase());
        
        // Check if user is paid user (payment completed)
        const isPaidUser = user?.user_metadata?.payment_completed;
        
        // Email verification banner is disabled for all users - all users are auto-verified
        // No email verification required for trial or paid users
        return null;
      })()}

      {/* Subscription Expired Warning Banner */}
      {(() => {
        const whitelist = (import.meta.env.VITE_APP_DEMO_DEV_WHITELIST || 'demo@idcashier.my.id,jho.j80@gmail.com')
          .split(',')
          .map(e => String(e || '').trim().toLowerCase())
          .filter(Boolean);
        const isWhitelisted = whitelist.includes(String(user?.email || '').toLowerCase());

        // Check if user is paid user
        const isPaidUser = user?.user_metadata?.payment_completed;
        
        // Only show subscription expired if:
        // 1. User is not whitelisted
        // 2. User is not a paid user
        // 3. Subscription is inactive
        // 4. User is verified (email confirmed)
        const isEmailVerified = user?.email_confirmed_at && !user?.user_metadata?.manual_verification_required;
        
        // Hide banner if renewal is pending (optimistic mode)
        if (!isWhitelisted && !isPaidUser && subscriptionInactive && isEmailVerified && !isRenewalPending) {
          return (
            <div className="bg-red-500 text-white px-4 py-3 text-center relative z-40">
              <div className="flex items-center justify-center gap-2">
                <span className="font-medium">
                  ⚠️ Subscription Anda telah berakhir. Lakukan pembayaran agar dapat menggunakan aplikasi kembali.
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-4 bg-white text-red-500 hover:bg-gray-100"
                  onClick={() => handleMenuClick('subscription')}
                >
                  Perpanjang Sekarang
                </Button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div className="flex">
        <aside
          className={`fixed md:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-card transform transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
          <div className="flex flex-col h-full">
            <nav className="flex-1 space-y-2 p-4">
              {menuItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  onClick={() => handleMenuClick(item.id)}
                />
              ))}
            </nav>
            <div className="p-4 border-t">
              <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-sm font-semibold">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-muted/30">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {(() => {
              const whitelist = (import.meta.env.VITE_APP_DEMO_DEV_WHITELIST || 'demo@idcashier.my.id,jho.j80@gmail.com')
                .split(',')
                .map(e => String(e || '').trim().toLowerCase())
                .filter(Boolean);
              const isWhitelisted = whitelist.includes(String(user?.email || '').toLowerCase());
              const isPaidUser = user?.user_metadata?.payment_completed;
              
              // Use top-level optimistic renewal state
              const bypass = isWhitelisted || currentPage === 'subscription' || currentPage === 'developer' || isRenewalPending;
              
              // Block access if:
              // 1. Not whitelisted
              // 2. Not a paid user
              // 3. Subscription inactive
              // 4. Email verification is now disabled - all users are auto-verified
              if (!bypass && !isPaidUser && subscriptionInactive) {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                    <div className="max-w-md w-full p-8 rounded-xl border bg-card shadow-lg">
                       <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                         <CreditCard className="w-8 h-8 text-red-600" />
                       </div>
                       <h2 className="text-2xl font-bold mb-3">{t('subscriptionExpired') || 'Masa Langganan Habis'}</h2>
                       <p className="mb-8 text-muted-foreground leading-relaxed">
                         {t('subscriptionInactiveMessage') || 'Maaf, masa aktif layanan Anda telah berakhir. Akses ke fitur dibatasi hingga Anda melakukan perpanjangan.'}
                       </p>
                       <Button 
                        size="lg" 
                        className="w-full text-lg h-12" 
                        onClick={() => handleMenuClick('subscription')}
                       >
                         {t('renewNow') || 'Perpanjang Sekarang'}
                       </Button>
                    </div>
                  </div>
                );
              }
              return renderPageContent();
            })()}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
