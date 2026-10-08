import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { PaymentProvider } from '@app/ports';
import { TOKENS } from '@app/ports';
import type { Prisma } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import type { PricingIdentity } from '../pricing/pricing.service';
import { CheckoutService } from '../checkout/checkout.service';
import { NotificationService } from '../notifications/notification.service';
import { verifyStripeSignature } from './payment.providers';
import { allocateCommerceNumber } from './commerce-number';

type Snapshot = {
  summary: {
    groups: Array<{
      category: 'GROCERY' | 'ALCOHOL';
      lines: Array<Record<string, string | number | boolean | null>>;
    }>;
    subtotalMinor: string;
    discountMinor: string;
    vatMinor: string;
    totalMinor: string;
    delivery: { deliveryFeeMinor: string };
    requiresAgeVerification: boolean;
    requiresManualCapture: boolean;
  };
  request: {
    deliveryAddress: Prisma.JsonObject;
    deliverySlotId: string;
    guest?: Prisma.JsonObject;
  };
};

@Injectable()
export class PaymentService implements OnModuleInit, OnModuleDestroy {
  private cancellationTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly checkout: CheckoutService,
    private readonly config: AppConfigService,
    @Inject(TOKENS.Payment) private readonly provider: PaymentProvider,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  onModuleInit(): void {
    setImmediate(() => {
      void TenantContext.run(
        { tenantId: this.config.defaultTenantId, requestId: 'payment-webhook-recovery' },
        () => this.recoverQueuedWebhooks(),
      );
    });
    this.cancellationTimer = setInterval(
      () => {
        void TenantContext.run(
          { tenantId: this.config.defaultTenantId, requestId: 'payment-authorisation-expiry' },
          () => this.cancelExpiringAuthorisations(),
        );
      },
      60 * 60 * 1000,
    );
    this.cancellationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cancellationTimer) clearInterval(this.cancellationTimer);
  }

  async createIntent(identity: PricingIdentity, checkoutSessionId: string) {
    await this.checkout.get(identity, checkoutSessionId);
    const tenantId = TenantContext.requireTenantId();
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CheckoutSession" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${checkoutSessionId}::uuid FOR UPDATE`;
      const existing = await tx.checkoutPaymentIntent.findFirst({
        where: { tenantId, checkoutSessionId },
      });
      if (existing) return this.publicIntent(existing);
      const session = await tx.checkoutSession.findFirst({
        where: { tenantId, id: checkoutSessionId, status: 'ACTIVE' },
      });
      if (!session) throw new NotFoundException('Active checkout session not found');
      const snapshot = session.snapshot as unknown as Snapshot;
      const hasGrocery = snapshot.summary.groups.some(
        (group) => group.category === 'GROCERY' && group.lines.length > 0,
      );
      const hasAlcohol = snapshot.summary.groups.some(
        (group) => group.category === 'ALCOHOL' && group.lines.length > 0,
      );
      const basketType = hasGrocery && hasAlcohol ? 'MIXED' : hasAlcohol ? 'ALCOHOL' : 'GROCERY';
      const numberRows = await tx.$queryRaw<
        Array<{ orderNumber: bigint }>
      >`SELECT nextval('commerce_order_number_seq') AS "orderNumber"`;
      const orderNumber = numberRows[0]?.orderNumber;
      if (orderNumber === undefined) throw new Error('Unable to reserve an order number');
      const manualCapture = snapshot.summary.requiresManualCapture;
      const bufferBps = BigInt(this.config.values.PAYMENT_WEIGHT_VARIANCE_BUFFER_BPS ?? 1000);
      const amountMinor = manualCapture
        ? session.totalMinor + (session.totalMinor * bufferBps + 9_999n) / 10_000n
        : session.totalMinor;
      const result = await this.provider.createIntent({
        idempotencyKey: checkoutSessionId,
        amountMinor,
        currency: session.currency,
        manualCapture,
        metadata: {
          tenantId,
          checkoutSessionId,
          basketType,
          orderNumberReserved: orderNumber.toString(),
        },
      });
      const intent = await tx.checkoutPaymentIntent.create({
        data: {
          tenantId,
          checkoutSessionId,
          provider: 'stripe',
          providerPaymentIntentId: result.id,
          clientSecret: result.clientSecret,
          status: result.status,
          amountMinor,
          checkoutTotalMinor: session.totalMinor,
          currency: session.currency,
          manualCapture,
          reservedOrderNumber: orderNumber,
        },
      });
      await tx.idempotencyKey.create({
        data: {
          tenantId,
          scope: 'checkout.payment-intent',
          key: checkoutSessionId,
          requestHash: session.snapshotHash,
          response: { id: intent.id, providerPaymentIntentId: intent.providerPaymentIntentId },
          statusCode: 201,
          expiresAt: session.expiresAt,
        },
      });
      return this.publicIntent(intent);
    });
  }

  async get(identity: PricingIdentity, id: string) {
    const owner =
      'userId' in identity ? { userId: identity.userId } : { guestToken: identity.guestSessionId };
    const intent = await this.db.client.checkoutPaymentIntent.findFirst({ where: { id } });
    if (!intent) throw new NotFoundException('Payment intent not found');
    const session = await this.db.client.checkoutSession.findFirst({
      where: { id: intent.checkoutSessionId, ...owner },
    });
    if (!session) throw new NotFoundException('Payment intent not found');
    return this.publicIntent(intent);
  }

  async webhook(payload: Buffer, signature: string) {
    const secret = this.config.values.STRIPE_WEBHOOK_SECRET;
    if (!secret || !verifyStripeSignature(payload, signature, secret))
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Stripe signature is invalid',
      });
    const event = JSON.parse(payload.toString('utf8')) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    const metadata = event.data.object.metadata as Record<string, unknown> | undefined;
    const tenantId =
      typeof metadata?.tenantId === 'string' ? metadata.tenantId : TenantContext.requireTenantId();
    const stored = await this.db.transaction(async (tx) => {
      const duplicate = await tx.webhookEvent.findFirst({
        where: { provider: 'stripe', providerEventId: event.id },
      });
      if (duplicate) return { record: duplicate, duplicate: true };
      const record = await tx.webhookEvent.create({
        data: {
          tenantId,
          provider: 'stripe',
          providerEventId: event.id,
          signatureValid: true,
          payload: event as unknown as Prisma.InputJsonValue,
          status: 'QUEUED',
        },
      });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'webhook.stripe.process', payload: { webhookEventId: record.id } },
      });
      return { record, duplicate: false };
    });
    if (!stored.duplicate)
      setImmediate(() => {
        void TenantContext.run({ tenantId, requestId: `stripe-webhook-${event.id}` }, () =>
          this.processSafely(stored.record.id, event, tenantId),
        );
      });
    return { received: true, duplicate: stored.duplicate };
  }

  private async processSafely(
    webhookEventId: string,
    event: { id: string; type: string; data: { object: Record<string, unknown> } },
    tenantId: string,
  ): Promise<void> {
    try {
      await this.db.client.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSING', attempts: { increment: 1 } },
      });
      await this.process(webhookEventId, event);
      await this.notifications?.process(100);
    } catch (error) {
      await this.db.transaction(async (tx) => {
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'FAILED',
            lastError: error instanceof Error ? error.message : 'Webhook processing failed',
          },
        });
        await tx.outboxMessage.create({
          data: {
            tenantId,
            topic: 'alert.payment-webhook-failed',
            payload: { webhookEventId, providerEventId: event.id },
          },
        });
      });
    }
  }

  private async recoverQueuedWebhooks(): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    const queued = await this.db.client.webhookEvent.findMany({
      where: { provider: 'stripe', status: 'QUEUED', attempts: { lt: 8 } },
      orderBy: { receivedAt: 'asc' },
      take: 100,
    });
    for (const record of queued) {
      const event = record.payload as unknown as {
        id: string;
        type: string;
        data: { object: Record<string, unknown> };
      };
      await this.processSafely(record.id, event, tenantId);
    }
  }

  private async process(
    webhookEventId: string,
    event: { type: string; data: { object: Record<string, unknown> } },
  ) {
    const object = event.data.object;
    const providerId = typeof object.id === 'string' ? object.id : '';
    if (event.type === 'payment_intent.succeeded') {
      await this.finalise(webhookEventId, providerId, object, false);
      return;
    }
    if (event.type === 'payment_intent.amount_capturable_updated') {
      await this.finalise(webhookEventId, providerId, object, true);
      return;
    }
    if (event.type === 'payment_intent.payment_failed') {
      await this.paymentFailed(webhookEventId, providerId);
      return;
    }
    if (event.type === 'charge.dispute.created') {
      await this.disputeCreated(webhookEventId, object);
      return;
    }
    await this.markProcessed(
      webhookEventId,
      event.type === 'charge.refunded' ? 'payment.refund-reconcile' : undefined,
    );
  }

  private async finalise(
    webhookEventId: string,
    providerId: string,
    object: Record<string, unknown>,
    authorisedOnly: boolean,
  ) {
    const tenantId = TenantContext.requireTenantId();
    return this.db.transaction(async (tx) => {
      const intent = await tx.checkoutPaymentIntent.findFirst({
        where: { tenantId, providerPaymentIntentId: providerId },
      });
      if (!intent) throw new NotFoundException('Payment intent metadata is unknown');
      const metadata = object.metadata as Record<string, unknown> | undefined;
      if (
        metadata?.tenantId !== tenantId ||
        metadata.checkoutSessionId !== intent.checkoutSessionId ||
        metadata.orderNumberReserved !== intent.reservedOrderNumber.toString()
      )
        throw new ConflictException({
          code: 'PAYMENT_METADATA_MISMATCH',
          message: 'Webhook metadata does not match checkout',
        });
      const amountValue = object.amount_received ?? object.amount_capturable ?? object.amount;
      const amount = BigInt(
        typeof amountValue === 'string' || typeof amountValue === 'number' ? amountValue : 0,
      );
      const currency = (typeof object.currency === 'string' ? object.currency : '').toUpperCase();
      if (amount !== intent.amountMinor || currency !== intent.currency)
        throw new ConflictException({
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message: 'Webhook amount or currency does not match checkout',
        });
      const existing = await tx.order.findFirst({
        where: { tenantId, idempotencyKey: intent.checkoutSessionId },
      });
      if (existing) {
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
        return existing;
      }
      const session = await tx.checkoutSession.findFirstOrThrow({
        where: { tenantId, id: intent.checkoutSessionId },
      });
      const snapshot = session.snapshot as unknown as Snapshot;
      const lines: Array<
        Record<string, string | number | boolean | null> & { orderCategory: 'GROCERY' | 'ALCOHOL' }
      > = snapshot.summary.groups.flatMap((group) =>
        group.lines.map((line) => ({ ...line, orderCategory: group.category })),
      );
      const lineSubtotal = lines.reduce(
        (sum, line) =>
          sum + BigInt(String(line['unitPriceMinor'])) * BigInt(Number(line['quantity'])),
        0n,
      );
      const lineNet = lines.reduce((sum, line) => sum + BigInt(String(line['totalMinor'])), 0n);
      const quotedSubtotal = BigInt(snapshot.summary.subtotalMinor);
      const quotedDiscount = BigInt(snapshot.summary.discountMinor);
      const quotedDelivery = BigInt(snapshot.summary.delivery.deliveryFeeMinor);
      if (
        lineSubtotal !== quotedSubtotal ||
        lineNet !== quotedSubtotal - quotedDiscount ||
        lineNet + quotedDelivery !== intent.checkoutTotalMinor
      )
        throw new ConflictException({
          code: 'ORDER_TOTAL_MISMATCH',
          message: 'Checkout line quantities and order totals do not reconcile',
        });
      const hasGrocery = lines.some((line) => line.orderCategory === 'GROCERY');
      const hasAlcohol = lines.some((line) => line.orderCategory === 'ALCOHOL');
      const numberYear = new Date().getUTCFullYear();
      const orderNumber = await allocateCommerceNumber(tx, tenantId, numberYear, 'ORDER');
      const order = await tx.order.create({
        data: {
          tenantId,
          userId: session.userId ?? session.guestUserId,
          orderNumber,
          orderNumberYear: numberYear,
          idempotencyKey: intent.checkoutSessionId,
          basketType: hasGrocery && hasAlcohol ? 'MIXED' : hasAlcohol ? 'ALCOHOL' : 'GROCERY',
          currency: intent.currency,
          subtotalMinor: BigInt(snapshot.summary.subtotalMinor),
          discountMinor: BigInt(snapshot.summary.discountMinor),
          taxMinor: BigInt(snapshot.summary.vatMinor),
          deliveryFeeMinor: BigInt(snapshot.summary.delivery.deliveryFeeMinor),
          totalMinor: intent.checkoutTotalMinor,
          paymentStatus: authorisedOnly ? 'AUTHORISED' : 'CAPTURED',
          ageVerificationStatus: snapshot.summary.requiresAgeVerification
            ? 'PASSED'
            : 'NOT_REQUIRED',
          deliveryAddress: snapshot.request.deliveryAddress,
          deliverySlotId: snapshot.request.deliverySlotId,
          customerSnapshot: snapshot.request.guest ?? {
            userId: session.userId ?? session.guestUserId,
          },
        },
      });
      await tx.orderFulfilmentGroup.createMany({
        data: [
          ...(hasGrocery ? [{ tenantId, orderId: order.id, category: 'GROCERY' as const }] : []),
          ...(hasAlcohol ? [{ tenantId, orderId: order.id, category: 'ALCOHOL' as const }] : []),
        ],
      });
      for (const line of lines) {
        const productId = String(line['productId']);
        const product = await tx.product.findFirstOrThrow({ where: { tenantId, id: productId } });
        await tx.orderItem.create({
          data: {
            tenantId,
            orderId: order.id,
            productId,
            productName: String(line['name']),
            sku: String(line['sku']),
            quantity: Number(line['quantity']),
            unitPriceMinor: BigInt(String(line['unitPriceMinor'])),
            currency: intent.currency,
            vatRateBps: Number(line['taxRateBps']),
            vatAmountMinor: BigInt(String(line['vatMinor'])),
            discountMinor: BigInt(String(line['discountMinor'])),
            lineTotalMinor: BigInt(String(line['totalMinor'])),
            orderCategory: line.orderCategory,
            isAlcohol: Boolean(line['isAlcohol']),
            ageRestriction: product.ageRestriction,
            abv: product.abv,
            pricingMode: product.pricingMode,
            estimatedWeightGrams: product.estimatedWeightGrams,
            unitPriceDisplay: product.unitPriceDisplay,
            hfssStatus: product.hfssStatus,
            returnPolicy: product.returnPolicy,
            substitutionPreference: 'SIMILAR',
          },
        });
      }
      const reservations = await tx.stockReservation.findMany({
        where: { tenantId, checkoutSessionId: session.id, releasedAt: null },
      });
      for (const reservation of reservations) {
        const changed =
          await tx.$executeRaw`UPDATE "Inventory" SET "onHand" = "onHand" - ${reservation.quantity}, "reserved" = "reserved" - ${reservation.quantity}, "version" = "version" + 1 WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${reservation.inventoryId}::uuid AND "onHand" >= ${reservation.quantity} AND "reserved" >= ${reservation.quantity}`;
        if (changed !== 1)
          throw new ConflictException({
            code: 'STOCK_RESERVATION_INVALID',
            message: 'Reserved stock is no longer available',
          });
        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            inventoryId: reservation.inventoryId,
            reason: 'SALE',
            quantity: -reservation.quantity,
            reference: order.id,
          },
        });
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { releasedAt: new Date() },
        });
      }
      await tx.payment.create({
        data: {
          tenantId,
          orderId: order.id,
          provider: 'stripe',
          providerPaymentIntentId: intent.providerPaymentIntentId,
          status: authorisedOnly ? 'AUTHORISED' : 'CAPTURED',
          authorisedAmountMinor: intent.amountMinor,
          capturedAmountMinor: authorisedOnly ? 0n : intent.checkoutTotalMinor,
          currency: intent.currency,
          manualCapture: intent.manualCapture,
        },
      });
      const invoiceNumber = await allocateCommerceNumber(tx, tenantId, numberYear, 'INVOICE');
      await tx.invoice.create({
        data: {
          tenantId,
          orderId: order.id,
          invoiceNumber,
          invoiceNumberYear: numberYear,
          subtotalMinor: order.subtotalMinor,
          taxMinor: order.taxMinor,
          totalMinor: order.totalMinor,
          currency: order.currency,
        },
      });
      await tx.cart.update({ where: { id: session.cartId }, data: { status: 'CONVERTED' } });
      await tx.checkoutSession.update({ where: { id: session.id }, data: { status: 'COMPLETED' } });
      await tx.checkoutPaymentIntent.update({
        where: { id: intent.id },
        data: { status: authorisedOnly ? 'requires_capture' : 'succeeded' },
      });
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      await tx.outboxMessage.createMany({
        data: ['order.confirmed', 'notification.order-confirmed'].map((topic) => ({
          tenantId,
          topic,
          payload: { orderId: order.id },
        })),
      });
      return order;
    });
  }

  async captureAtPickCompletion(orderId: string, recomputedAmountMinor: bigint) {
    if (recomputedAmountMinor < 0n)
      throw new BadRequestException('Capture amount cannot be negative');
    const tenantId = TenantContext.requireTenantId();
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "tenantId" = ${tenantId}::uuid AND "orderId" = ${orderId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findFirst({ where: { tenantId, orderId } });
      if (!payment || !payment.manualCapture)
        throw new ConflictException('A manual-capture payment was not found');
      if (payment.status === 'CAPTURED') return payment;
      if (payment.status !== 'AUTHORISED')
        throw new ConflictException('Payment is not authorised for capture');
      const captureAmount =
        recomputedAmountMinor > payment.authorisedAmountMinor
          ? payment.authorisedAmountMinor
          : recomputedAmountMinor;
      const result = await this.provider.captureIntent(
        payment.providerPaymentIntentId,
        captureAmount,
        `${orderId}:capture`,
      );
      if (recomputedAmountMinor > payment.authorisedAmountMinor)
        await tx.priceCapEvent.create({
          data: {
            tenantId,
            orderId,
            authorisedAmountMinor: payment.authorisedAmountMinor,
            recomputedAmountMinor,
            capturedAmountMinor: captureAmount,
            currency: payment.currency,
          },
        });
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', capturedAmountMinor: result.capturedAmountMinor },
      });
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'CAPTURED' } });
      await tx.checkoutPaymentIntent.updateMany({
        where: { tenantId, providerPaymentIntentId: payment.providerPaymentIntentId },
        data: { status: result.status },
      });
      await tx.outboxMessage.createMany({
        data: ['payment.captured', 'notification.final-amount'].map((topic) => ({
          tenantId,
          topic,
          payload: { orderId, capturedAmountMinor: captureAmount.toString() },
        })),
      });
      return updated;
    });
  }

  async cancelExpiringAuthorisations(now = new Date()): Promise<number> {
    const tenantId = TenantContext.requireTenantId();
    const cutoff = new Date(now.getTime() - 6.5 * 24 * 60 * 60 * 1000);
    const expiring = await this.db.client.checkoutPaymentIntent.findMany({
      where: { status: 'requires_capture', createdAt: { lte: cutoff } },
    });
    let cancelled = 0;
    for (const intent of expiring) {
      await this.provider.cancelIntent(intent.providerPaymentIntentId, `${intent.id}:auto-cancel`);
      await this.db.transaction(async (tx) => {
        await tx.checkoutPaymentIntent.update({
          where: { id: intent.id },
          data: { status: 'cancelled' },
        });
        const order = await tx.order.findFirst({
          where: { tenantId, idempotencyKey: intent.checkoutSessionId },
        });
        if (order) {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'CANCELLED' },
          });
          await tx.payment.updateMany({
            where: { tenantId, orderId: order.id, status: 'AUTHORISED' },
            data: { status: 'CANCELLED' },
          });
        }
      });
      cancelled += 1;
    }
    return cancelled;
  }

  private async paymentFailed(webhookEventId: string, providerId: string): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    await this.db.transaction(async (tx) => {
      const intent = await tx.checkoutPaymentIntent.findFirst({
        where: { tenantId, providerPaymentIntentId: providerId },
      });
      if (intent)
        await tx.checkoutPaymentIntent.update({
          where: { id: intent.id },
          data: { status: 'payment_failed' },
        });
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'notification.payment-failed', payload: { providerId } },
      });
    });
  }

  private async disputeCreated(
    webhookEventId: string,
    object: Record<string, unknown>,
  ): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    const providerId = typeof object.payment_intent === 'string' ? object.payment_intent : '';
    await this.db.transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { tenantId, providerPaymentIntentId: providerId },
      });
      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { refundsFrozen: true, disputedAt: new Date() },
        });
        await tx.adminTask.create({
          data: {
            tenantId,
            orderId: payment.orderId,
            type: 'PAYMENT_DISPUTE',
            payload: object as Prisma.InputJsonValue,
          },
        });
      }
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    });
  }

  private async markProcessed(webhookEventId: string, topic?: string): Promise<void> {
    const tenantId = TenantContext.requireTenantId();
    await this.db.transaction(async (tx) => {
      await tx.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      if (topic)
        await tx.outboxMessage.create({
          data: { tenantId, topic, payload: { webhookEventId } },
        });
    });
  }

  private publicIntent(intent: {
    id: string;
    providerPaymentIntentId: string;
    clientSecret: string;
    status: string;
    amountMinor: bigint;
    checkoutTotalMinor: bigint;
    currency: string;
    manualCapture: boolean;
  }) {
    return {
      id: intent.id,
      providerPaymentIntentId: intent.providerPaymentIntentId,
      clientSecret: intent.clientSecret,
      status: intent.status,
      amountMinor: intent.amountMinor,
      checkoutTotalMinor: intent.checkoutTotalMinor,
      currency: intent.currency,
      manualCapture: intent.manualCapture,
    };
  }
}
