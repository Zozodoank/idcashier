import { calcChange, calcHppExtraPerUnit, calcTotals } from './salesCalculations.js';

describe('salesCalculations', () => {
  it('calcTotals (IDR) uses minor-unit rounding (0 decimals)', () => {
    const totals = calcTotals({
      items: [
        { price: 10000, quantity: 2 }, // 20.000
        { price: 5000, quantity: 1 },  // 5.000
      ],
      discountPercent: 10,
      taxPercent: 11,
      currencyCode: 'IDR',
    });

    expect(totals.subtotal).toBe(25000);
    expect(totals.discountAmount).toBe(2500);
    expect(totals.taxableAmount).toBe(22500);
    expect(totals.taxAmount).toBe(2475);
    expect(totals.total).toBe(24975);
  });

  it('calcTotals (USD) rounds to cents', () => {
    const totals = calcTotals({
      items: [{ price: 19.99, quantity: 1 }],
      discountPercent: 12.5,
      taxPercent: 8.875,
      currencyCode: 'USD',
    });

    expect(totals.subtotal).toBe(19.99);
    expect(totals.discountAmount).toBe(2.5);
    expect(totals.taxableAmount).toBe(17.49);
    expect(totals.taxAmount).toBe(1.55);
    expect(totals.total).toBe(19.04);
  });

  it('calcChange clamps negative change to 0 for cash', () => {
    expect(
      calcChange({ paymentAmount: 10, total: 12, currencyCode: 'USD', paymentMethod: 'cash' })
    ).toBe(0);
  });

  it('calcChange returns 0 for credit', () => {
    expect(
      calcChange({ paymentAmount: 999, total: 1, currencyCode: 'IDR', paymentMethod: 'credit' })
    ).toBe(0);
  });

  it('calcHppExtraPerUnit (IDR) allocates per unit with rounding', () => {
    // 1000 / 3 = 333.333... -> 333
    expect(calcHppExtraPerUnit({ totalCustomCosts: 1000, totalQty: 3, currencyCode: 'IDR' })).toBe(333);
  });
});

