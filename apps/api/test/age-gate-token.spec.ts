import { describe, expect, it } from 'vitest';
import { AgeGateTokenService } from '../src/common/security/age-gate-token.service';

const service = new AgeGateTokenService({
  values: {
    AGE_GATE_SECRET: 'age-gate-test-secret-that-is-long-enough',
    JWT_ACCESS_SECRET: 'unused-secret-that-is-also-long-enough',
  },
} as never);

describe('signed age-gate token', () => {
  it('accepts a valid token only for its bound session', () => {
    const token = service.issue('session-a');
    expect(service.verify(token, 'session-a')).toBe(true);
    expect(service.verify(token, 'session-b')).toBe(false);
  });

  it('rejects forged and expired tokens', () => {
    const token = service.issue('session-a');
    expect(service.verify(`${token.slice(0, -1)}x`, 'session-a')).toBe(false);
    expect(service.verify(service.issue('session-a', -1), 'session-a')).toBe(false);
  });
});
