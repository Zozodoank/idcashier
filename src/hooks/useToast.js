import { toast } from 'react-hot-toast';

/**
 * Custom hook for showing toast notifications
 * @returns {Object} Object containing toast functions
 */
export const useToast = () => {
  const showToast = (message, type = 'success') => {
    switch (type) {
      case 'success':
        return toast.success(message);
      case 'error':
        return toast.error(message);
      case 'loading':
        return toast.loading(message);
      default:
        return toast(message);
    }
  };

  const showSuccess = (message) => toast.success(message);
  const showError = (message) => toast.error(message);
  const showLoading = (message) => toast.loading(message);
  const dismiss = (toastId) => toast.dismiss(toastId);
  const dismissAll = () => toast.dismiss();

  return {
    toast: showToast,
    success: showSuccess,
    error: showError,
    loading: showLoading,
    dismiss,
    dismissAll
  };
};