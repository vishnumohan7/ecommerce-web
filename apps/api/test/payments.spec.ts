import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import {
  StubPaymentProvider,
  verifyStripeSignature,
} from '../src/modules/payments/payment.providers';
import { PaymentService } from '../src/modules/payments/payment.service';

const tenantId = '10000000-0000-4000-8000-000000000001';
const checkoutSessionId = '10000000-0000-4000-8000-000000000002';

describe('payments', () => {
  it('records a pending cash-on-delivery payment as collected', async () => {
    const payment = {
      id: '10000000-0000-4000-8000-000000000004',
      provider: 'cash_on_delivery',
      status: 'PENDING',
      capturedAmountMinor: 0n,
    };
    const paymentUpdates: Array<Record<string, unknown>> = [];
    const orderUpdates: Array<Record<string, unknown>> = [];
    const tx = {
      $queryRaw: () => Promise.resolve([{ id: payment.id }]),
      payment: {
        findFirst: () => Promise.resolve(payment),
        update: ({ data }: { data: Record<string, unknown> }) => {
          paymentUpdates.push(data);
          return Promise.resolve({ ...payment, ...data });
        },
      },
      order: {
        findFirst: () => Promise.resolve({ id: checkoutSessionId, totalMinor: 4908n }),
        update: ({ data }: { data: Record<string, unknown> }) => {
          orderUpdates.push(data);
          return Promise.resolve(data);
        },
      },
      auditLog: { create: () => Promise.resolve({}) },
      outboxMessage: { create: () => Promise.resolve({}) },
    };
    const service = new PaymentService(
      { transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx) } as never,
      { get: () => Promise.resolve({}) } as never,
      { values: {} } as never,
      new StubPaymentProvider(),
    );

    await TenantContext.run(
      {
        tenantId,
        userId: '10000000-0000-4000-8000-000000000003',
        requestId: 'cod-collected',
      },
      () => service.markCashOnDeliveryCollected(checkoutSessionId),
    );

    expect(paymentUpdates).toEqual([{ status: 'CAPTURED', capturedAmountMinor: 4908n }]);
    expect(orderUpdates).toEqual([{ paymentStatus: 'CAPTURED' }]);
  });

  it('creates exactly one provider intent for five concurrent calls', async () => {
    const provider = new StubPaymentProvider();
    let saved: Record<string, unknown> | null = null;
    let queue = Promise.resolve();
    const session = {
      id: checkoutSessionId,
      tenantId,
      status: 'ACTIVE',
      totalMinor: 1299n,
      currency: 'GBP',
      snapshotHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      snapshot: {
        summary: { groups: [{ category: 'GROCERY', lines: [{}] }], requiresManualCapture: false },
      },
    };
    const tx = {
      $queryRaw: () =>
        Promise.resolve(saved ? [{ id: checkoutSessionId }] : [{ orderNumber: 100001n }]),
      checkoutPaymentIntent: {
        findFirst: () => Promise.resolve(saved),
        create: ({ data }: { data: Record<string, unknown> }) => {
          saved = { id: 'intent-row', ...data };
          return Promise.resolve(saved);
        },
      },
      checkoutSession: { findFirst: () => Promise.resolve(session) },
      idempotencyKey: { create: () => Promise.resolve({}) },
    };
    let queryCount = 0;
    tx.$queryRaw = () => {
      queryCount += 1;
      return Promise.resolve(
        queryCount % 2 === 1 ? [{ id: checkoutSessionId }] : [{ orderNumber: 100001n }],
      );
    };
    const database = {
      transaction(work: (client: typeof tx) => Promise<unknown>) {
        const result = queue.then(() => work(tx));
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    };
    const service = new PaymentService(
      database as never,
      { get: () => Promise.resolve({}) } as never,
      { values: {} } as never,
      provider,
    );
    const results = await TenantContext.run({ tenantId, requestId: 'payment-race' }, () =>
      Promise.all(
        Array.from({ length: 5 }, () =>
          service.createIntent(
            { userId: '10000000-0000-4000-8000-000000000003' },
            checkoutSessionId,
          ),
        ),
      ),
    );
    expect(provider.calls).toBe(1);
    expect(new Set(results.map((result) => result.providerPaymentIntentId))).toHaveLength(1);
  });

  it('accepts only a current signature over the exact raw body', () => {
    const payload = Buffer.from('{"id":"evt_1"}');
    const secret = 'whsec_test_secret';
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', secret)
      .update(`${String(timestamp)}.${payload.toString('utf8')}`)
      .digest('hex');
    expect(verifyStripeSignature(payload, `t=${String(timestamp)},v1=${digest}`, secret)).toBe(
      true,
    );
    expect(
      verifyStripeSignature(Buffer.from('{}'), `t=${String(timestamp)},v1=${digest}`, secret),
    ).toBe(false);
  });
});
