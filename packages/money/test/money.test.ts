import { describe, expect, it } from 'vitest';
import { Money, currencySchema, moneyWireSchema } from '../src/index.js';
describe('Money', () => {
  it('creates zero and immutable values', () => { expect(Money.zero().minor).toBe(0n); expect(Object.isFrozen(Money.zero())).toBe(true); });
  it.each([['12', 1200n], ['12.3', 1230n], ['12.34', 1234n], ['-1.20', -120n]])('parses %s', (text, minor) => expect(Money.parse(text).minor).toBe(minor));
  it.each(['', '1.234', 'x', '1.'])('rejects invalid parse %s', (text) => expect(() => Money.parse(text)).toThrow());
  it('validates currencies and wire values', () => { expect(currencySchema.parse('GBP')).toBe('GBP'); expect(() => currencySchema.parse('gbp')).toThrow(); expect(moneyWireSchema.parse({ minor: '-20', currency: 'GBP' }).minor).toBe('-20'); expect(() => moneyWireSchema.parse({ minor: '1.2', currency: 'GBP' })).toThrow(); });
  it('serialises wire values', () => expect(Money.fromWire({ minor: '125', currency: 'GBP' }).toWire()).toEqual({ minor: '125', currency: 'GBP' }));
  it('performs arithmetic', () => { const a = Money.of(500n); expect(a.add(Money.of(200n)).minor).toBe(700n); expect(a.subtract(Money.of(200n)).minor).toBe(300n); expect(a.multiply(3n).minor).toBe(1500n); });
  it('rejects mixed-currency arithmetic', () => { expect(() => Money.of(1n, 'GBP').add(Money.of(1n, 'USD'))).toThrow('Currency mismatch'); expect(() => Money.of(1n, 'GBP').subtract(Money.of(1n, 'USD'))).toThrow('Currency mismatch'); });
  it('compares amount and currency', () => { expect(Money.of(1n).equals(Money.of(1n))).toBe(true); expect(Money.of(1n).equals(Money.of(2n))).toBe(false); expect(Money.of(1n).equals(Money.of(1n, 'USD'))).toBe(false); });
  it('allocates remainders in order', () => expect(Money.of(100n).allocate([1n, 1n, 1n]).map((m) => m.minor)).toEqual([34n, 33n, 33n]));
  it('allocates negative remainders', () => expect(Money.of(-100n).allocate([1n, 1n, 1n]).map((m) => m.minor)).toEqual([-34n, -33n, -33n]));
  it('allocates exact and zero ratios', () => expect(Money.of(100n).allocate([1n, 0n]).map((m) => m.minor)).toEqual([100n, 0n]));
  it('rejects invalid allocations', () => { expect(() => Money.of(1n).allocate([])).toThrow(); expect(() => Money.of(1n).allocate([1n, -1n])).toThrow(); expect(() => Money.of(1n).allocate([0n, 0n])).toThrow(); });
  it('formats using Intl', () => expect(Money.of(1234n).format('en-GB')).toContain('12.34'));
});
