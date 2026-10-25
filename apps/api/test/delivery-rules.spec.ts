import { describe, expect, it } from 'vitest';
import {
  combineDeliveryFees,
  deliveryDatesForOrder,
} from '../src/modules/delivery/delivery.service';

describe('delivery fee combination strategies', () => {
  it('combines grocery and alcohol fees according to each configured strategy', () => {
    expect(combineDeliveryFees(300n, 500n, 'MAX', 50n)).toBe(500n);
    expect(combineDeliveryFees(300n, 500n, 'SUM', 50n)).toBe(800n);
    expect(combineDeliveryFees(300n, 500n, 'GROCERY_ONLY', 50n)).toBe(300n);
    expect(combineDeliveryFees(300n, 500n, 'HIGHEST_PLUS_SURCHARGE', 50n)).toBe(550n);
    expect(combineDeliveryFees(0n, 500n, 'HIGHEST_PLUS_SURCHARGE', 50n)).toBe(500n);
  });
});

describe('London delivery calendar', () => {
  it('offers next-day delivery from Monday to Thursday', () => {
    expect(deliveryDatesForOrder(new Date('2026-10-22T10:00:00Z'))).toEqual([
      {
        date: '2026-10-23',
        fulfilmentDate: '2026-10-23',
        service: 'STANDARD',
        surchargeMinor: 0n,
      },
    ]);
  });

  it('offers paid Saturday or standard Tuesday delivery for a Friday order', () => {
    expect(deliveryDatesForOrder(new Date('2026-10-23T10:00:00Z'))).toEqual([
      {
        date: '2026-10-24',
        fulfilmentDate: '2026-10-24',
        service: 'SATURDAY',
        surchargeMinor: 150n,
      },
      {
        date: '2026-10-27',
        fulfilmentDate: '2026-10-26',
        service: 'STANDARD',
        surchargeMinor: 0n,
      },
    ]);
  });

  it('schedules weekend orders for Tuesday', () => {
    expect(deliveryDatesForOrder(new Date('2026-10-24T10:00:00Z'))[0]?.date).toBe('2026-10-27');
    expect(deliveryDatesForOrder(new Date('2026-10-25T10:00:00Z'))[0]?.date).toBe('2026-10-27');
  });
});
