import { describe, expect, it } from 'vitest';
import {
  deriveSubscriptionWindowFromPayment,
  isSubscriptionActive,
  pickEffectiveSubscription,
  SUBSCRIPTION_PAYMENT_SELECT,
  toDateOnly,
} from './subscription';

describe('pickEffectiveSubscription', () => {
  it('prefers the row with the farthest end_date', () => {
    const picked = pickEffectiveSubscription([
      {
        id: 'expired-row',
        end_date: '2026-04-04',
        updated_at: '2026-04-04T10:00:00.000Z',
        created_at: '2026-04-04T10:00:00.000Z',
      },
      {
        id: 'active-row',
        end_date: '2027-04-05',
        updated_at: '2026-04-05T10:00:00.000Z',
        created_at: '2026-04-05T10:00:00.000Z',
      },
    ]);

    expect(picked?.id).toBe('active-row');
  });

  it('uses updated_at as a tie-breaker when end_date matches', () => {
    const picked = pickEffectiveSubscription([
      {
        id: 'older-row',
        end_date: '2027-04-05',
        updated_at: '2026-04-05T09:00:00.000Z',
        created_at: '2026-04-05T09:00:00.000Z',
      },
      {
        id: 'newer-row',
        end_date: '2027-04-05',
        updated_at: '2026-04-05T10:00:00.000Z',
        created_at: '2026-04-05T10:00:00.000Z',
      },
    ]);

    expect(picked?.id).toBe('newer-row');
  });
});

describe('isSubscriptionActive', () => {
  it('treats end_date as inclusive for the current day', () => {
    expect(isSubscriptionActive('2026-04-05', new Date('2026-04-05T12:00:00+07:00'))).toBe(true);
    expect(isSubscriptionActive('2026-04-04', new Date('2026-04-05T12:00:00+07:00'))).toBe(false);
  });
});

describe('deriveSubscriptionWindowFromPayment', () => {
  it('uses only payment columns that exist in production', () => {
    expect(SUBSCRIPTION_PAYMENT_SELECT).toBe(
      'id, user_id, amount, product_details, created_at, updated_at'
    );
    expect(SUBSCRIPTION_PAYMENT_SELECT).not.toContain('subscription_start_date');
    expect(SUBSCRIPTION_PAYMENT_SELECT).not.toContain('subscription_end_date');
  });

  it('ignores HPP activation payments', () => {
    const window = deriveSubscriptionWindowFromPayment({
      amount: 50000,
      product_details: 'Aktivasi HPP - Perpanjangan Langganan 1 Bulan',
      updated_at: '2026-04-05T10:00:00.000Z',
    });

    expect(window).toBeNull();
  });

  it('derives dates from completed subscription payments', () => {
    const window = deriveSubscriptionWindowFromPayment({
      amount: 500000,
      product_details: 'Perpanjangan Langganan 12 Bulan',
      updated_at: '2026-04-05T10:00:00.000Z',
    });

    expect(window?.durationMonths).toBe(12);
    expect(window ? toDateOnly(window.startDate) : null).toBe('2026-04-05');
    expect(window ? toDateOnly(window.endDate) : null).toBe('2027-03-31');
  });

  it('keeps an active payment fallback when the stored subscription is expired', () => {
    const paymentWindow = deriveSubscriptionWindowFromPayment({
      amount: 50000,
      product_details: 'Perpanjangan Langganan 1 Bulan',
      updated_at: '2026-07-20T10:00:00.000Z',
    });

    const effective = pickEffectiveSubscription([
      { id: 'expired-subscription', end_date: '2026-06-30' },
      { id: 'payment-fallback', end_date: toDateOnly(paymentWindow!.endDate) },
    ]);

    expect(effective?.id).toBe('payment-fallback');
    expect(isSubscriptionActive(effective?.end_date, new Date('2026-07-24T12:00:00+07:00'))).toBe(true);
  });
});
