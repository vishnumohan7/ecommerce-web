import { describe, expect, it } from 'vitest';
import { issueAgeGateToken, requiresAgeGate, safeReturnTo, verifyAgeGateToken } from './age-gate';

const secret = 'age-gate-test-secret-with-at-least-32-characters';

describe('server-enforced age gate', () => {
  it('binds the signed gate token to the session and expiry', async () => {
    const token = await issueAgeGateToken('session-a', secret, 1_000);
    await expect(verifyAgeGateToken(token, 'session-a', secret, 1_001)).resolves.toBe(true);
    await expect(verifyAgeGateToken(token, 'session-b', secret, 1_001)).resolves.toBe(false);
    await expect(verifyAgeGateToken(`${token}forged`, 'session-a', secret, 1_001)).resolves.toBe(
      false,
    );
    await expect(
      verifyAgeGateToken(token, 'session-a', secret, 1_000 + 30 * 24 * 60 * 60),
    ).resolves.toBe(false);
  });

  it('covers direct alcohol, nested category and alcohol-filter URLs', () => {
    expect(requiresAgeGate('/alcohol', new URLSearchParams())).toBe(true);
    expect(requiresAgeGate('/alcohol/wine', new URLSearchParams())).toBe(true);
    expect(requiresAgeGate('/category/alcohol/red', new URLSearchParams())).toBe(true);
    expect(requiresAgeGate('/search', new URLSearchParams('alcohol=true'))).toBe(true);
    expect(requiresAgeGate('/search', new URLSearchParams('category=alcohol'))).toBe(true);
    expect(requiresAgeGate('/search', new URLSearchParams('q=apple'))).toBe(false);
  });

  it('does not allow an external return URL', () => {
    expect(safeReturnTo('//attacker.example')).toBe('/alcohol');
    expect(safeReturnTo('https://attacker.example')).toBe('/alcohol');
    expect(safeReturnTo('/alcohol/wine?q=red')).toBe('/alcohol/wine?q=red');
  });
});
