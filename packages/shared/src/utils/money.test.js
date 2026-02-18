import { describe, it, expect } from 'vitest';
import { toCents, fromCents, formatMoney, formatMoneyCompact, calculateIva, calculateTotal } from './money.js';

describe('toCents', () => {
  it('converts integer amounts', () => {
    expect(toCents(120)).toBe(12000);
    expect(toCents(1)).toBe(100);
    expect(toCents(0)).toBe(0);
  });

  it('converts decimal amounts correctly (no floating-point drift)', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(99.99)).toBe(9999);
  });

  it('handles the classic 0.1 + 0.2 problem', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('handles negative amounts', () => {
    expect(toCents(-19.99)).toBe(-1999);
    expect(toCents(-1)).toBe(-100);
    expect(toCents(-0.5)).toBe(-50);
  });

  it('handles string numbers', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('100')).toBe(10000);
  });

  it('returns 0 for null/undefined/NaN', () => {
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents(NaN)).toBe(0);
    expect(toCents('abc')).toBe(0);
  });

  it('handles large amounts', () => {
    expect(toCents(999999.99)).toBe(99999999);
    expect(toCents(10000)).toBe(1000000);
  });

  it('truncates beyond 2 decimal places', () => {
    expect(toCents(1.999)).toBe(200); // toFixed(2) rounds to "2.00"
    expect(toCents(1.001)).toBe(100); // toFixed(2) rounds to "1.00"
    // Note: 1.005 is a well-known floating-point edge case. In JS,
    // (1.005).toFixed(2) === "1.00" because 1.005 is stored as 1.00499...
    expect(toCents(1.005)).toBe(100);
  });
});

describe('fromCents', () => {
  it('converts centavos to display amount', () => {
    expect(fromCents(12000)).toBe(120);
    expect(fromCents(1999)).toBe(19.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(1)).toBe(0.01);
    expect(fromCents(50)).toBe(0.5);
  });
});

describe('formatMoney', () => {
  it('formats as MXN currency', () => {
    const result = formatMoney(12000);
    // Should contain "$120.00" or "$120,00" depending on locale
    expect(result).toContain('120');
  });

  it('formats zero', () => {
    const result = formatMoney(0);
    expect(result).toContain('0');
  });
});

describe('formatMoneyCompact', () => {
  it('formats as simple decimal string', () => {
    expect(formatMoneyCompact(12000)).toBe('120.00');
    expect(formatMoneyCompact(1999)).toBe('19.99');
    expect(formatMoneyCompact(0)).toBe('0.00');
    expect(formatMoneyCompact(1)).toBe('0.01');
  });
});

describe('calculateIva', () => {
  it('calculates 16% IVA by default', () => {
    expect(calculateIva(10000)).toBe(1600);
    expect(calculateIva(1999)).toBe(320); // Math.round(1999 * 0.16)
  });

  it('calculates custom IVA percentage', () => {
    expect(calculateIva(10000, 8)).toBe(800);
    expect(calculateIva(10000, 0)).toBe(0);
  });

  it('rounds to nearest centavo', () => {
    expect(calculateIva(333, 16)).toBe(53); // Math.round(333 * 0.16) = Math.round(53.28) = 53
  });
});

describe('calculateTotal', () => {
  it('returns subtotal, iva, and total', () => {
    const result = calculateTotal(10000);
    expect(result).toEqual({
      subtotal: 10000,
      iva: 1600,
      total: 11600,
    });
  });

  it('works with custom IVA', () => {
    const result = calculateTotal(10000, 8);
    expect(result).toEqual({
      subtotal: 10000,
      iva: 800,
      total: 10800,
    });
  });

  it('handles zero subtotal', () => {
    const result = calculateTotal(0);
    expect(result).toEqual({
      subtotal: 0,
      iva: 0,
      total: 0,
    });
  });
});
