import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft, Building2, Target, Lightbulb, Users } from 'lucide-react';

const AboutPage = () => {
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const functions = [
    t('aboutFunction1'),
    t('aboutFunction2'),
    t('aboutFunction3'),
    t('aboutFunction4'),
    t('aboutFunction5')
  ];

  const mission = [
    t('aboutMission1'),
    t('aboutMission2'),
    t('aboutMission3'),
    t('aboutMission4')
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-black text-gray-900 dark:text-white">
      {/* Header */}
      <header className="relative z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/logo.png" alt="idCashier Logo" className="w-8 h-8" />
              <span className="text-xl font-bold">idCashier</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value="id">🇮🇩 ID</option>
              <option value="en">🇬🇧 EN</option>
              <option value="zh">🇨🇳 ZH</option>
            </select>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Button 
          variant="ghost" 
          className="mb-8 pl-0 hover:bg-transparent hover:text-primary" 
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('backToHome')}
        </Button>

        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4 text-lg py-1 px-4">
            {t('aboutCompany')}
          </Badge>
          <h1 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('aboutTitle')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {t('aboutDescription')}
          </p>
          <div className="mt-6 inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-4 py-2 rounded-full font-semibold">
            ✨ {t('aboutExperience')}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>{t('aboutVisionTitle')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('aboutVision')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Lightbulb className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>{t('aboutMissionTitle')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {mission.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2 text-gray-600 dark:text-gray-300">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-0 shadow-xl overflow-hidden mb-16">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full transform translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <CardHeader>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">{t('aboutFunctionsTitle')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {functions.map((item, index) => (
                <div key={index} className="flex items-center p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-shadow">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-green-600 dark:text-green-400 font-bold text-sm">{index + 1}</span>
                  </div>
                  <span className="text-gray-700 dark:text-gray-200">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact/Footer Info reuse */}
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12 border-t pt-8 border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold text-lg mb-4">{t('aboutCompany')}</h3>
          <p className="mb-2">{t('landingAddress')}</p>
          <p>{t('landingPhone')}</p>
          <p className="mt-4 text-sm">© 2024 idCashier. {t('landingRightsReserved')}</p>
        </div>
      </div>
    </div>
  );
};
export default AboutPage;
