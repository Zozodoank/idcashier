import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart, Package, TrendingUp, DollarSign, FolderTree, Truck, Users } from 'lucide-react';
import { useEdgeFunction } from '@/hooks/useEdgeFunction';
import { toast } from 'react-hot-toast';

const DashboardPage = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  // Use our custom hook for each dashboard function
  const { 
    data: statsData, 
    loading: statsLoading, 
    error: statsError,
    invoke: invokeStats
  } = useEdgeFunction('dashboard-stats');
  
  const { 
    data: transactionsData, 
    loading: transactionsLoading, 
    error: transactionsError,
    invoke: invokeTransactions
  } = useEdgeFunction('dashboard-recent-transactions');
  
  const { 
    data: productsData, 
    loading: productsLoading, 
    error: productsError,
    invoke: invokeProducts
  } = useEdgeFunction('dashboard-top-products');

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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch all dashboard data in parallel using our custom hook
        await Promise.all([
          invokeStats(),
          invokeTransactions(),
          invokeProducts()
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Gagal memuat data dashboard');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [t, user, invokeStats, invokeTransactions, invokeProducts]);

  // Update UI when data changes
  useEffect(() => {
    if (statsData) {
      setStats([
        {
          title: t('sales'),
          value: `Rp ${statsData.totalSales.toLocaleString()}`,
          icon: DollarSign,
          color: 'from-green-500 to-emerald-600',
        },
        {
          title: t('products'),
          value: statsData.totalProducts.toString(),
          icon: Package,
          color: 'from-blue-500 to-cyan-600',
        },
        {
          title: t('categories'),
          value: statsData.totalCategories.toString(),
          icon: FolderTree,
          color: 'from-indigo-500 to-purple-600',
        },
        {
          title: t('suppliers'),
          value: statsData.totalSuppliers.toString(),
          icon: Truck,
          color: 'from-amber-500 to-orange-600',
        },
        {
          title: t('customers'),
          value: statsData.totalCustomers.toString(),
          icon: Users,
          color: 'from-rose-500 to-pink-600',
        },
        {
          title: t('transactions'),
          value: statsData.totalTransactions.toString(),
          icon: ShoppingCart,
          color: 'from-purple-500 to-pink-600',
        },
        {
          title: t('growth'),
          value: statsData.growth,
          icon: TrendingUp,
          color: 'from-orange-500 to-red-600',
        },
      ]);
    }
  }, [statsData, t]);

  useEffect(() => {
    if (transactionsData) {
      setRecentTransactions(transactionsData);
    }
  }, [transactionsData]);

  useEffect(() => {
    if (productsData) {
      setTopProducts(productsData);
    }
  }, [productsData]);

  // Show loading state
  if (loading || statsLoading || transactionsLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
                      <p className="font-medium">{t('transaction')} #{1000 + (transaction.id || i)}</p>
                      <p className="text-sm text-muted-foreground">{transaction.items || 1} {t('items')}</p>
                    </div>
                    <p className="font-semibold">Rp {(transaction.total || 0).toLocaleString()}</p>
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