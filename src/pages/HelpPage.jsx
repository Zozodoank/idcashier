import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Phone, Mail, MessageCircle, MapPin, Globe } from 'lucide-react';

const HelpPage = () => {
  const { t } = useLanguage();

  const contactInfo = {
    whatsapp: '6289525082117',
    phone: '+62 895-2508-2117',
    email: 'support@idcashier.my.id',
    address: 'Jl. Buaran PLN Cikokol No.112, Kota Tangerang, Banten, Indonesia',
    website: 'https://idcashier.my.id'
  };

  const handleWhatsAppClick = () => {
    const message = encodeURIComponent('Halo, saya butuh bantuan terkait idCashier.');
    window.open(`https://wa.me/${contactInfo.whatsapp}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('help') || 'Bantuan'}</h1>
        <p className="text-muted-foreground">
          {t('helpDescription') || 'Hubungi kami jika Anda mengalami kendala atau memiliki pertanyaan.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              WhatsApp Support
            </CardTitle>
            <CardDescription>
              {t('whatsappDescription') || 'Chat langsung dengan tim support kami via WhatsApp.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              onClick={handleWhatsAppClick}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat WhatsApp
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Email Support
            </CardTitle>
            <CardDescription>
              {t('emailDescription') || 'Kirim detail kendala Anda melalui email.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = `mailto:${contactInfo.email}`}
            >
              <Mail className="w-4 h-4 mr-2" />
              {contactInfo.email}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('contactDetails') || 'Informasi Kontak'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Website</p>
              <a href={contactInfo.website} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {contactInfo.website}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t('address') || 'Alamat'}</p>
              <p className="text-sm text-muted-foreground">{contactInfo.address}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HelpPage;
