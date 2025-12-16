import React, { createContext, useState, useContext } from 'react';
import PaymentMethodSelector from '@/components/PaymentMethodSelector';

const PaymentContext = createContext(null);

export const usePayment = () => useContext(PaymentContext);

export const PaymentProvider = ({ children }) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState({
    amount: 0,
    onSelect: () => {},
  });

  const openPaymentModal = (options) => {
    setPaymentOptions(options);
    setIsPaymentModalOpen(true);
  };

  const value = {
    openPaymentModal,
  };

  return (
    <PaymentContext.Provider value={value}>
      {children}
      <PaymentMethodSelector
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        amount={paymentOptions.amount}
        onSelect={(method) => {
          setIsPaymentModalOpen(false);
          paymentOptions.onSelect(method);
        }}
      />
    </PaymentContext.Provider>
  );
};