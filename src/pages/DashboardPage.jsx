import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, Package, TrendingUp, DollarSign, FolderTree, Truck, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { productsAPI, salesAPI, customersAPI, categoriesAPI, suppliersAPI } from '@/lib/api';

const DashboardPage = () => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  
  const [stats, setStats] = useState([
    {
      title: t('sales'),
      value: 'Rp 0',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
    },
    {
      title: t('products'),
      value: '0',
      icon: Package,
      color: 'from-blue-500 to-cyan-600',
    },
    {
      title: t('categories'),
      value: '0',
      icon: FolderTree,
      color: 'from-indigo-500 to-purple-600',
    },
    {
      title: t('suppliers'),
      value: '0',
      icon: Truck,
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: t('customers'),
      value: '0',
      icon: Users,
      color: 'from-rose-500 to-pink-600',
    },
    {
      title: t('transactions'),
      value: '0',
      icon: ShoppingCart,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: t('growth'),
      value: '0%',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-600',
    },
  ]);
  
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasHydratedFromCache, setHasHydratedFromCache] = useState(false);

  const DASHBOARD_CACHE_KEY = 'idcashier_dashboard_cache_v1';

  // Hydrate dashboard data from localStorage (non-realtime, offline-friendly)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (!raw) return;

      const cached = JSON.parse(raw);

      if (cached?.stats && Array.isArray(cached.stats)) {
        setStats(cached.stats);
      }
      if (cached?.recentTransactions && Array.isArray(cached.recentTransactions)) {
        setRecentTransactions(cached.recentTransactions);
      }
      if (cached?.topProducts && Array.isArray(cached.topProducts)) {
        setTopProducts(cached.topProducts);
      }

      // We already have something to show, don't block UI with loader
      if (
        (cached?.stats && cached.stats.length) ||
        (cached?.recentTransactions && cached.recentTransactions.length) ||
        (cached?.topProducts && cached.topProducts.length)
      ) {
        setLoading(false);
        setHasHydratedFromCache(true);
      }
    } catch (error) {
      console.warn('Failed to load dashboard cache from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    const fetchData = async () => {
      if (!user || !token) {
        console.warn('⚠️ Dashboard: No user or token, skipping fetch');
        if (isMounted) setLoading(false);
        return;
      }
      
      // Set timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        console.error('⏰ Dashboard data fetch timeout (30s)');
        if (isMounted) {
          setLoading(false);
          toast.error(t('dashboardDataTimeout'));
        }
      }, 30000);

      try {
        // Jika belum ada data dari cache, baru tampilkan loading penuh
        if (isMounted && !hasHydratedFromCache) setLoading(true);
        console.log('📊 Dashboard: Starting data fetch...');
        console.log('📊 Dashboard: User:', user.email, 'Token:', token ? 'Present' : 'Missing');
        
        // Fetch data with individual error handling
        const fetchWithRetry = async (fetchFn, name, retries = 2) => {
          for (let i = 0; i <= retries; i++) {
            try {
              // Add specific timeout for each request (5s) to ensure total time < global timeout
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), 5000)
              );
              
              const result = await Promise.race([fetchFn(), timeoutPromise]);
              console.log(`✅ ${name} fetched:`, Array.isArray(result) ? result.length : 'unknown', 'items');
              return Array.isArray(result) ? result : [];
            } catch (err) {
              console.error(`❌ ${name} fetch error (attempt ${i + 1}/${retries + 1}):`, err.message);
              if (i === retries) {
                if (name === 'Products' || name === 'Sales') {
                  toast.error(`${t('failedToLoad')} ${name.toLowerCase()}: ${err.message}`);
                }
                return [];
              }
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
          }
          return [];
        };
        
        // Fetch data with retry logic
        const [products, sales, customers, categories, suppliers] = await Promise.all([
          fetchWithRetry(() => productsAPI.getAll(token), 'Products'),
          fetchWithRetry(() => salesAPI.getAll(token), 'Sales'),
          fetchWithRetry(() => customersAPI.getAll(token), 'Customers'),
          fetchWithRetry(() => categoriesAPI.getAll(token), 'Categories'),
          fetchWithRetry(() => suppliersAPI.getAll(token), 'Suppliers')
        ]);
        
        if (timeoutId) clearTimeout(timeoutId);
        
        if (!isMounted) return;
        
        console.log('✅ Dashboard: Data fetched successfully:', {
          products: products.length,
          sales: sales.length,
          customers: customers.length,
          categories: categories.length,
          suppliers: suppliers.length
        });
        
        // Show info if no data
        if (products.length === 0 && sales.length === 0) {
          toast(t('noDataPleaseAddProducts'), {
            icon: 'ℹ️'
          });
        }
        
        // Calculate Statistics
        const totalSales = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const totalTransactions = sales.length;
        const totalProducts = products.length;
        const totalCustomers = customers.length;
        const totalCategories = categories.length;
        const totalSuppliers = suppliers.length;
        
        // Simple growth calculation (placeholder logic)
        const growth = totalTransactions > 0 ? "5%" : "0%";

        const newStats = [
          {
            title: t('sales'),
            value: `Rp ${totalSales.toLocaleString()}`,
            icon: DollarSign,
            color: 'from-green-500 to-emerald-600',
          },
          {
            title: t('products'),
            value: totalProducts.toString(),
            icon: Package,
            color: 'from-blue-500 to-cyan-600',
          },
          {
            title: t('categories'),
            value: totalCategories.toString(),
            icon: FolderTree,
            color: 'from-indigo-500 to-purple-600',
          },
          {
            title: t('suppliers'),
            value: totalSuppliers.toString(),
            icon: Truck,
            color: 'from-amber-500 to-orange-600',
          },
          {
            title: t('customers'),
            value: totalCustomers.toString(),
            icon: Users,
            color: 'from-rose-500 to-pink-600',
          },
          {
            title: t('transactions'),
            value: totalTransactions.toString(),
            icon: ShoppingCart,
            color: 'from-purple-500 to-pink-600',
          },
          {
            title: t('growth'),
            value: growth,
            icon: TrendingUp,
            color: 'from-orange-500 to-red-600',
          },
        ];

        setStats(newStats);

        // Recent Transactions
        const recent = sales.slice(0, 5).map(s => ({
            id: s.id,
            items: s.sale_items?.length || 0,
            total: s.total_amount,
            date: s.created_at
        }));
        setRecentTransactions(recent);

        // Top Products
        const productSales = {};
        sales.forEach(sale => {
            sale.sale_items?.forEach(item => {
                const name = item.product_name || t('unknownProduct');
                productSales[name] = (productSales[name] || 0) + (Number(item.quantity) || 0);
            });
        });
        
        const top = Object.entries(productSales)
            .map(([name, sold]) => ({ name, sold }))
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5);
            
        setTopProducts(top);

        // Simpan data dashboard ke localStorage agar tetap tersedia
        try {
          if (typeof window !== 'undefined') {
            const cachePayload = {
              stats: newStats,
              recentTransactions: recent,
              topProducts: top,
              updatedAt: Date.now(),
            };
            localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cachePayload));
          }
        } catch (cacheError) {
          console.warn('Failed to save dashboard cache to localStorage:', cacheError);
        }

      } catch (error) {
        console.error('❌ Dashboard: Fatal error:', error);
        if (isMounted) {
          toast.error(`${t('failedToLoadDashboardData')}: ${error.message}`);
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };
    
    // Hanya fetch ketika halaman dibuka / reload dan ada user+token
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [t, user, token, hasHydratedFromCache]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground text-sm">{t('loadingDashboard')}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('dashboard')} - idCashier</title>
        <meta name="description" content={t('dashboardMetaDesc')} />
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('welcome')}, {user?.name || user?.email}!</h1>
          <p className="text-muted-foreground">{t('dashboardSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative overflow-hidden rounded-xl bg-card border shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-10`} />
              <div className="relative p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-4">{t('recentTransactions')}</h2>
            <div className="space-y-4">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction, i) => (
                  <div key={transaction.id || i} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{t('transaction')} #{String(transaction.id).substring(0,8) || 1000 + i}</p>
                      <p className="text-sm text-muted-foreground">{transaction.items} {t('items')}</p>
                    </div>
                    <p className="font-semibold">Rp {(Number(transaction.total) || 0).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                  {t('noTransactions')}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card border rounded-xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-4">{t('topProducts')}</h2>
            <div className="space-y-4">
              {topProducts.length > 0 ? (
                topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sold} {t('sold')}</p>
                    </div>
                    <div 
                      className="w-16 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 
                      style={{ width: `${Math.max(30, 100 - index * 20)}%` }}
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center p-4 text-muted-foreground">
                  {t('noProducts')}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;