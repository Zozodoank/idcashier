import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const PAYMENT_METHODS = [
  { code: 'VC', name: 'Credit Card (Visa/Master/JCB)', type: 'Credit Card' },
  { code: 'BC', name: 'BCA Virtual Account', type: 'Virtual Account' },
  { code: 'M2', name: 'Mandiri Virtual Account', type: 'Virtual Account' },
  { code: 'VA', name: 'Maybank Virtual Account', type: 'Virtual Account' },
  { code: 'I1', name: 'BNI Virtual Account', type: 'Virtual Account' },
  { code: 'B1', name: 'CIMB Niaga Virtual Account', type: 'Virtual Account' },
  { code: 'BT', name: 'Permata Virtual Account', type: 'Virtual Account' },
  { code: 'A1', name: 'ATM Bersama', type: 'Virtual Account' },
  { code: 'OV', name: 'OVO', type: 'E-Wallet' },
  { code: 'DA', name: 'DANA', type: 'E-Wallet' },
  { code: 'SA', name: 'Shopee Pay App', type: 'E-Wallet' },
  { code: 'GQ', name: 'QRIS (Gudang Voucher)', type: 'QRIS' },
  { code: 'SP', name: 'QRIS (ShopeePay)', type: 'QRIS' }
];

export default function PaymentMethodSelector({ isOpen, onClose, onSelect, amount }) {
  const { t } = useLanguage();
  
  // Group by type
  const groupedMethods = PAYMENT_METHODS.reduce((acc, method) => {
    if (!acc[method.type]) acc[method.type] = [];
    acc[method.type].push(method);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('selectPaymentMethod') || 'Select Payment Method'}</DialogTitle>
          <DialogDescription>
            {t('selectPaymentMethodDesc') || 'Please select your preferred payment method to complete the transaction of Rp'} {parseInt(amount).toLocaleString('id-ID')}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {Object.entries(groupedMethods).map(([type, methods]) => (
            <div key={type}>
              <h3 className="font-semibold text-sm mb-2 text-muted-foreground">{type}</h3>
              <div className="grid grid-cols-1 gap-2">
                {methods.map((method) => (
                  <Button
                    key={method.code}
                    variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => onSelect(method.code)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{method.name}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={() => onClose(false)}>
          {t('cancel') || 'Cancel'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
