import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PricingService } from '../src/modules/pricing/pricing.service';

const coupon = {
  id: '20000000-0000-4000-8000-000000000001',
  code: 'WELCOME10',
  couponClass: 'SITE_WIDE',
  appliesTo: 'BOTH',
  active: true,
  uses: 0,
};

function serviceWith(transactionClient: Record<string, unknown>) {
  const database = {
    transaction: vi.fn((work: (tx: unknown, tenantId: string) => unknown) =>
      Promise.resolve(work(transactionClient, '20000000-0000-4000-8000-000000000002')),
    ),
  };
  return new PricingService(database as never, {} as never, {} as never);
}

describe('admin coupon deletion', () => {
  it('deletes an unused coupon and records an audit event', async () => {
    const remove = vi.fn().mockResolvedValue(coupon);
    const audit = vi.fn().mockResolvedValue({});
    const service = serviceWith({
      coupon: { findFirst: vi.fn().mockResolvedValue(coupon), delete: remove },
      couponRedemption: { count: vi.fn().mockResolvedValue(0) },
      auditLog: { create: audit },
    });

    await expect(service.deleteCoupon(coupon.id)).resolves.toEqual({
      id: coupon.id,
      deleted: true,
    });
    expect(remove).toHaveBeenCalledWith({ where: { id: coupon.id } });
    const auditCall = audit.mock.calls[0] as unknown as [{ data: { action: string } }];
    expect(auditCall[0].data.action).toBe('COUPON_DELETE');
  });

  it('preserves a coupon that has redemption history', async () => {
    const remove = vi.fn();
    const service = serviceWith({
      coupon: { findFirst: vi.fn().mockResolvedValue({ ...coupon, uses: 1 }), delete: remove },
      couponRedemption: { count: vi.fn().mockResolvedValue(1) },
      auditLog: { create: vi.fn() },
    });

    await expect(service.deleteCoupon(coupon.id)).rejects.toBeInstanceOf(ConflictException);
    expect(remove).not.toHaveBeenCalled();
  });
});
