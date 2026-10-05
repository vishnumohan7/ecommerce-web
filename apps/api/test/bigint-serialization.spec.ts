import { describe, expect, it } from 'vitest';
import { serializeBigInts } from '../src/common/serialization/bigint-serialization.interceptor';

describe('API bigint serialization', () => {
  it('converts nested bigint money values to lossless decimal strings', () => {
    expect(serializeBigInts({ priceMinor: 299n, lines: [{ totalMinor: 999999999999999999n }] })).toEqual({
      priceMinor: '299',
      lines: [{ totalMinor: '999999999999999999' }],
    });
  });

  it('preserves dates and scalar values', () => {
    const date = new Date('2026-10-05T00:00:00.000Z');
    expect(serializeBigInts({ date, active: true })).toEqual({ date, active: true });
  });
});
