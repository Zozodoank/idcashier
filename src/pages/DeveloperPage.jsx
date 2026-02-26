import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, CheckCircle, XCircle, Ban, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { invokeFn } from '@/lib/invokeFn';

const DeveloperPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users with their subscription status
  const fetchUsers = async () => {
    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏰ Developer page data fetch timeout (30s)');
      setLoading(false);
      toast({ 
        title: t('error'), 
        description: t('developerUsersTimeout'),
        variant: 'destructive' 
      });
    }, 30000);

    try {
      setLoading(true);
      console.log('📊 Developer: Starting users fetch...');
      
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Call edge function to get all users with subscription info
      // Use invokeFn (fetch wrapper) instead of supabase-js invoke to bypass client state issues
      
      // Add timeout wrapper and direct fetch to replace invokeFn
      const fetchPromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscriptions-get-all-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fetch users timed out')), 10000)
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      clearTimeout(timeoutId);

      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Edge function already returns users with subscription_status, end_date, etc.
      setUsers(data || []);
      console.log('✅ Developer: Users fetched successfully:', data?.length || 0, 'users');
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Developer: Error fetching users:', error);
      toast({ title: t('error'), description: error.message || t('failedToLoadUsers'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOperation = async (user, operation) => {
    if (!user) return;
    
    // Show confirmation
    let confirmMessage = '';
    if (operation === 'delete') {
      confirmMessage = t('confirmDeleteUser')?.replace('{name}', user.name) || `Apakah Anda yakin ingin menghapus ${user.name}? Tindakan ini tidak dapat dibatalkan.`;
    } else if (operation === 'ban') {
      confirmMessage = t('confirmBanUser')?.replace('{name}', user.name) || `Apakah Anda yakin ingin memblokir ${user.name}?`;
    } else if (operation === 'unban') {
      confirmMessage = t('confirmUnbanUser')?.replace('{name}', user.name) || `Apakah Anda yakin ingin membuka blokir ${user.name}?`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      console.log('🔧 Performing operation:', operation, 'for user:', user.email);
      
      const payload = {
        userId: user.id,
        operation: operation
      };
      
      // Direct fetch to bypass potential client issue
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscriptions-update-user`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('📝 API Response:', { status: response.status, data });

      if (!response.ok) {
        console.error('API Error:', data);
        throw new Error(data.error || data.message || `Failed to ${operation} user (Status: ${response.status})`);
      }

      await fetchUsers();
      toast({ 
        title: t('success'), 
        description:
          operation === 'delete'
            ? t('userRemoved')
            : operation === 'ban'
              ? t('userBlocked')
              : operation === 'unban'
                ? t('userUnblocked')
                : t('success')
      });
    } catch (error) {
      console.error(`Error ${operation} user:`, error);
      toast({ title: t('error'), description: error.message || t('failedToUpdateUser'), variant: 'destructive' });
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return t('noData');
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return t('noData');
      }
      // Use Indonesian locale for consistent formatting
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return t('noData');
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('developer')} - idCashier</title>
        <meta name="description" content={t('developerMetaDesc')} />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('customerManagement')}</h1>
          <p className="text-muted-foreground">
            {t('manageCustomerSubscriptions') || 'Kelola subscription dan status HPP customer yang sudah terdaftar'}
          </p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">{t('customers')}</h2>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <p>{t('loadingUsers')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">{t('no') || 'No'}</th>
                    <th className="text-left p-3">{t('name')}</th>
                    <th className="text-left p-3">{t('email')}</th>
                    <th className="text-left p-3">{t('registeredDate')}</th>
                    <th className="text-left p-3">{t('expiryDate')}</th>
                    <th className="text-left p-3">{t('subscriptionStatus')}</th>
                    <th className="text-left p-3">{t('hppStatusTitle') || 'Status HPP'}</th>
                    <th className="text-left p-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr key={user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">{index + 1}</td>
                      <td className="p-3 font-medium">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3">{formatDate(user.created_at)}</td>
                      <td className="p-3">{formatDate(user.end_date)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {user.subscription_status === 'active' ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-500">{t('active')}</span>
                            </>
                          ) : user.subscription_status === 'expired' ? (
                            <>
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-500">{t('expired')}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-500">{t('noSubscription')}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {(() => {
                          // Edge function may include hpp_enabled / hpp_trial fields; fall back to basic flags
                          const enabled = user.hpp_enabled === true || user.hpp_active === true;
                          const isTrial = user.hpp_is_trial === true;
                          const trialEnd = user.hpp_trial_end || user.hpp_trialEndDate;

                          if (!enabled && !isTrial) {
                            return <span className="text-gray-500 text-sm">{t('noData')}</span>;
                          }

                          if (isTrial) {
                            const endText = trialEnd ? formatDate(trialEnd) : '';
                            return (
                              <span className="text-amber-500 text-sm font-medium">
                                {t('trial') || 'Trial'} {endText ? `(${t('until') || 'hingga'} ${endText})` : ''}
                              </span>
                            );
                          }

                          return (
                            <span className="text-green-500 text-sm font-medium">
                              {t('active')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {user.subscription_status === 'active' && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-orange-500 border-orange-200 hover:bg-orange-50"
                              onClick={() => handleOperation(user, 'ban')}
                              disabled={user.email === 'demo@idcashier.com' || user.email === 'jho.j80@gmail.com'}
                            >
                              <Ban className="w-4 h-4 mr-2" /> 
                              {t('block') || 'Block'}
                            </Button>
                          )}
                          
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            onClick={() => handleOperation(user, 'delete')}
                            disabled={user.email === 'demo@idcashier.com' || user.email === 'jho.j80@gmail.com'}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> 
                            {t('delete')}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default DeveloperPage;
