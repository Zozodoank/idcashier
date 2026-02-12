import { fromMinor, getCurrencyDecimals, normalizeMoneyAmount, roundMinor, toMinor } from './money.js';

function toNumberOrZero(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toIntOrZero(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.trunc(numberValue);
}

export function calcTotals({ items = [], discountPercent = 0, taxPercent = 0, currencyCode = 'IDR' } = {}) {
  const decimals = getCurrencyDecimals(currencyCode);

  const safeItems = Array.isArray(items) ? items : [];
  const safeDiscountPercent = toNumberOrZero(discountPercent);
  const safeTaxPercent = toNumberOrZero(taxPercent);

  const subtotalMinor = safeItems.reduce((sum, item) => {
    const priceMinor = toMinor(item?.price ?? 0, decimals);
    const quantity = Math.max(0, toIntOrZero(item?.quantity ?? 0));
    return sum + priceMinor * quantity;
  }, 0);

  const discountMinor = roundMinor((subtotalMinor * safeDiscountPercent) / 100);
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = roundMinor((taxableMinor * safeTaxPercent) / 100);
  const totalMinor = taxableMinor + taxMinor;

  return {
    subtotal: fromMinor(subtotalMinor, decimals),
    discountAmount: fromMinor(discountMinor, decimals),
    taxableAmount: fromMinor(taxableMinor, decimals),
    taxAmount: fromMinor(taxMinor, decimals),
    total: fromMinor(totalMinor, decimals),
  };
}

export function calcChange({ paymentAmount = 0, total = 0, currencyCode = 'IDR', paymentMethod = 'cash' } = {}) {
  if (paymentMethod === 'credit') return 0;

  const decimals = getCurrencyDecimals(currencyCode);
  const paymentMinor = toMinor(paymentAmount, decimals);
  const totalMinor = toMinor(total, decimals);
  const diffMinor = paymentMinor - totalMinor;

  // Clamp for display; payment validation should prevent negative in persisted data.
  return fromMinor(Math.max(0, diffMinor), decimals);
}

export function calcHppExtraPerUnit({ totalCustomCosts = 0, totalQty = 0, currencyCode = 'IDR' } = {}) {
  const qty = Math.max(0, toIntOrZero(totalQty));
  if (qty <= 0) return 0;

  const decimals = getCurrencyDecimals(currencyCode);
  const totalCustomCostsMinor = toMinor(totalCustomCosts, decimals);
  const perUnitMinor = roundMinor(totalCustomCostsMinor / qty);

  return fromMinor(perUnitMinor, decimals);
}

export function normalizeSaleMoneyFields({ subtotal, discountAmount, taxableAmount, taxAmount, total, paymentAmount, change, currencyCode = 'IDR' } = {}) {
  return {
    subtotal: normalizeMoneyAmount(subtotal, currencyCode),
    discountAmount: normalizeMoneyAmount(discountAmount, currencyCode),
    taxableAmount: normalizeMoneyAmount(taxableAmount, currencyCode),
    taxAmount: normalizeMoneyAmount(taxAmount, currencyCode),
    total: normalizeMoneyAmount(total, currencyCode),
    paymentAmount: normalizeMoneyAmount(paymentAmount, currencyCode),
    change: normalizeMoneyAmount(change, currencyCode),
  };
}

