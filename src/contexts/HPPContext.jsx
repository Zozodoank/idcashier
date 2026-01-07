import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const HPPContext = createContext(null);

export const HPPProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [hppEnabled, setHppEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hppStatus, setHppStatus] = useState({
    enabled: false,
    isTrial: false,
    trialEndDate: null,
    isExpired: false
  });

  const readOptimisticHPP = () => {
    try {
      const raw = localStorage.getItem('idcashier_hpp_optimistic');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.enabled) return false;
      const ttl = parsed.ttl || 10 * 60 * 1000; // default 10 minutes
      const ts = parsed.ts || 0;
      if (Date.now() - ts > ttl) {
        localStorage.removeItem('idcashier_hpp_optimistic');
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const checkTrialExpiration = (trialEndDate) => {
    if (!trialEndDate) return false;
    const now = new Date();
    const endDate = new Date(trialEndDate);
    return now > endDate;
  };

  const loadHPPSetting = async () => {
    setLoading(true);

    // Quick optimistic path to avoid flicker after payment success
    const optimisticEnabled = readOptimisticHPP();
    console.log('🔄 [HPPContext] Loading HPP setting, optimistic flag:', optimisticEnabled);

    if (!token || !user) {
      console.log('🔄 [HPPContext] No token or user, using optimistic flag:', optimisticEnabled);
      setHppEnabled(optimisticEnabled ? true : false);
      setLoading(false);
      return;
    }
    
    try {
      // For demo account, always enable HPP
      if (user.email === 'demo@idcashier.com') {
        console.log('🔄 [HPPContext] Demo account detected, enabling HPP');
        setHppEnabled(true);
        setHppStatus({
          enabled: true,
          isTrial: false,
          trialEndDate: null,
          isExpired: false
        });
        setLoading(false);
        return;
      }
      
      // For developer account, always enable HPP
      if (user.email === 'jho.j80@gmail.com') {
        console.log('🔄 [HPPContext] Developer account detected, enabling HPP');
        setHppEnabled(true);
        setHppStatus({
          enabled: true,
          isTrial: false,
          trialEndDate: null,
          isExpired: false
        });
        setLoading(false);
        return;
      }
      
      console.log('🔄 [HPPContext] Loading HPP setting for user:', user.email);
      const data = await settingsAPI.get('hpp_enabled', token, user.id);
      const settingValue = data?.setting_value;
      
      let isEnabled = false;
      let isTrial = false;
      let trialEndDate = null;
      let isExpired = false;
      
      if (settingValue) {
        isEnabled = settingValue.enabled || false;
        isTrial = settingValue.isTrial || false;
        trialEndDate = settingValue.trialEndDate || null;
        isExpired = checkTrialExpiration(trialEndDate);
        
        // If trial is expired, disable HPP
        if (isTrial && isExpired) {
          isEnabled = false;
        }
      }
      
      console.log('🔄 [HPPContext] HPP setting loaded:', { 
        data, 
        isEnabled, 
        isTrial, 
        trialEndDate, 
        isExpired, 
        optimisticEnabled 
      });
      
      // Merge backend state with optimistic flag to avoid UI drop right after payment
      // If either backend says enabled OR optimistic flag is set, enable HPP
      const shouldEnable = isEnabled || optimisticEnabled;
      console.log('🔄 [HPPContext] Final HPP state:', { 
        shouldEnable, 
        isEnabled, 
        isTrial, 
        trialEndDate, 
        isExpired, 
        optimisticEnabled 
      });
      
      setHppEnabled(shouldEnable);
      setHppStatus({
        enabled: shouldEnable,
        isTrial: isTrial && !isExpired,
        trialEndDate,
        isExpired
      });
    } catch (error) {
      console.error('❌ [HPPContext] Error loading HPP setting:', error);
      // If there's an error, fall back to optimistic flag if available
      const shouldEnable = optimisticEnabled;
      console.log('🔄 [HPPContext] Error fallback, using optimistic flag:', shouldEnable);
      setHppEnabled(shouldEnable);
      setHppStatus({
        enabled: shouldEnable,
        isTrial: false,
        trialEndDate: null,
        isExpired: false
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHPPSetting();
  }, [token, user]);

  const value = {
    hppEnabled,
    loading,
    hppStatus,
    refreshHPPSetting: loadHPPSetting
  };

  return (
    <HPPContext.Provider value={value}>
      {children}
    </HPPContext.Provider>
  );
};

export const useHPP = () => {
  const context = useContext(HPPContext);
  if (!context) {
    throw new Error('useHPP must be used within HPPProvider');
  }
  return context;
};