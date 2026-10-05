import { z } from 'zod';

export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const moneyWireSchema = z.object({ minor: z.string().regex(/^-?\d+$/), currency: currencySchema });
export type MoneyWire = z.infer<typeof moneyWireSchema>;

export class Money {
  private constructor(readonly minor: bigint, readonly currency: string) { Object.freeze(this); }
  static of(minor: bigint, currency = 'GBP'): Money { return new Money(minor, currencySchema.parse(currency)); }
  static zero(currency = 'GBP'): Money { return Money.of(0n, currency); }
  static parse(value: string, currency = 'GBP'): Money {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
    if (!match) throw new Error('Invalid money value');
    const [, sign = '', whole = '0', fraction = ''] = match;
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    return Money.of(sign === '-' ? -minor : minor, currency);
  }
  static fromWire(value: MoneyWire): Money { const parsed = moneyWireSchema.parse(value); return Money.of(BigInt(parsed.minor), parsed.currency); }
  add(other: Money): Money { this.assertCurrency(other); return Money.of(this.minor + other.minor, this.currency); }
  subtract(other: Money): Money { this.assertCurrency(other); return Money.of(this.minor - other.minor, this.currency); }
  multiply(factor: bigint): Money { return Money.of(this.minor * factor, this.currency); }
  allocate(ratios: readonly bigint[]): Money[] {
    if (ratios.length === 0 || ratios.some((ratio) => ratio < 0n)) throw new Error('Ratios must be a non-empty list of non-negative integers');
    const total = ratios.reduce((sum, ratio) => sum + ratio, 0n);
    if (total === 0n) throw new Error('Ratio total must be positive');
    const shares = ratios.map((ratio) => (this.minor * ratio) / total);
    let remainder = this.minor - shares.reduce((sum, share) => sum + share, 0n);
    const step = remainder < 0n ? -1n : 1n;
    for (let index = 0; remainder !== 0n; index = (index + 1) % shares.length) { shares[index] = (shares[index] as bigint) + step; remainder -= step; }
    return shares.map((minor) => Money.of(minor, this.currency));
  }
  equals(other: Money): boolean { return this.currency === other.currency && this.minor === other.minor; }
  format(locale = 'en-GB'): string { return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(Number(this.minor) / 100); }
  toWire(): MoneyWire { return { minor: this.minor.toString(), currency: this.currency }; }
  private assertCurrency(other: Money): void { if (this.currency !== other.currency) throw new Error(`Currency mismatch: ${this.currency} and ${other.currency}`); }
}
