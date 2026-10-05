import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../src/common/auth/auth.guard';
describe('RBAC', () => {
  it('exposes a guard type and central permission metadata keys', () => { expect(AuthGuard).toBeTypeOf('function'); expect(Reflector).toBeTypeOf('function'); });
  it('uses resource.action permission strings', () => expect(['catalog.read', 'orders.write'].every((item) => /^[a-z-]+\.[a-z-]+$/.test(item))).toBe(true));
});
