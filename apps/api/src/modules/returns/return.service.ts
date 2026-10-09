import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PaymentProvider } from '@app/ports';
import { TOKENS } from '@app/ports';
import type { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { PricingService } from '../pricing/pricing.service';
import {
  createRefundSchema,
  createReturnSchema,
  returnListSchema,
  updateReturnSchema,
} from './return.schemas';

type ReturnRule = {
  windowDays: number;
  eligibleReasons: string[];
  disposition: string;
  approvalRole: string;
};
type ReturnSettings = Record<'GROCERY' | 'ALCOHOL', ReturnRule>;

@Injectable()
export class ReturnService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly pricing: PricingService,
    @Inject(TOKENS.Payment) private readonly provider: PaymentProvider,
  ) {}

  async createReturn(raw: unknown) {
    const input = createReturnSchema.parse(raw);
    const userId = this.userId();
    return this.db.transaction(async (tx, tenantId) => {
      const order = await tx.order.findFirst({ where: { tenantId, id: input.orderId, userId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.fulfilmentStatus !== 'DELIVERED')
        throw new UnprocessableEntityException({
          code: 'RETURN_ORDER_NOT_DELIVERED',
          message: 'Returns can only be requested for a delivered order',
        });
      const requested = new Map(input.items.map((item) => [item.orderItemId, item.quantity]));
      if (requested.size !== input.items.length)
        throw new UnprocessableEntityException('Duplicate return item');
      const lines = await tx.orderItem.findMany({
        where: { tenantId, orderId: order.id, id: { in: [...requested.keys()] } },
      });
      if (lines.length !== requested.size) throw new NotFoundException('Order item not found');
      const settings = await this.settings(tx, tenantId);
      const prior = await tx.returnRequestItem.findMany({
        where: { tenantId, orderItemId: { in: [...requested.keys()] } },
      });
      const priorRequests = await tx.returnRequest.findMany({
        where: {
          tenantId,
          id: { in: prior.map((item) => item.returnRequestId) },
          status: { not: 'REJECTED' },
        },
        select: { id: true },
      });
      const activeIds = new Set(priorRequests.map((request) => request.id));
      const reservedByLine = new Map<string, number>();
      for (const item of prior)
        if (activeIds.has(item.returnRequestId))
          reservedByLine.set(
            item.orderItemId,
            (reservedByLine.get(item.orderItemId) ?? 0) + item.quantity,
          );
      const now = Date.now();
      for (const line of lines) {
        const quantity = requested.get(line.id) ?? 0;
        if (quantity + (reservedByLine.get(line.id) ?? 0) > line.quantity)
          throw new UnprocessableEntityException({
            code: 'RETURN_QUANTITY_EXCEEDED',
            message: `Return quantity exceeds the remaining quantity for ${line.productName}`,
          });
        if (['PERISHABLE_EXEMPT', 'NON_RETURNABLE'].includes(line.returnPolicy))
          throw new UnprocessableEntityException({
            code: 'RETURN_ITEM_INELIGIBLE',
            message: `${line.productName} is not returnable`,
          });
        const rule = settings[line.orderCategory];
        if (!rule.eligibleReasons.includes(input.reason))
          throw new UnprocessableEntityException({
            code: 'RETURN_REASON_INELIGIBLE',
            message: `${input.reason} is not eligible for ${line.orderCategory.toLowerCase()} items`,
          });
        if (now > order.createdAt.getTime() + rule.windowDays * 86_400_000)
          throw new UnprocessableEntityException({
            code: 'RETURN_WINDOW_EXPIRED',
            message: `The ${line.orderCategory.toLowerCase()} return window has expired`,
          });
      }
      const categories = [...new Set(lines.map((line) => line.orderCategory))];
      const policySnapshot = Object.fromEntries(
        categories.map((category) => [category, settings[category]]),
      ) as Prisma.InputJsonValue;
      const request = await tx.returnRequest.create({
        data: {
          tenantId,
          orderId: order.id,
          userId,
          reason: input.reason,
          customerNote: input.customerNote ?? null,
          policySnapshot,
        },
      });
      await tx.returnRequestItem.createMany({
        data: lines.map((line) => ({
          tenantId,
          returnRequestId: request.id,
          orderItemId: line.id,
          quantity: requested.get(line.id) ?? 0,
          policySnapshot: {
            category: line.orderCategory,
            returnPolicy: line.returnPolicy,
            rule: settings[line.orderCategory],
          },
        })),
      });
      await this.audit(tx, tenantId, 'RETURN_REQUESTED', 'ReturnRequest', request.id, undefined, {
        orderId: order.id,
        reason: input.reason,
        items: input.items,
      });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'return.requested', payload: { returnRequestId: request.id } },
      });
      return this.returnDetail(tx, request.id, userId);
    });
  }

  listReturns() {
    return this.db.client.returnRequest.findMany({
      where: { userId: this.userId() },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async returnDetailForCustomer(id: string) {
    return this.returnDetail(this.db.client as never, id, this.userId());
  }

  async adminListReturns(raw: unknown) {
    const input = returnListSchema.parse(raw);
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
    };
    const total = await this.db.client.returnRequest.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, pageCount);
    const items = await this.db.client.returnRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { items, page, pageSize: input.pageSize, total, pageCount };
  }

  async updateReturn(id: string, raw: unknown) {
    const input = updateReturnSchema.parse(raw);
    const actorId = this.userId();
    return this.db.transaction(async (tx, tenantId) => {
      const request = await tx.returnRequest.findFirst({ where: { tenantId, id } });
      if (!request) throw new NotFoundException('Return request not found');
      if (request.status !== 'REQUESTED')
        throw new ConflictException('Only a requested return can be reviewed');
      const updated = await tx.returnRequest.update({
        where: { id },
        data: {
          status: input.status,
          adminNote: input.adminNote ?? null,
          disposition: input.disposition ?? null,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      await this.audit(
        tx,
        tenantId,
        `RETURN_${input.status}`,
        'ReturnRequest',
        id,
        {
          status: request.status,
        },
        { status: updated.status, adminNote: updated.adminNote },
      );
      await tx.outboxMessage.create({
        data: {
          tenantId,
          topic: `return.${input.status.toLowerCase()}`,
          payload: { returnRequestId: id, orderId: request.orderId },
        },
      });
      return this.returnDetail(tx, id);
    });
  }

  async createRefund(raw: unknown) {
    const input = createRefundSchema.parse(raw);
    const actorId = this.userId();
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          ...input,
          items: [...input.items].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId)),
        }),
      )
      .digest('hex');
    let reservation: { refundId: string; submit: boolean; method: 'CARD' | 'STORE_CREDIT' };
    try {
      reservation = await this.db.transaction(async (tx, tenantId) => {
        const existing = await tx.refund.findFirst({
          where: { tenantId, idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          if (existing.requestHash !== requestHash)
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'Idempotency key was used with a different refund request',
            });
          return {
            refundId: existing.id,
            submit: existing.status === 'PENDING',
            method: existing.method as 'CARD' | 'STORE_CREDIT',
          };
        }
        await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "tenantId" = ${tenantId}::uuid AND "orderId" = ${input.orderId}::uuid FOR UPDATE`;
        const [order, payment] = await Promise.all([
          tx.order.findFirst({ where: { tenantId, id: input.orderId } }),
          tx.payment.findFirst({ where: { tenantId, orderId: input.orderId } }),
        ]);
        if (!order || !payment) throw new NotFoundException('Captured payment not found');
        if (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED')
          throw new UnprocessableEntityException('Payment is not refundable');
        if (payment.refundsFrozen)
          throw new ConflictException({
            code: 'REFUNDS_FROZEN',
            message: 'Refunds are frozen while a payment dispute is open',
          });
        const itemIds = input.items.map((item) => item.orderItemId);
        const lines = await tx.orderItem.findMany({
          where: { tenantId, orderId: order.id, id: { in: itemIds } },
        });
        if (lines.length !== itemIds.length) throw new NotFoundException('Order item not found');
        const priorItems = await tx.refundItem.findMany({
          where: { tenantId, orderItemId: { in: itemIds } },
        });
        const priorRefunds = await tx.refund.findMany({
          where: {
            tenantId,
            id: { in: priorItems.map((item) => item.refundId) },
            status: { not: 'FAILED' },
          },
          select: { id: true },
        });
        const activeRefundIds = new Set(priorRefunds.map((refund) => refund.id));
        const priorQuantity = new Map<string, number>();
        for (const item of priorItems)
          if (activeRefundIds.has(item.refundId))
            priorQuantity.set(
              item.orderItemId,
              (priorQuantity.get(item.orderItemId) ?? 0) + item.quantity,
            );
        if (input.returnRequestId) {
          const returnRequest = await tx.returnRequest.findFirst({
            where: { tenantId, id: input.returnRequestId, orderId: order.id },
          });
          if (!returnRequest) throw new NotFoundException('Return request not found');
          if (returnRequest.status !== 'APPROVED')
            throw new ConflictException('Return request must be approved before refunding');
          const approvedItems = await tx.returnRequestItem.findMany({
            where: { tenantId, returnRequestId: returnRequest.id },
          });
          const approvedById = new Map(
            approvedItems.map((item) => [item.orderItemId, item.quantity]),
          );
          for (const item of input.items)
            if (item.quantity > (approvedById.get(item.orderItemId) ?? 0))
              throw new UnprocessableEntityException('Refund exceeds the approved return quantity');
        }
        const requested = new Map(input.items.map((item) => [item.orderItemId, item.quantity]));
        const calculations = lines.map((line) => ({
          orderItemId: line.id,
          ...this.pricing.calculateRefund(
            line,
            requested.get(line.id) ?? 0,
            priorQuantity.get(line.id) ?? 0,
          ),
        }));
        const amountMinor = calculations.reduce((sum, item) => sum + item.amountMinor, 0n);
        const reserved = await tx.refund.aggregate({
          where: { tenantId, paymentId: payment.id, status: { not: 'FAILED' } },
          _sum: { amountMinor: true },
        });
        if ((reserved._sum.amountMinor ?? 0n) + amountMinor > payment.capturedAmountMinor)
          throw new UnprocessableEntityException({
            code: 'REFUND_EXCEEDS_PAYMENT',
            message: 'Refund exceeds the remaining captured payment amount',
          });
        const refund = await tx.refund.create({
          data: {
            tenantId,
            orderId: order.id,
            paymentId: payment.id,
            returnRequestId: input.returnRequestId ?? null,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            method: input.method,
            amountMinor,
            currency: payment.currency,
            status: 'PENDING',
            reason: input.reason,
            createdById: actorId,
          },
        });
        await tx.refundItem.createMany({
          data: calculations.map((item) => ({
            tenantId,
            refundId: refund.id,
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            amountMinor: item.amountMinor,
            vatPortionMinor: item.vatPortionMinor,
          })),
        });
        if (input.returnRequestId)
          await tx.returnRequest.update({
            where: { id: input.returnRequestId },
            data: { status: 'REFUND_PENDING' },
          });
        await this.audit(tx, tenantId, 'REFUND_INITIATED', 'Refund', refund.id, undefined, {
          orderId: order.id,
          amountMinor: amountMinor.toString(),
          method: input.method,
        });
        await tx.outboxMessage.create({
          data: {
            tenantId,
            topic: 'refund.initiated',
            payload: { refundId: refund.id, orderId: order.id },
          },
        });
        if (input.method === 'STORE_CREDIT')
          await tx.coupon.create({
            data: {
              tenantId,
              code: `CREDIT-${refund.id.replaceAll('-', '').slice(0, 16).toUpperCase()}`,
              type: 'FIXED',
              valueMinor: amountMinor,
              currency: payment.currency,
              startsAt: new Date(),
              endsAt: new Date(Date.now() + 365 * 86_400_000),
              maxUses: 1,
              couponClass: 'CUSTOMER_CREDIT',
              perCustomerLimit: 1,
              lockedUserId: order.userId,
              returnRequestId: input.returnRequestId ?? null,
            },
          });
        return { refundId: refund.id, submit: true, method: input.method };
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('REFUND_EXCEEDS_PAYMENT'))
        throw new UnprocessableEntityException({
          code: 'REFUND_EXCEEDS_PAYMENT',
          message: 'Refund exceeds the remaining captured payment amount',
        });
      throw error;
    }
    if (!reservation.submit) return this.refundDetail(reservation.refundId);
    const pending = await this.db.client.refund.findFirst({ where: { id: reservation.refundId } });
    if (!pending) throw new NotFoundException('Refund not found');
    if (reservation.method === 'STORE_CREDIT') {
      await this.completeRefund(pending.id, null, false);
      return this.refundDetail(pending.id);
    }
    const payment = await this.db.client.payment.findFirst({ where: { id: pending.paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    try {
      const result = await this.provider.refundIntent(
        payment.providerPaymentIntentId,
        pending.amountMinor,
        input.idempotencyKey,
      );
      if (result.amountMinor !== pending.amountMinor)
        throw new Error('Payment provider returned a mismatched refund amount');
      await this.completeRefund(pending.id, result.id, true);
    } catch (error) {
      await this.failRefund(pending.id, error);
      throw error;
    }
    return this.refundDetail(pending.id);
  }

  async refundDetail(id: string) {
    const refund = await this.db.client.refund.findFirst({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    const items = await this.db.client.refundItem.findMany({ where: { refundId: id } });
    return { ...refund, items };
  }

  async refundRefusedDelivery(orderId: string) {
    const settings = await this.db.client.tenantSettings.findFirst();
    const root = settings?.settings as Record<string, unknown> | undefined;
    const returns = root?.returns as Record<string, unknown> | undefined;
    const fullOrder = returns?.refusedDeliveryScope === 'FULL_ORDER';
    const lines = await this.db.client.orderItem.findMany({
      where: { orderId, ...(fullOrder ? {} : { orderCategory: 'ALCOHOL' }) },
    });
    if (lines.length === 0) return null;
    return this.createRefund({
      orderId,
      idempotencyKey: `delivery-refusal-${orderId}`,
      reason: 'Delivery proof-of-age refusal',
      items: lines.map((line) => ({ orderItemId: line.id, quantity: line.quantity })),
    });
  }

  private async completeRefund(refundId: string, providerRefundId: string | null, card: boolean) {
    await this.db.transaction(async (tx, tenantId) => {
      const refund = await tx.refund.findFirst({ where: { tenantId, id: refundId } });
      if (!refund || refund.status !== 'PENDING') return;
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${refund.paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findFirst({ where: { tenantId, id: refund.paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      const newRefunded = card
        ? payment.refundedAmountMinor + refund.amountMinor
        : payment.refundedAmountMinor;
      const economicRefunds = await tx.refund.aggregate({
        where: { tenantId, paymentId: payment.id, status: { in: ['PARTIAL', 'FULL'] } },
        _sum: { amountMinor: true },
      });
      const totalEconomicRefunded = (economicRefunds._sum.amountMinor ?? 0n) + refund.amountMinor;
      const full = totalEconomicRefunded >= payment.capturedAmountMinor;
      await tx.refund.update({
        where: { id: refund.id },
        data: { providerRefundId, status: full ? 'FULL' : 'PARTIAL' },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmountMinor: newRefunded,
          status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
      await tx.order.update({
        where: { id: refund.orderId },
        data: {
          refundStatus: full ? 'FULL' : 'PARTIAL',
          paymentStatus: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
      if (refund.returnRequestId)
        await tx.returnRequest.update({
          where: { id: refund.returnRequestId },
          data: { status: 'COMPLETED' },
        });
      if (refund.returnRequestId) {
        const request = await tx.returnRequest.findFirst({
          where: { tenantId, id: refund.returnRequestId },
        });
        if (request?.disposition) {
          const items = await tx.refundItem.findMany({ where: { tenantId, refundId: refund.id } });
          const orderItems = await tx.orderItem.findMany({
            where: { tenantId, id: { in: items.map((item) => item.orderItemId) } },
          });
          const productByItem = new Map(orderItems.map((item) => [item.id, item.productId]));
          for (const item of items) {
            const productId = productByItem.get(item.orderItemId);
            if (!productId) continue;
            const inventoryRows = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT i."id" FROM "Inventory" i
              INNER JOIN "Warehouse" w ON w."id" = i."warehouseId" AND w."tenantId" = i."tenantId"
              WHERE i."tenantId" = ${tenantId}::uuid AND i."productId" = ${productId}::uuid AND w."active" = true
              ORDER BY i."id" LIMIT 1 FOR UPDATE OF i`;
            const inventoryId = inventoryRows[0]?.id;
            if (!inventoryId) continue;
            if (request.disposition === 'RESTOCK')
              await tx.inventory.update({
                where: { id: inventoryId },
                data: { onHand: { increment: item.quantity }, version: { increment: 1 } },
              });
            await tx.inventoryTransaction.create({
              data: {
                tenantId,
                inventoryId,
                reason: request.disposition === 'RESTOCK' ? 'RETURN' : 'WASTAGE',
                quantity: request.disposition === 'RESTOCK' ? item.quantity : -item.quantity,
                reference: `refund:${refund.id}`,
                actorId: TenantContext.get()?.userId ?? null,
              },
            });
          }
        }
      }
      await this.audit(
        tx,
        tenantId,
        'REFUND_COMPLETED',
        'Refund',
        refund.id,
        { status: 'PENDING' },
        {
          status: full ? 'FULL' : 'PARTIAL',
          providerRefundId,
        },
      );
      await tx.outboxMessage.create({
        data: {
          tenantId,
          topic: 'refund.completed',
          payload: { refundId: refund.id, orderId: refund.orderId },
        },
      });
    });
  }

  private async failRefund(refundId: string, error: unknown) {
    await this.db.transaction(async (tx, tenantId) => {
      const refund = await tx.refund.findFirst({ where: { tenantId, id: refundId } });
      if (!refund || refund.status !== 'PENDING') return;
      await tx.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
      if (refund.returnRequestId)
        await tx.returnRequest.update({
          where: { id: refund.returnRequestId },
          data: { status: 'APPROVED' },
        });
      await this.audit(
        tx,
        tenantId,
        'REFUND_FAILED',
        'Refund',
        refund.id,
        { status: 'PENDING' },
        {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown provider error',
        },
      );
    });
  }

  private async returnDetail(tx: Prisma.TransactionClient, id: string, userId?: string) {
    const tenantId = TenantContext.requireTenantId();
    const request = await tx.returnRequest.findFirst({
      where: { tenantId, id, ...(userId ? { userId } : {}) },
    });
    if (!request) throw new NotFoundException('Return request not found');
    const items = await tx.returnRequestItem.findMany({ where: { tenantId, returnRequestId: id } });
    return { ...request, items };
  }

  private async settings(tx: Prisma.TransactionClient, tenantId: string): Promise<ReturnSettings> {
    const record = await tx.tenantSettings.findFirst({ where: { tenantId } });
    const settings = record?.settings as Record<string, unknown> | undefined;
    const returns = settings?.returns as Partial<ReturnSettings> | undefined;
    if (!returns?.GROCERY || !returns.ALCOHOL)
      throw new ConflictException({
        code: 'RETURN_RULES_NOT_CONFIGURED',
        message: 'Grocery and alcohol return rules must be configured',
      });
    return returns as ReturnSettings;
  }

  private audit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    action: string,
    entity: string,
    entityId: string,
    before?: Prisma.InputJsonValue,
    after?: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId,
        actorId: TenantContext.get()?.userId ?? null,
        actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
        action,
        entity,
        entityId,
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
        requestId: TenantContext.get()?.requestId ?? randomUUID(),
      },
    });
  }

  private userId(): string {
    const userId = TenantContext.get()?.userId;
    if (!userId) throw new NotFoundException('User not found');
    return userId;
  }
}
