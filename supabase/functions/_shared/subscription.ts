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
  created_at?: string | null;
  updated_at?: string | null;
}

// Keep subscription fallbacks aligned with the columns that exist in payments.
export const SUBSCRIPTION_PAYMENT_SELECT =
  'id, user_id, amount, product_details, created_at, updated_at';

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

// ---------------------------------------------------------------------------
// Free trial
// ---------------------------------------------------------------------------

// Satu-satunya sumber kebenaran durasi free trial di sisi server.
// Client TIDAK boleh mengirim durasi trial (lihat auth-register).
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN_NAME = 'trial';

/**
 * Window trial yang inklusif: [startDate, startDate + TRIAL_DAYS - 1].
 * isSubscriptionActive() menambahkan 1 hari sebelum membandingkan, sehingga
 * rumus ini menghasilkan tepat TRIAL_DAYS hari kalender akses.
 */
export function getTrialWindow(now = new Date()): { startDate: Date; endDate: Date } {
  const startDate = startOfDay(now);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DAYS - 1);
  return { startDate, endDate };
}

export type TrialGrantResult =
  | 'granted'
  | 'already_granted'
  | 'ineligible'
  | 'skipped_existing'
  | 'failed';

function isMissingTrialColumn(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || message.includes('trial_granted_at');
}

/**
 * Berikan trial sekali per akun (idempoten & aman untuk pemanggilan paralel).
 *
 * Urutan langkah penting:
 * 1. Trial hanya untuk akun yang benar-benar bisa dipakai (email terverifikasi).
 * 2. Klaim atomik pada users.trial_granted_at -> penentu tunggal "pernah dapat
 *    trial atau belum", jadi trial tidak pernah dobel dan tidak pernah diulang.
 * 3. Baris subscription yang sudah ada selalu dipertahankan (trial yang sudah
 *    kedaluwarsa tidak pernah diperpanjang).
 */
export async function ensureTrialSubscription(
  supabase: any,
  userId: string,
  opts: { requireVerifiedEmail?: boolean } = {}
): Promise<TrialGrantResult> {
  if (!userId) return 'failed';
  const { requireVerifiedEmail = true } = opts;

  const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(userId);
  if (authUserError || !authUserResult?.user) {
    console.error('ensureTrialSubscription: auth user lookup failed', authUserError?.message);
    return 'failed';
  }

  if (requireVerifiedEmail && !authUserResult.user.email_confirmed_at) {
    console.log('ensureTrialSubscription: email not verified yet, trial deferred', { userId });
    return 'ineligible';
  }

  // Akun yang didaftarkan lewat link paket berbayar tidak berhak atas trial.
  // Tanpa guard ini, pengguna yang membatalkan pembayaran akan mendapat trial
  // gratis saat login berikutnya (regresi alur price card).
  const userMeta = (authUserResult.user.user_metadata || {}) as Record<string, any>;
  if (userMeta.is_price_card_registration === true || userMeta.payment_pending === true) {
    console.log('ensureTrialSubscription: price-card account, trial not applicable', { userId });
    return 'ineligible';
  }

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('users')
    .update({ trial_granted_at: claimedAt })
    .eq('id', userId)
    .is('trial_granted_at', null)
    .select('id');

  let hasClaim = Array.isArray(claimed) && claimed.length > 0;

  if (claimError) {
    if (!isMissingTrialColumn(claimError)) {
      console.error('ensureTrialSubscription: claim failed', claimError.message);
      return 'failed';
    }
    // Migrasi belum dijalankan: kembali ke guard lama (hanya bila belum ada baris)
    // supaya pembuatan trial tidak mati total saat rollout.
    console.warn('ensureTrialSubscription: users.trial_granted_at belum ada, memakai guard lama');
    hasClaim = true;
  }

  const { data: existingSub } = await getEffectiveSubscription(
    supabase,
    userId,
    'id, end_date, status, plan_name'
  );

  if (existingSub) {
    return hasClaim ? 'skipped_existing' : 'already_granted';
  }
  if (!hasClaim) return 'already_granted';

  const { startDate, endDate } = getTrialWindow();
  const { error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      start_date: toDateOnly(startDate),
      end_date: toDateOnly(endDate),
      status: 'active',
      plan_name: TRIAL_PLAN_NAME,
      // Kolom lama: untuk baris trial, pembeda utamanya tetap plan_name.
      duration: TRIAL_DAYS,
    });

  if (insertError) {
    console.error('ensureTrialSubscription: insert failed', insertError.message);
    // Lepas klaim agar percobaan berikutnya masih bisa mendapat trial.
    await supabase.from('users').update({ trial_granted_at: null }).eq('id', userId);
    return 'failed';
  }

  console.log(`ensureTrialSubscription: trial granted to ${userId} (${TRIAL_DAYS} hari)`);
  return 'granted';
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
    parseStoredDate(payment.updated_at) ||
    parseStoredDate(payment.created_at) ||
    startOfDay(now);
  const endDate = calculateExtendedEndDate(toDateOnly(startDate), durationMonths, startDate);

  return {
    startDate,
    endDate,
    durationMonths,
    planName: payment.product_details || getPlanNameForDuration(durationMonths),
  };
}
