import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const DeveloperPage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', activePeriod: '12' });
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [subscriptionDuration, setSubscriptionDuration] = useState('12');

  // Fetch all users with their subscription status
  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Call edge function to get all users with subscription info
      const { data, error } = await supabase.functions.invoke('subscriptions-get-all-users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch users');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      // Edge function already returns users with subscription_status, end_date, etc.
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: t('error'), description: error.message || t('failedToLoadUsers'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const saveUser = async (userData) => {
    try {
      // For now, we'll just refetch all users
      await fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({ title: t('error'), description: t('failedToSaveUser'), variant: 'destructive' });
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({ title: t('error'), description: t('fillAllFields'), variant: 'destructive' });
      return;
    }

    try {
      // Get auth token
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Register new user through the auth Edge Function
      const { data: authData, error: authError } = await supabase.functions.invoke('auth-register', {
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: 'owner'
        })
      });

      if (authError) {
        throw new Error(authError.message || 'Failed to register user');
      }
      
      if (authData?.error) {
        throw new Error(authData.error);
      }
      
      // Get the newly created user ID from the response
      const newUserId = authData?.user?.id || authData?.id;
      
      if (!newUserId) {
        throw new Error('Failed to get new user ID from registration response');
      }
      
      // Convert activePeriod to number (months)
      const months = parseInt(newUser.activePeriod, 10);
      
      // Create subscription for the new user using subscriptions-update-user
      const { data: subscriptionData, error: subscriptionError } = await supabase.functions.invoke('subscriptions-update-user', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          userId: newUserId,
          months: months
        }
      });

      if (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        toast({ title: t('warning'), description: 'User created but subscription creation failed. Please extend subscription manually.' });
      }
      
      if (subscriptionData?.error) {
        console.error('Error in subscription data:', subscriptionData.error);
        toast({ title: t('warning'), description: 'User created but subscription creation failed. Please extend subscription manually.' });
      }

      setNewUser({ name: '', email: '', password: '', activePeriod: '12' });
      await fetchUsers();
      toast({ title: t('success'), description: t('userAddedWithSubscription') || 'User added successfully with subscription' });
    } catch (error) {
      console.error('Error adding user:', error);
      toast({ title: t('error'), description: error.message || t('failedToAddUser'), variant: 'destructive' });
    }
  };

  const handleEditUser = (user) => {
    setCurrentUser(user);
    setSubscriptionDuration('12'); // Default to 12 months
    setIsEditDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    try {
      const token = localStorage.getItem('idcashier_token');
      if (!token || !currentUser) {
        throw new Error('Not authenticated');
      }
      
      let months;
      if (subscriptionDuration === 'unlimited') {
        months = 1200; // 100 years = effectively unlimited
      } else {
        months = parseInt(subscriptionDuration, 10);
      }
      
      const payload = {
        userId: currentUser.id,
        months: months
      };
      
      console.log('Sending subscription update:', payload);
      
      const { data, error } = await supabase.functions.invoke('subscriptions-update-user', {
        body: JSON.stringify(payload)
      });
      
      console.log('Subscription API response:', { data, error });
      
      if (error) {
        throw new Error(error.message || 'Failed to update subscription');
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      await fetchUsers();
      setIsEditDialogOpen(false);
      toast({ title: t('success'), description: t('subscriptionUpdated') || 'Subscription updated successfully' });
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({ title: t('error'), description: error.message || t('failedToUpdateSubscription'), variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentUser) return;
    
    // Show confirmation
    const confirmMessage = `Apakah Anda yakin ingin menghapus ${currentUser.name}? Tindakan ini tidak dapat dibatalkan.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('idcashier_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Delete user through the users Edge Function (ID in URL params)
      const { data, error } = await supabase.functions.invoke(`users-delete?id=${currentUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }

      await fetchUsers();
      setIsEditDialogOpen(false);
      toast({ title: t('deleted'), description: t('userRemoved') });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: t('error'), description: t('failedToDeleteUser'), variant: 'destructive' });
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
          <p className="text-muted-foreground">{t('developerSubtitle')}</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">{t('addCustomer')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div><Label htmlFor="name">{t('name')}</Label><Input id="name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder={t('customerNamePlaceholder')} /></div>
            <div><Label htmlFor="email">{t('email')}</Label><Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder={t('emailPlaceholder')} /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" /></div>
            <div>
              <Label htmlFor="activePeriod">Masa Aktif</Label>
              <Select value={newUser.activePeriod} onValueChange={(value) => setNewUser({ ...newUser, activePeriod: value })}>
                <SelectTrigger id="activePeriod"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">{t('threeMonths')}</SelectItem>
                  <SelectItem value="6">{t('sixMonths')}</SelectItem>
                  <SelectItem value="12">{t('oneYear')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAddUser} className="w-full md:w-auto"><Plus className="w-4 h-4 mr-2" />{t('addCustomer')}</Button>
        </motion.div>

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
                    <th className="text-left p-3">{t('name')}</th>
                    <th className="text-left p-3">{t('email')}</th>
                    <th className="text-left p-3">{t('registeredDate')}</th>
                    <th className="text-left p-3">{t('expiryDate')}</th>
                    <th className="text-left p-3">{t('subscriptionStatus')}</th>
                    <th className="text-left p-3">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr key={user.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="border-b hover:bg-muted/50">
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
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-4 h-4 mr-2" /> 
                          {t('edit')}
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('editSubscription') || 'Edit Langganan'} - {currentUser?.name}
            </DialogTitle>
            <DialogDescription>
              {t('editSubscriptionDesc') || 'Kelola masa berlangganan dan hapus user'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* User Info (readonly) */}
            <div className="space-y-2">
              <Label>{t('name')}</Label>
              <Input value={currentUser?.name || ''} disabled className="bg-muted" />
            </div>
            
            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input value={currentUser?.email || ''} disabled className="bg-muted" />
            </div>
            
            {/* Subscription Duration Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="duration">{t('subscriptionDuration') || 'Masa Berlangganan'}</Label>
              <Select 
                value={subscriptionDuration} 
                onValueChange={setSubscriptionDuration}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 {t('months') || 'Bulan'}</SelectItem>
                  <SelectItem value="6">6 {t('months') || 'Bulan'}</SelectItem>
                  <SelectItem value="12">1 {t('year') || 'Tahun'}</SelectItem>
                  <SelectItem value="unlimited">{t('unlimited') || 'Tanpa Expired'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
              disabled={currentUser?.email === 'demo@gmail.com'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t('delete') || 'Hapus'}
            </Button>
            <Button onClick={handleSaveSubscription}>
              {t('save') || 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeveloperPage;