import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionAPI } from '@/lib/api';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { differenceInDays } from 'date-fns';

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isDemoAccount = user?.email === 'demo@idcashier.my.id';

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !token) return;
      
      // For demo account, always show as active
      if (isDemoAccount) {
        setIsSubscribed(true);
        setSubscriptionEndDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // 1 year from now
        setSubscriptionData({
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          is_active: true
        });
        setLoading(false);
        return;
      }
      
      try {
        // Fetch subscription data from the backend
        const subscription = await subscriptionAPI.getCurrentUserSubscription(token);
        setSubscriptionData(subscription);
        
        if (subscription && subscription.has_subscription !== false) {
          // Normalize dates to start of day (date-only) to avoid timezone boundary issues
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endDate = new Date(subscription.end_date);
          endDate.setHours(0, 0, 0, 0);
          
          // Check if subscription is active
          const isActive = endDate >= today;
          
          setIsSubscribed(isActive);
          setSubscriptionEndDate(subscription.end_date);
        } else {
          // If no subscription data, show that user has no subscription
          setIsSubscribed(false);
          setSubscriptionEndDate(null);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        // If there's any error, show that we couldn't fetch subscription data
        setIsSubscribed(false);
        setSubscriptionEndDate(null);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user, token, isDemoAccount]);

  // Format dates for display
  const formatDate = (dateString) => {
    if (!dateString) return t('noData');
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: id });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!subscriptionEndDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(subscriptionEndDate);
    endDate.setHours(0, 0, 0, 0);
    return differenceInDays(endDate, today);
  };

  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>{t('loadingData')}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('subscription')} - idCashier</title>
        <meta name="description" content={t('subscriptionMetaDesc')} />
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('subscription')}</h1>
          <p className="text-muted-foreground">{t('subscriptionSubtitle')}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isSubscribed ? (
                  <>
                    <CheckCircle />
                    {t('subscriptionStatus')}: {t('active')}
                  </>
                ) : (
                  <>
                    <XCircle />
                    {subscriptionData === null ? t('noSubscription') : t('subscriptionStatus') + ': ' + t('expired')}
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('registeredDate')}</span>
                  </div>
                  <p className="text-2xl font-bold">{user?.created_at ? formatDate(user.created_at) : t('noData')}</p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('expiryDate')}</span>
                  </div>
                  <p className="text-2xl font-bold">{subscriptionEndDate ? formatDate(subscriptionEndDate) : t('noData')}</p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">{t('status')}</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {isSubscribed ? (
                      <span className="text-green-300">{t('active')}</span>
                    ) : subscriptionData === null ? (
                      <span className="text-yellow-300">{t('noSubscription')}</span>
                    ) : (
                      <span className="text-red-300">{t('expired')}</span>
                    )}
                  </p>
                </div>
                <div className="bg-primary/80 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-6 h-6" />
                    <span className="font-semibold">
                      {isExpired ? t('daysOverdue') : t('daysRemaining')}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {subscriptionEndDate ? (
                      <span className={isExpired ? 'text-red-300' : 'text-green-300'}>
                        {daysRemaining !== null ? Math.abs(daysRemaining) : 'N/A'} {t('days')}
                      </span>
                    ) : (
                      t('noData')
                    )}
                  </p>
                </div>
              </div>
              
              {isDemoAccount && (
                <div className="mt-6 p-4 bg-primary/60 rounded-lg">
                  <p className="text-center text-sm">
                    {t('demoModeDesc')}
                  </p>
                </div>
              )}
              
              {!isSubscribed && !isDemoAccount && (
                <div className="mt-6 text-center">
                  <button
                    className="px-6 py-3 rounded bg-white/20 text-white font-semibold backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-all duration-200"
                    onClick={() => navigate('/renewal')}
                  >
                    {subscriptionData === null ? t('getSubscription') : t('renewSubscription')}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default SubscriptionPage;