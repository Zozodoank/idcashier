import { computeRemainingQty, computeReturnStatus } from './returnsCalculations.js';

describe('returnsCalculations', () => {
  const saleItems = [
    { id: 'A', quantity: 2 },
    { id: 'B', quantity: 1 },
  ];

  it('computeReturnStatus returns none when no items returned', () => {
    expect(computeReturnStatus({ saleItems, allReturnItems: [] })).toBe('none');
  });

  it('computeReturnStatus returns partial when some quantities returned', () => {
    expect(
      computeReturnStatus({
        saleItems,
        allReturnItems: [{ sale_item_id: 'A', quantity: 1 }],
      })
    ).toBe('partial');
  });

  it('computeReturnStatus returns full when all quantities returned', () => {
    expect(
      computeReturnStatus({
        saleItems,
        allReturnItems: [
          { sale_item_id: 'A', quantity: 2 },
          { sale_item_id: 'B', quantity: 1 },
        ],
      })
    ).toBe('full');
  });

  it('computeRemainingQty returns remaining quantity per sale_item_id', () => {
    const remaining = computeRemainingQty({
      saleItems,
      allReturnItems: [{ sale_item_id: 'A', quantity: 1 }],
    });

    expect(remaining.get('A')).toBe(1);
    expect(remaining.get('B')).toBe(1);
  });
});

