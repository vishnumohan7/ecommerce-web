import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { serializeBigInts } from '../src/common/serialization/bigint-serialization.interceptor';

describe('API bigint serialization', () => {
  it('converts nested bigint money values to lossless decimal strings', () => {
    expect(
      serializeBigInts({ priceMinor: 299n, lines: [{ totalMinor: 999999999999999999n }] }),
    ).toEqual({
      priceMinor: '299',
      lines: [{ totalMinor: '999999999999999999' }],
    });
  });

  it('preserves dates and scalar values', () => {
    const date = new Date('2026-10-05T00:00:00.000Z');
    expect(serializeBigInts({ date, active: true })).toEqual({ date, active: true });
  });

  it('uses JSON representations for value objects such as Prisma decimals', () => {
    expect(serializeBigInts({ abv: new Prisma.Decimal('40.00') })).toEqual({ abv: '40' });
  });
});
