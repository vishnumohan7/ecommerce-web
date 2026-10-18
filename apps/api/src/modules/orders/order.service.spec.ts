import { describe, expect, it } from 'vitest';
import { canCorrectCompletedPick } from './order.service';

describe('completed pick corrections', () => {
  it('allows an uncharged picked order to return to picking', () => {
    expect(canCorrectCompletedPick('PICKED', 0n)).toBe(true);
  });

  it('locks changes after dispatch starts', () => {
    expect(canCorrectCompletedPick('OUT_FOR_DELIVERY', 0n)).toBe(false);
  });

  it('locks changes after payment capture', () => {
    expect(canCorrectCompletedPick('PICKED', 4932n)).toBe(false);
  });
});
