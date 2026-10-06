import { describe, expect, it } from 'vitest';
import { combineDeliveryFees } from '../src/modules/delivery/delivery.service';

describe('delivery fee combination strategies', () => {
  it('combines grocery and alcohol fees according to each configured strategy', () => {
    expect(combineDeliveryFees(300n, 500n, 'MAX', 50n)).toBe(500n);
    expect(combineDeliveryFees(300n, 500n, 'SUM', 50n)).toBe(800n);
    expect(combineDeliveryFees(300n, 500n, 'GROCERY_ONLY', 50n)).toBe(300n);
    expect(combineDeliveryFees(300n, 500n, 'HIGHEST_PLUS_SURCHARGE', 50n)).toBe(550n);
    expect(combineDeliveryFees(0n, 500n, 'HIGHEST_PLUS_SURCHARGE', 50n)).toBe(500n);
  });
});
