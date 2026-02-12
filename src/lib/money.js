export function getCurrencyDecimals(currencyCode = 'IDR') {
  const normalized = String(currencyCode || 'IDR').toUpperCase();
  switch (normalized) {
    case 'IDR':
      return 0;
    case 'USD':
    case 'CNY':
      return 2;
    default:
      // Default to 2 decimals for unknown currencies to avoid accidental over-rounding.
      return 2;
  }
}

export function roundMinor(value) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue);
}

export function toMinor(amount, decimals = 0) {
  const safeDecimals = Math.max(0, Number.isFinite(decimals) ? Math.trunc(decimals) : 0);
  const numberAmount = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numberAmount)) return 0;

  const factor = 10 ** safeDecimals;
  return roundMinor(numberAmount * factor);
}

export function fromMinor(minor, decimals = 0) {
  const safeDecimals = Math.max(0, Number.isFinite(decimals) ? Math.trunc(decimals) : 0);
  const numberMinor = typeof minor === 'number' ? minor : Number(minor);
  if (!Number.isFinite(numberMinor)) return 0;

  const factor = 10 ** safeDecimals;
  const major = numberMinor / factor;

  // Normalize to the expected decimal precision to prevent floating artifacts.
  return Number(major.toFixed(safeDecimals));
}

export function normalizeMoneyAmount(amount, currencyCode = 'IDR') {
  const decimals = getCurrencyDecimals(currencyCode);
  return fromMinor(toMinor(amount, decimals), decimals);
}

