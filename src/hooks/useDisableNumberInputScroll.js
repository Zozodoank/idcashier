import { useEffect } from 'react';

/**
 * Custom hook to disable mouse wheel scroll on number inputs
 * Prevents accidental value changes when scrolling the page
 */
export const useDisableNumberInputScroll = () => {
  useEffect(() => {
    const handleWheel = (e) => {
      // Check if the active element is a number input
      if (document.activeElement.type === 'number') {
        e.preventDefault();
        document.activeElement.blur(); // Remove focus to prevent further issues
      }
    };

    // Add event listener to document
    document.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup on unmount
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);
};

export default useDisableNumberInputScroll;

