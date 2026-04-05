export interface SubscriptionRow {
  id?: string | null;
  user_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  plan_name?: string | null;
  duration?: number | null;
  amount?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaymentLike {
  amount?: string | number | null;
  product_details?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function parseStoredDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function toDateOnly(value: Date): string {
  const normalized = startOfDay(value);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareTextDesc(a?: string | null, b?: string | null): number {
  return String(b || '').localeCompare(String(a || ''));
}

export function compareSubscriptionsByPriority(
  left: Partial<SubscriptionRow>,
  right: Partial<SubscriptionRow>
): number {
  const endDateCompare = compareTextDesc(left.end_date, right.end_date);
  if (endDateCompare !== 0) return endDateCompare;

  const updatedAtCompare = compareTextDesc(left.updated_at, right.updated_at);
  if (updatedAtCompare !== 0) return updatedAtCompare;

  return compareTextDesc(left.created_at, right.created_at);
}

export function pickEffectiveSubscription<T extends Partial<SubscriptionRow>>(
  subscriptions: T[] | null | undefined
): T | null {
  if (!subscriptions || subscriptions.length === 0) return null;
  return [...subscriptions].sort(compareSubscriptionsByPriority)[0] ?? null;
}

export async function getEffectiveSubscription(
  supabase: any,
  userId: string,
  select = '*'
) {
  return await supabase
    .from('subscriptions')
    .select(select)
    .eq('user_id', userId)
    .order('end_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
}

export function isSubscriptionActive(endDateValue?: string | null, now = new Date()): boolean {
  const endDate = parseStoredDate(endDateValue);
  if (!endDate) return false;

  const today = startOfDay(now);
  endDate.setDate(endDate.getDate() + 1);
  return endDate > today;
}

export function getDerivedSubscriptionStatus(
  endDateValue?: string | null,
  now = new Date()
): 'active' | 'expired' {
  return isSubscriptionActive(endDateValue, now) ? 'active' : 'expired';
}

export function getPlanNameForDuration(durationMonths: number): string {
  switch (durationMonths) {
    case 12:
      return '12_months';
    case 6:
      return '6_months';
    case 3:
      return '3_months';
    default:
      return '1_month';
  }
}

export function calculateExtendedEndDate(
  currentEndDateValue: string | null | undefined,
  durationMonths: number,
  now = new Date()
): Date {
  const today = startOfDay(now);
  const currentEndDate = parseStoredDate(currentEndDateValue);
  const baseDate =
    currentEndDate && isSubscriptionActive(currentEndDateValue, now) ? currentEndDate : today;

  const next = new Date(baseDate);
  next.setDate(next.getDate() + durationMonths * 30);
  return next;
}

export function getRenewalStartDate(
  existingSubscription: Partial<SubscriptionRow> | null | undefined,
  now = new Date()
): Date {
  const today = startOfDay(now);

  if (
    existingSubscription?.start_date &&
    existingSubscription?.end_date &&
    isSubscriptionActive(existingSubscription.end_date, now)
  ) {
    return parseStoredDate(existingSubscription.start_date) || today;
  }

  return today;
}

export function isHppPaymentProduct(productDetails?: string | null): boolean {
  const text = String(productDetails || '').toLowerCase();
  return text.includes('hpp');
}

export function getDurationMonthsFromPayment(payment: PaymentLike): number | null {
  const details = String(payment.product_details || '').toLowerCase();

  if (details.includes('12 bulan') || details.includes('12_month')) return 12;
  if (details.includes('6 bulan') || details.includes('6_month')) return 6;
  if (details.includes('3 bulan') || details.includes('3_month')) return 3;
  if (details.includes('1 bulan') || details.includes('1_month')) return 1;

  const amount =
    typeof payment.amount === 'string' ? Number.parseFloat(payment.amount) : Number(payment.amount);

  if (!Number.isFinite(amount)) return null;
  if (amount === 500000 || amount >= 400000) return 12;
  if (amount === 250000 || amount === 270000 || (amount >= 200000 && amount < 400000)) return 6;
  if (amount === 150000 || (amount >= 100000 && amount < 200000)) return 3;
  if (amount === 50000 || (amount >= 50000 && amount < 100000)) return 1;

  return null;
}

export function isSubscriptionPaymentRecord(payment: PaymentLike): boolean {
  if (isHppPaymentProduct(payment.product_details)) return false;
  return getDurationMonthsFromPayment(payment) !== null;
}

export function deriveSubscriptionWindowFromPayment(
  payment: PaymentLike,
  now = new Date()
): {
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  planName: string;
} | null {
  if (!isSubscriptionPaymentRecord(payment)) return null;

  const durationMonths = getDurationMonthsFromPayment(payment) || 1;
  const startDate =
    parseStoredDate(payment.subscription_start_date) ||
    parseStoredDate(payment.updated_at) ||
    parseStoredDate(payment.created_at) ||
    startOfDay(now);
  const endDate =
    parseStoredDate(payment.subscription_end_date) ||
    calculateExtendedEndDate(toDateOnly(startDate), durationMonths, startDate);

  return {
    startDate,
    endDate,
    durationMonths,
    planName: payment.product_details || getPlanNameForDuration(durationMonths),
  };
}
