import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

const Toaster = () => {
  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: '#333',
          color: '#fff',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '14px',
        },
        success: {
          duration: 3000,
          style: {
            background: '#10B981',
            color: '#fff',
          },
        },
        error: {
          duration: 6000,
          style: {
            background: '#EF4444',
            color: '#fff',
          },
        },
      }}
    />
  );
};

export default Toaster;