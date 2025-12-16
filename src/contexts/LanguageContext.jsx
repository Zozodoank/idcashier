import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/lib/translations';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('idcashier_language');
    if (saved) return saved;
    
    // Prioritize Indonesian based on Timezone (fast, synchronous check)
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Check for common Indonesian timezones
      if (timeZone && (
        timeZone.includes('Asia/Jakarta') || 
        timeZone.includes('Asia/Pontianak') || 
        timeZone.includes('Asia/Makassar') || 
        timeZone.includes('Asia/Ujung_Pandang') || 
        timeZone.includes('Asia/Jayapura')
      )) {
        return 'id';
      }
    } catch (e) {
      // Ignore timezone check errors
    }
    
    const browserLang = navigator.language.split('-')[0];
    const supportedLanguages = ['id', 'en', 'zh'];
    return supportedLanguages.includes(browserLang) ? browserLang : 'id';
  });

  // Secondary check using IP Geolocation to ensure users in Indonesia get Indonesian
  // This covers cases where timezone might be incorrect or masked
  useEffect(() => {
    const checkLocation = async () => {
      // Only perform check if no preference is saved and current language is NOT 'id'
      const saved = localStorage.getItem('idcashier_language');
      if (!saved && language !== 'id') {
        try {
          // Use a lightweight, free IP geolocation service
          const response = await fetch('https://api.country.is');
          if (response.ok) {
            const data = await response.json();
            if (data.country === 'ID') {
              setLanguage('id');
            }
          }
        } catch (error) {
          console.warn('Failed to detect country from IP:', error);
        }
      }
    };
    
    checkLocation();
  }, []); // Run once on mount

  useEffect(() => {
    localStorage.setItem('idcashier_language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['id'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
