import { describe, expect, it } from 'vitest';
import { GuestCartTokenService } from '../src/modules/cart/guest-cart-token.service';

const service = new GuestCartTokenService({
  values: {
    GUEST_CART_SECRET: 'guest-cart-test-secret-that-is-long-enough',
    JWT_ACCESS_SECRET: 'unused-secret-that-is-also-long-enough',
  },
} as never);
describe('guest cart token', () => {
  it('is signed, expires in 30 days, and cannot be forged', () => {
    const issued = service.issue();
    const verified = service.verify(issued.token);
    expect(verified?.sessionId).toBe(issued.sessionId);
    expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(service.verify(`${issued.token.slice(0, -1)}x`)).toBeUndefined();
  });
});
