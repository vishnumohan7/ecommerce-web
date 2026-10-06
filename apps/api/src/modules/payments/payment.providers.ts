import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PaymentIntentRequest, PaymentIntentResult, PaymentProvider } from '@app/ports';
import { AppConfigService } from '../../common/config/app-config.service';

@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  calls = 0;
  captureCalls = 0;
  cancelCalls = 0;
  refundCalls = 0;
  health() {
    return Promise.resolve({ ok: true });
  }
  createIntent(): Promise<PaymentIntentResult> {
    this.calls += 1;
    const id = `pi_stub_${randomUUID().replaceAll('-', '')}`;
    return Promise.resolve({
      id,
      clientSecret: `${id}_secret_test`,
      status: 'requires_payment_method',
    });
  }
  captureIntent(
    _providerPaymentIntentId: string,
    amountMinor: bigint,
  ): Promise<{ status: string; capturedAmountMinor: bigint }> {
    this.captureCalls += 1;
    return Promise.resolve({ status: 'succeeded', capturedAmountMinor: amountMinor });
  }
  cancelIntent(): Promise<void> {
    this.cancelCalls += 1;
    return Promise.resolve();
  }
  refundIntent(
    _providerPaymentIntentId: string,
    amountMinor: bigint,
    idempotencyKey: string,
  ): Promise<{ id: string; status: string; amountMinor: bigint }> {
    this.refundCalls += 1;
    return Promise.resolve({
      id: `re_stub_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 24)}`,
      status: 'succeeded',
      amountMinor,
    });
  }
}

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  constructor(private readonly config: AppConfigService) {}
  health() {
    return Promise.resolve({ ok: Boolean(this.config.values.STRIPE_SECRET_KEY) });
  }
  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const secret = this.config.values.STRIPE_SECRET_KEY;
    if (!secret) throw new Error('Stripe is not configured');
    const form = new URLSearchParams({
      amount: request.amountMinor.toString(),
      currency: request.currency.toLowerCase(),
      capture_method: request.manualCapture ? 'manual' : 'automatic',
      'automatic_payment_methods[enabled]': 'true',
    });
    for (const [key, value] of Object.entries(request.metadata))
      form.set(`metadata[${key}]`, value);
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Idempotency-Key': request.idempotencyKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const payload = (await response.json()) as {
      id?: string;
      client_secret?: string;
      status?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.id || !payload.client_secret)
      throw new Error(payload.error?.message ?? 'Stripe PaymentIntent creation failed');
    return {
      id: payload.id,
      clientSecret: payload.client_secret,
      status: payload.status ?? 'unknown',
    };
  }

  async captureIntent(
    providerPaymentIntentId: string,
    amountMinor: bigint,
    idempotencyKey: string,
  ): Promise<{ status: string; capturedAmountMinor: bigint }> {
    const payload = await this.post(
      `/v1/payment_intents/${encodeURIComponent(providerPaymentIntentId)}/capture`,
      new URLSearchParams({ amount_to_capture: amountMinor.toString() }),
      idempotencyKey,
    );
    return {
      status: payload.status ?? 'unknown',
      capturedAmountMinor: BigInt(payload.amount_received ?? amountMinor),
    };
  }

  async cancelIntent(providerPaymentIntentId: string, idempotencyKey: string): Promise<void> {
    await this.post(
      `/v1/payment_intents/${encodeURIComponent(providerPaymentIntentId)}/cancel`,
      new URLSearchParams(),
      idempotencyKey,
    );
  }

  async refundIntent(providerPaymentIntentId: string, amountMinor: bigint, idempotencyKey: string) {
    const payload = await this.post(
      '/v1/refunds',
      new URLSearchParams({
        payment_intent: providerPaymentIntentId,
        amount: amountMinor.toString(),
      }),
      idempotencyKey,
    );
    if (!payload.id) throw new Error('Stripe refund response did not include an id');
    return {
      id: payload.id,
      status: payload.status ?? 'pending',
      amountMinor: BigInt(payload.amount ?? amountMinor),
    };
  }

  private async post(path: string, form: URLSearchParams, idempotencyKey: string) {
    const secret = this.config.values.STRIPE_SECRET_KEY;
    if (!secret) throw new Error('Stripe is not configured');
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    const payload = (await response.json()) as {
      id?: string;
      status?: string;
      amount_received?: string;
      amount?: string;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message ?? 'Stripe request failed');
    return payload;
  }
}

export function verifyStripeSignature(
  payload: Buffer,
  header: string,
  secret: string,
  now = Date.now(),
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((part) => part.split('=', 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature || Math.abs(now / 1000 - timestamp) > 300)
    return false;
  const expected = createHmac('sha256', secret)
    .update(`${String(timestamp)}.${payload.toString('utf8')}`)
    .digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
