import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertHfssEligible } from '../src/modules/promotions/promotions.service';

describe('HFSS promotion controls', () => {
  it('blocks multibuy volume promotions for in-scope products', () => {
    expect(() => assertHfssEligible('MULTIBUY', [{ sku: 'HFSS-1', hfssStatus: 'IN_SCOPE' }])).toThrow(UnprocessableEntityException);
  });

  it('allows non-volume promotions and out-of-scope multibuys', () => {
    expect(() => assertHfssEligible('PERCENTAGE', [{ sku: 'HFSS-1', hfssStatus: 'IN_SCOPE' }])).not.toThrow();
    expect(() => assertHfssEligible('MULTIBUY', [{ sku: 'OK-1', hfssStatus: 'NOT_IN_SCOPE' }])).not.toThrow();
  });
});
