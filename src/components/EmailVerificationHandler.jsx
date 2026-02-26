// EmailVerificationHandler.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Mail, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const EmailVerificationHandler = () => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error', 'expired'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  
  const { verifyEmail, resendVerification } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Get token and email from URL
        const token = searchParams.get('token');
        const emailParam = searchParams.get('email');
        
        if (!token || !emailParam) {
          setStatus('error');
          setMessage(t('verificationLinkInvalidDesc'));
          return;
        }

        setEmail(emailParam);
        
        console.log('🔍 Starting email verification process...');
        setStatus('verifying');
        
        const result = await verifyEmail(emailParam, token);
        
        if (result.success) {
          setStatus('success');
          setMessage(result.message || t('verificationSuccessDesc'));
          
          toast({
            title: t('verificationSuccess'),
            description: result.message || t('verificationSuccessDesc'),
            variant: 'default',
            className: 'bg-green-600 text-white border-green-600'
          });
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login?verified=true');
          }, 3000);
        } else {
          throw new Error(result.message || t('verificationFailed'));
        }
      } catch (error) {
        console.error('❌ Email verification failed:', error);
        
        let errorStatus = 'error';
        let errorMessage = error.message || t('genericErrorTryAgain');
        
        // Handle specific error types
        if (error.message && error.message.toLowerCase().includes('expired')) {
          errorStatus = 'expired';
          errorMessage = t('verificationLinkExpiredDesc');
        } else if (error.message && error.message.toLowerCase().includes('invalid')) {
          errorMessage = t('verificationLinkInvalidDesc');
        }
        
        setStatus(errorStatus);
        setMessage(errorMessage);
        
        toast({
          title: t('verificationFailed'),
          description: errorMessage,
          variant: 'destructive'
        });
      }
    };

    handleVerification();
  }, [searchParams, verifyEmail, navigate, toast, t]);

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: t('emailRequired'),
        description: t('emailRequiredDesc'),
        variant: 'destructive'
      });
      return;
    }

    setResendLoading(true);
    try {
      const result = await resendVerification(email);
      
      toast({
        title: t('success'),
        description: result.message || t('verificationEmailResent'),
        variant: 'default'
      });
      
    } catch (error) {
      toast({
        title: t('failed'),
        description: error.message || t('failedToResendVerificationEmail'),
        variant: 'destructive'
      });
    } finally {
      setResendLoading(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl font-semibold mb-2">{t('verifyingEmailTitle')}</h2>
            <p className="text-gray-600">{t('verifyingEmailDesc')}</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-4 text-green-600" />
            <h2 className="text-xl font-semibold mb-2 text-green-600">{t('verificationSuccess')}</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">{t('redirectingToLogin')}</p>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <Mail className="h-8 w-8 mx-auto mb-4 text-yellow-600" />
            <h2 className="text-xl font-semibold mb-2 text-yellow-600">{t('verificationLinkExpiredTitle')}</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <Button 
              onClick={handleResendEmail} 
              disabled={resendLoading}
              className="mb-4"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('sending')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('resendVerification')}
                </>
              )}
            </Button>
            <p className="text-sm text-gray-500">
              {t('verificationEmailWillBeSentTo').replace('{email}', email)}
            </p>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="text-center">
            <XCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold mb-2 text-red-600">{t('verificationFailed')}</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            
            {email && (
              <Button 
                onClick={handleResendEmail} 
                disabled={resendLoading}
                variant="outline"
                className="mb-4"
              >
                {resendLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t('sending')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('resendVerification')}
                  </>
                )}
              </Button>
            )}
            
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/login')} 
                variant="default"
                className="w-full"
              >
                {t('backToLogin')}
              </Button>
              <Button 
                onClick={() => navigate('/register')} 
                variant="outline"
                className="w-full"
              >
                {t('createNewAccount')}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('emailVerificationTitle')}
          </CardTitle>
          <CardDescription>
            {t('emailVerificationSubtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationHandler;
