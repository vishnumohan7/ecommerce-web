import { argon2id, hash, verify } from 'argon2';
import { describe, expect, it } from 'vitest';
describe('authentication cryptography', () => {
  it('uses the required Argon2id floor', async () => { const encoded = await hash('a sufficiently long password', { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }); expect(encoded).toContain('m=19456,t=2,p=1'); expect(await verify(encoded, 'a sufficiently long password')).toBe(true); });
});
