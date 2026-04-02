import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function exportToExcel(data, fileName, options = {}) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Apply column widths if provided
  if (options.columnWidths) {
    worksheet['!cols'] = options.columnWidths.map(width => ({ wch: width }));
  }
  
  const workbook = XLSX.utils.book_new();
  const sheetName = options.sheetName || 'Data';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

function normalizeDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
}

export function getSubscriptionDaysRemaining(endDate) {
  const normalizedEndDate = normalizeDateOnly(endDate);
  if (!normalizedEndDate) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffInMs = normalizedEndDate.getTime() - today.getTime();

  return Math.round(diffInMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a subscription is still active
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {boolean} - True if subscription is active (endDate >= today)
 */
export function isSubscriptionActive(endDate) {
  const daysRemaining = getSubscriptionDaysRemaining(endDate);
  return daysRemaining !== null && daysRemaining >= 0;
}

export function isSubscriptionExpiringSoon(endDate, warningDays = 10) {
  const daysRemaining = getSubscriptionDaysRemaining(endDate);
  return daysRemaining !== null && daysRemaining >= 1 && daysRemaining <= warningDays;
}

/**
 * Calculate subscription end date based on current subscription status
 * @param {Date} startDate - The start date for new subscription
 * @param {string|null} currentEndDate - Current end date in YYYY-MM-DD format (null if no subscription)
 * @param {number} months - Number of months to add
 * @returns {{start_date: string, end_date: string}} - Object with start_date and end_date in YYYY-MM-DD format
 */
export function calculateSubscriptionEndDate(startDate, currentEndDate, months) {
  let start, end;
  
  if (currentEndDate && isSubscriptionActive(currentEndDate)) {
    // If subscription is still active, extend from current end date
    start = new Date(currentEndDate);
    end = new Date(currentEndDate);
    end.setMonth(end.getMonth() + months);
  } else {
    // If no subscription or expired, start from provided start date
    start = new Date(startDate);
    end = new Date(startDate);
    end.setMonth(end.getMonth() + months);
  }
  
  // Format to YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    start_date: formatDate(start),
    end_date: formatDate(end)
  };
}

/**
 * Format currency based on currency code
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - Currency code (IDR, USD, CNY)
 * @param {boolean} useTwoDecimals - Whether to use 2 decimal places (default: true)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, currencyCode = 'IDR', useTwoDecimals = true) {
  // Map currency code to locale
  const localeMap = {
    'IDR': 'id-ID',
    'USD': 'en-US',
    'CNY': 'zh-CN'
  };
  
  const locale = localeMap[currencyCode] || 'id-ID';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: useTwoDecimals ? 2 : 0,
    maximumFractionDigits: useTwoDecimals ? 2 : 0
  }).format(amount);
}

/**
 * Get currency code from localStorage
 * @param {string} userId - User ID (optional)
 * @returns {string} - Currency code (default: 'IDR')
 */
export function getCurrencyFromStorage(userId) {
  try {
    const key = userId ? `idcashier_general_settings_${userId}` : 'idcashier_general_settings';
    const settings = localStorage.getItem(key);
    
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.currency || 'IDR';
    }
    
    return 'IDR';
  } catch (error) {
    console.error('Error reading currency from storage:', error);
    return 'IDR';
  }
}

/**
 * Get currency symbol from currency code
 * @param {string} currencyCode - Currency code (IDR, USD, CNY)
 * @returns {string} - Currency symbol
 */
export function getCurrencySymbol(currencyCode) {
  const symbolMap = {
    'IDR': 'Rp',
    'USD': '$',
    'CNY': '¥'
  };
  
  return symbolMap[currencyCode] || 'Rp';
}
