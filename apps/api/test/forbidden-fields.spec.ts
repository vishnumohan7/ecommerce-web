import { describe, expect, it } from 'vitest';
import { ForbiddenFieldsPipe } from '../src/common/pipes/forbidden-fields.pipe';
describe('forbidden fields', () => {
  const pipe = new ForbiddenFieldsPipe();
  it.each(['price', 'subtotal', 'discount', 'tax', 'total', 'deliveryFee', 'isAlcohol', 'ageVerified', 'stock'])('rejects client-supplied %s', (field) => expect(() => pipe.transform({ productId: 'p1', [field]: 1 })).toThrow('server-controlled'));
  it('rejects nested and array fields', () => expect(() => pipe.transform({ lines: [{ productId: 'p1', stock: 2 }] })).toThrow());
  it('allows identifiers and quantities', () => expect(pipe.transform({ productId: 'p1', quantity: 2 })).toEqual({ productId: 'p1', quantity: 2 }));
});
