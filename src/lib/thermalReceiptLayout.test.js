import { describe, expect, it } from 'vitest';
import {
  getDefaultThermalMargin,
  getThermalReceiptLayout,
  resolveReceiptMargin,
} from './thermalReceiptLayout';

describe('thermalReceiptLayout', () => {
  it('returns compact thermal defaults for 58mm', () => {
    const layout = getThermalReceiptLayout('58mm', 'normal');

    expect(layout.verticalPaddingPx).toBe(3);
    expect(layout.defaultHorizontalPaddingPx).toBe(6);
    expect(layout.lineHeight).toBe('1.30');
  });

  it('returns compact thermal defaults for 80mm', () => {
    const layout = getThermalReceiptLayout('80mm', 'normal');

    expect(layout.verticalPaddingPx).toBe(4);
    expect(layout.defaultHorizontalPaddingPx).toBe(8);
    expect(layout.lineHeight).toBe('1.30');
  });

  it('maps compact and relaxed thermal line spacing correctly', () => {
    expect(getThermalReceiptLayout('58mm', 'compact').lineHeight).toBe('1.15');
    expect(getThermalReceiptLayout('80mm', 'relaxed').lineHeight).toBe('1.45');
  });

  it('uses thermal margin fallbacks only when margin is invalid', () => {
    expect(getDefaultThermalMargin('58mm')).toBe(6);
    expect(getDefaultThermalMargin('80mm')).toBe(8);
    expect(resolveReceiptMargin('58mm', undefined)).toBe(6);
    expect(resolveReceiptMargin('80mm', undefined)).toBe(8);
    expect(resolveReceiptMargin('58mm', 0)).toBe(0);
  });
});
