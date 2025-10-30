import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const HPPContext = createContext(null);

export const HPPProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [hppEnabled, setHppEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadHPPSetting = async () => {
    if (!token || !user) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await settingsAPI.get('hpp_enabled', token);
      setHppEnabled(data?.setting_value?.enabled || false);
    } catch (error) {
      console.error('Error loading HPP setting:', error);
      // Default to false if setting doesn't exist
      setHppEnabled(false);
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

