import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageIcon } from 'lucide-react';
import { storeSettingsAPI } from '@/lib/api';

const StoreSetupPage = () => {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    businessOwnerName: '',
    address: '',
    npwp: '',
    phone: '',
    bankAccount: '',
    logo: '/logo.png'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: t('error'), description: t('logoTooLarge'), variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.businessOwnerName) {
      toast({ title: t('error'), description: t('storeNameOwnerRequired'), variant: "destructive" });
      return;
    }

    if (!user || !user.id) {
      toast({ title: t('error'), description: t('userNotAuthenticated'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Use the new store-setup Edge Function
      const token = localStorage.getItem('idcashier_token');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeName: formData.name,
          storeAddress: formData.address,
          storePhone: formData.phone,
          storeDescription: `Owner: ${formData.businessOwnerName}`, // Map owner name to description or metadata
          // Add other fields as needed by the Edge Function
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to setup store');
      }

      // Also save to settings table for backward compatibility if needed, 
      // or rely on the Edge Function to do everything.
      // For now, we trust the Edge Function did the heavy lifting.

      // If we still want to save detailed settings that the Edge Function might miss:
      try {
        const storeSettings = {
          name: formData.name,
          businessOwnerName: formData.businessOwnerName,
          address: formData.address,
          phone: formData.phone,
          bankAccount: formData.bankAccount,
          logo: formData.logo,
          npwp: formData.npwp
        };
        await storeSettingsAPI.save(
          storeSettings,
          {},
          {},
          user.id,
          token
        );
      } catch (settingsError) {
        console.warn('Secondary settings save failed:', settingsError);
        // Don't block success if Edge Function worked
      }

      toast({ title: t('success'), description: t('storeDataSaved') });

      // Redirect to main dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error) {
      console.error('Store setup error:', error);
      toast({
        title: t('error'),
        description: error.message || t('storeDataSaveFailed'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Helmet><title>{t('storeSetup')} - idCashier</title></Helmet>
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{t('storeSetup')}</CardTitle>
          <CardDescription>{t('completeStoreDataToStart')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">{t('storeName')} <span className="text-red-500">*</span></Label>
                <Input id="name" value={formData.name} onChange={handleChange} required placeholder={t('storeNamePlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessOwnerName">{t('businessOwnerName')} <span className="text-red-500">*</span></Label>
                <Input id="businessOwnerName" value={formData.businessOwnerName} onChange={handleChange} required placeholder={t('businessOwnerPlaceholder')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t('storeAddress')}</Label>
              <Input id="address" value={formData.address} onChange={handleChange} placeholder={t('addressPlaceholder')} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="npwp">{t('npwp')}</Label>
                <Input id="npwp" value={formData.npwp} onChange={handleChange} placeholder={t('npwpPlaceholder')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('storePhone')}</Label>
                <Input id="phone" value={formData.phone} onChange={handleChange} placeholder={t('phonePlaceholder')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankAccount">{t('bankAccount')}</Label>
              <Input id="bankAccount" value={formData.bankAccount} onChange={handleChange} placeholder={t('bankAccountPlaceholder')} />
            </div>

            <div className="space-y-2">
              <Label>{t('storeLogo')}</Label>
              <div className="flex items-center gap-6 border p-4 rounded-lg bg-white">
                {formData.logo ? (
                  <img src={formData.logo} alt={t('logo')} className="w-24 h-24 rounded-md border p-1 object-contain" />
                ) : (
                  <div className="w-24 h-24 rounded-md border flex items-center justify-center bg-muted">
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                  <Button type="button" variant="outline" onClick={() => logoInputRef.current.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" /> {t('uploadLogo')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">{t('logoUploadHint')}</p>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-end">
              <Button type="submit" disabled={loading} className="w-full md:w-auto" size="lg">
                {loading ? t('saving') : t('saveAndContinue')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreSetupPage;
