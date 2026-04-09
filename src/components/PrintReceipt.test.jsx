import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReceiptContent } from './PrintReceipt';

const t = (key) => key;

const createReceiptProps = (paperSize, settings = {}) => ({
  cart: [{ id: 'item-1', name: 'Produk Demo', quantity: 2, price: 12000 }],
  subtotal: 24000,
  discountPercent: 0,
  discountAmount: 0,
  taxPercent: 0,
  taxAmount: 0,
  total: 24000,
  paymentAmount: 30000,
  change: 6000,
  customer: { name: 'Pelanggan Demo' },
  paperSize,
  settings,
  useTwoDecimals: false,
  t,
  transactionId: 'INV-TEST',
  cashierName: 'Kasir Demo',
});

describe('ReceiptContent thermal spacing', () => {
  it('uses compact default padding for 58mm', () => {
    const { container } = render(<ReceiptContent {...createReceiptProps('58mm')} />);
    const receipt = container.firstChild;

    expect(receipt.style.padding).toBe('3px 6px');
    expect(receipt.style.lineHeight).toBe('1.3');
  });

  it('uses compact default padding for 80mm', () => {
    const { container } = render(<ReceiptContent {...createReceiptProps('80mm')} />);
    const receipt = container.firstChild;

    expect(receipt.style.padding).toBe('4px 8px');
    expect(receipt.style.lineHeight).toBe('1.3');
  });

  it('respects custom horizontal margin while keeping compact vertical padding', () => {
    const { container } = render(
      <ReceiptContent {...createReceiptProps('58mm', { margin: 2, lineSpacing: 'compact' })} />
    );
    const receipt = container.firstChild;

    expect(receipt.style.padding).toBe('3px 2px');
    expect(receipt.style.lineHeight).toBe('1.15');
  });

  it('renders thermal items in a single row without dashed item separators', () => {
    const { container } = render(<ReceiptContent {...createReceiptProps('58mm')} />);
    const itemRow = container.querySelector('[data-thermal-item-row]');
    const itemGrid = itemRow.firstElementChild;

    expect(itemRow.className).not.toContain('border-dashed');
    expect(itemGrid.style.display).toBe('grid');
    expect(itemGrid.textContent).toContain('Produk Demo');
    expect(itemGrid.textContent).toContain('2 x 12.000');
    expect(itemGrid.textContent).toContain('24.000');
  });

  it('keeps item barcode below the main row when item code is enabled', () => {
    const { container } = render(
      <ReceiptContent
        {...createReceiptProps('80mm', { showItemCode: true })}
        cart={[{ id: 'item-1', name: 'Produk Demo', quantity: 2, price: 12000, barcode: 'BRG-001' }]}
      />
    );
    const itemRow = container.querySelector('[data-thermal-item-row]');

    expect(itemRow.textContent).toContain('BRG-001');
    expect(itemRow.children).toHaveLength(2);
  });
});
