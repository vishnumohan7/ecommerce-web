import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FulfilmentStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { CartService } from '../cart/cart.service';
import { PaymentService } from '../payments/payment.service';
import { NotificationService } from '../notifications/notification.service';
import { ReturnService } from '../returns/return.service';
import { renderAlcoholComplianceCsv, renderAlcoholCompliancePdf } from './compliance.renderer';
import { renderInvoicePdf } from './invoice.renderer';
import {
  deliveryAgeCheckSchema,
  fulfilmentTransitionSchema,
  orderListSchema,
  pickItemSchema,
} from './order.schemas';

const transitions: Readonly<Record<FulfilmentStatus, readonly FulfilmentStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKING', 'CANCELLED'],
  PICKING: ['PICKED', 'CANCELLED'],
  PICKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'REFUSED'],
  DELIVERED: [],
  REFUSED: [],
  CANCELLED: [],
};
const progress: FulfilmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PICKING',
  'PICKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function isFulfilmentTransitionAllowed(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
): boolean {
  return transitions[from].includes(to);
}

export function validateSubstitution(
  original: { isAlcohol: boolean; ageRestriction: number },
  substitute: { isAlcohol: boolean; ageRestriction: number },
): void {
  if (original.isAlcohol !== substitute.isAlcohol)
    throw new UnprocessableEntityException(
      'Alcohol and grocery products cannot substitute each other',
    );
  if (substitute.ageRestriction < original.ageRestriction)
    throw new UnprocessableEntityException('Substitute age restriction must be equal or stricter');
}

@Injectable()
export class OrderService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly carts: CartService,
    private readonly payments: PaymentService,
    @Optional() private readonly returns?: ReturnService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async customerList() {
    const userId = this.userId();
    const orders = await this.db.client.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(orders.map((order) => this.summary(order)));
  }

  async customerDetail(id: string) {
    const order = await this.db.client.order.findFirst({ where: { id, userId: this.userId() } });
    if (!order) throw new NotFoundException('Order not found');
    return this.detail(order.id);
  }

  async adminList(raw: unknown) {
    const input = orderListSchema.parse(raw);
    const where: Prisma.OrderWhereInput = {
      ...(input.basketType ? { basketType: input.basketType } : {}),
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus as never } : {}),
      ...(input.fulfilmentStatus ? { fulfilmentStatus: input.fulfilmentStatus as never } : {}),
      ...(input.ageVerificationStatus
        ? { ageVerificationStatus: input.ageVerificationStatus as never }
        : {}),
      ...(input.deliveryAgeCheckStatus
        ? { deliveryAgeCheckStatus: input.deliveryAgeCheckStatus as never }
        : {}),
      ...(input.search && /^\d+$/.test(input.search) ? { orderNumber: BigInt(input.search) } : {}),
    };
    const orders = await this.db.client.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(orders.map((order) => this.summary(order)));
  }

  adminDetail(id: string) {
    return this.detail(id);
  }

  async tracking(id: string) {
    const order = await this.db.client.order.findFirst({ where: { id, userId: this.userId() } });
    if (!order) throw new NotFoundException('Order not found');
    const groups = await this.db.client.orderFulfilmentGroup.findMany({ where: { orderId: id } });
    const audits = await this.db.client.auditLog.findMany({
      where: { entity: 'OrderFulfilmentGroup', entityId: { in: groups.map((group) => group.id) } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      orderId: id,
      orderNumber: this.orderNumber(order.orderNumber, order.orderNumberYear),
      currentStatus: order.fulfilmentStatus,
      steps: [
        { key: 'ORDER_PLACED', complete: true, at: order.createdAt },
        ...audits.map((audit) => ({ key: audit.action, complete: true, at: audit.createdAt })),
        ...(order.basketType === 'GROCERY'
          ? []
          : [
              {
                key: 'DELIVERY_AGE_CHECK',
                complete: ['PASSED', 'FAILED', 'REFUSED'].includes(order.deliveryAgeCheckStatus),
                status: order.deliveryAgeCheckStatus,
              },
            ]),
      ],
    };
  }

  async transition(orderId: string, groupId: string, raw: unknown) {
    const input = fulfilmentTransitionSchema.parse(raw);
    const tenantId = TenantContext.requireTenantId();
    const actorId = this.userId();
    const updated = await this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OrderFulfilmentGroup" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${groupId}::uuid FOR UPDATE`;
      const group = await tx.orderFulfilmentGroup.findFirst({
        where: { tenantId, id: groupId, orderId },
      });
      if (!group) throw new NotFoundException('Fulfilment group not found');
      if (!isFulfilmentTransitionAllowed(group.status, input.status))
        throw new UnprocessableEntityException({
          code: 'ILLEGAL_FULFILMENT_TRANSITION',
          message: `${group.status} cannot transition to ${input.status}`,
        });
      const updated = await tx.orderFulfilmentGroup.update({
        where: { id: group.id },
        data: { status: input.status },
      });
      if (group.category === 'ALCOHOL' && input.status === 'OUT_FOR_DELIVERY') {
        const order = await tx.order.findFirstOrThrow({ where: { tenantId, id: orderId } });
        const alcoholLines = await tx.orderItem.findMany({
          where: { tenantId, orderId, orderCategory: 'ALCOHOL' },
        });
        const customer = order.customerSnapshot as Record<string, unknown>;
        const recipientName =
          [customer.firstName, customer.lastName]
            .filter((value) => typeof value === 'string')
            .join(' ') || 'Order recipient';
        const dispatchDate = new Date();
        dispatchDate.setUTCHours(0, 0, 0, 0);
        await tx.alcoholDayBookEntry.createMany({
          data: alcoholLines.map((line) => {
            const record = {
              orderId,
              orderItemId: line.id,
              dispatchDate: dispatchDate.toISOString(),
              productName: line.productName,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotalMinor.toString(),
              currency: line.currency,
              recipientName,
              recipientAddress: order.deliveryAddress as Prisma.InputJsonValue,
            };
            return {
              tenantId,
              orderId,
              orderItemId: line.id,
              dispatchDate,
              productName: line.productName,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotalMinor,
              currency: line.currency,
              recipientName,
              recipientAddress: order.deliveryAddress as Prisma.InputJsonValue,
              immutableHash: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
            };
          }),
          skipDuplicates: true,
        });
      }
      const groups = await tx.orderFulfilmentGroup.findMany({ where: { tenantId, orderId } });
      const derived = this.deriveStatus(groups.map((item) => item.status));
      await tx.order.update({ where: { id: orderId }, data: { fulfilmentStatus: derived } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorType: 'USER',
          action: 'ORDER_FULFILMENT_TRANSITION',
          entity: 'OrderFulfilmentGroup',
          entityId: group.id,
          before: { status: group.status },
          after: { status: input.status },
          requestId: TenantContext.get()?.requestId ?? 'order-transition',
        },
      });
      await tx.outboxMessage.create({
        data: {
          tenantId,
          topic: 'order.fulfilment-status-changed',
          payload: { orderId, groupId, category: group.category, status: input.status },
        },
      });
      return updated;
    });
    await this.notifications?.process(100);
    return updated;
  }

  async invoice(id: string, admin = false): Promise<{ filename: string; pdf: Buffer }> {
    const order = await this.db.client.order.findFirst({
      where: { id, ...(admin ? {} : { userId: this.userId() }) },
    });
    if (!order) throw new NotFoundException('Order not found');
    const [invoice, lines, merchant, deliverySlot] = await Promise.all([
      this.db.client.invoice.findFirst({ where: { orderId: id } }),
      this.db.client.orderItem.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.client.brandingProfile.findFirst(),
      order.deliverySlotId
        ? this.db.client.deliverySlot.findFirst({ where: { id: order.deliverySlotId } })
        : Promise.resolve(null),
    ]);
    if (!invoice || !merchant) throw new NotFoundException('Invoice not found');
    const invoiceNumber = this.invoiceNumber(invoice.invoiceNumber, invoice.invoiceNumberYear);
    return {
      filename: `${invoiceNumber}.pdf`,
      pdf: renderInvoicePdf({
        invoiceNumber,
        orderNumber: this.orderNumber(order.orderNumber, order.orderNumberYear),
        issuedAt: invoice.issuedAt,
        currency: order.currency,
        lines: lines.map((line) => ({
          productName: line.productName,
          sku: line.sku,
          quantity: line.quantity,
          unitPriceMinor: line.unitPriceMinor,
          vatRateBps: line.vatRateBps,
          vatAmountMinor: line.vatAmountMinor,
          lineTotalMinor: line.lineTotalMinor,
          orderCategory: line.orderCategory,
        })),
        subtotalMinor: order.subtotalMinor,
        discountMinor: order.discountMinor,
        deliveryFeeMinor: order.deliveryFeeMinor,
        taxMinor: order.taxMinor,
        totalMinor: order.totalMinor,
        paymentStatus: order.paymentStatus,
        deliveryAddress: order.deliveryAddress as Record<string, unknown>,
        customer: order.customerSnapshot as Record<string, unknown>,
        deliverySlot,
        merchant: {
          brandName: merchant.brandName,
          legalEntityName: merchant.legalEntityName,
          companyNumber: merchant.companyNumber,
          vatNumber: merchant.vatNumber,
          registeredAddress: merchant.registeredAddress as Record<string, unknown>,
        },
      }),
    };
  }

  async reorder(id: string) {
    const userId = this.userId();
    const order = await this.db.client.order.findFirst({ where: { id, userId } });
    if (!order) throw new NotFoundException('Order not found');
    const lines = await this.db.client.orderItem.findMany({ where: { orderId: id } });
    const unavailable: string[] = [];
    for (const line of lines) {
      try {
        await this.carts.add({ userId }, { productId: line.productId, quantity: line.quantity });
      } catch {
        unavailable.push(line.productId);
      }
    }
    return { cart: await this.carts.read({ userId }), unavailableProductIds: unavailable };
  }

  async deliveryAgeCheck(raw: unknown) {
    const input = deliveryAgeCheckSchema.parse(raw);
    const actorId = this.userId();
    const tenantId = TenantContext.requireTenantId();
    const check = await this.db.transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { tenantId, id: input.orderId } });
      if (!order) throw new NotFoundException('Order not found');
      const ageRestricted = order.basketType !== 'GROCERY';
      if (ageRestricted && !input.recipientPresent)
        throw new UnprocessableEntityException({
          code: 'AGE_RESTRICTED_UNATTENDED',
          message: 'An age-restricted order cannot be left unattended',
        });
      if (input.outcome === 'PASSED' && ageRestricted && !input.idType)
        throw new ConflictException('ID type is required for a passed age check');
      const status = input.outcome === 'PASSED' ? 'PASSED' : input.outcome;
      const check = await tx.deliveryAgeCheck.create({
        data: {
          tenantId,
          actorId,
          orderId: input.orderId,
          outcome: input.outcome,
          challengeAge: input.challengeAge,
          idType: input.idType ?? null,
          recipientPresent: input.recipientPresent,
          refusalReason: input.refusalReason ?? null,
          note: input.note ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          doorstepPhotoUrl: input.doorstepPhotoUrl ?? null,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryAgeCheckStatus: status,
          ...(input.outcome === 'REFUSED' ? { fulfilmentStatus: 'REFUSED' } : {}),
        },
      });
      if (input.outcome === 'REFUSED')
        await tx.orderFulfilmentGroup.updateMany({
          where: { tenantId, orderId: order.id, category: 'ALCOHOL' },
          data: { status: 'REFUSED' },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorType: 'USER',
          action: `DELIVERY_AGE_CHECK_${input.outcome}`,
          entity: 'Order',
          entityId: order.id,
          after: { outcome: input.outcome, idType: input.idType ?? null },
          requestId: TenantContext.get()?.requestId ?? 'delivery-age-check',
        },
      });
      await tx.outboxMessage.createMany({
        data: [
          {
            tenantId,
            topic: 'notification.delivery-age-check',
            payload: { orderId: order.id, outcome: input.outcome },
          },
          ...(input.outcome === 'REFUSED'
            ? [
                {
                  tenantId,
                  topic: 'refund.delivery-refusal-requested',
                  payload: { orderId: order.id },
                },
              ]
            : []),
        ],
      });
      return check;
    });
    if (input.outcome === 'REFUSED' && this.returns)
      await this.returns.refundRefusedDelivery(input.orderId);
    return check;
  }

  async createPickList(orderId: string) {
    const tenantId = TenantContext.requireTenantId();
    return this.db.transaction(async (tx) => {
      const existing = await tx.pickList.findFirst({ where: { tenantId, orderId } });
      if (existing) return existing;
      const order = await tx.order.findFirst({ where: { tenantId, id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (!['CONFIRMED', 'PICKING'].includes(order.fulfilmentStatus))
        throw new UnprocessableEntityException('Order must be confirmed before picking');
      const lines = await tx.orderItem.findMany({ where: { tenantId, orderId } });
      const pickList = await tx.pickList.create({ data: { tenantId, orderId } });
      await tx.pickListItem.createMany({
        data: lines.map((line) => ({
          tenantId,
          pickListId: pickList.id,
          orderItemId: line.id,
          requested: line.quantity,
        })),
      });
      await tx.pickList.update({ where: { id: pickList.id }, data: { status: 'IN_PROGRESS' } });
      await tx.order.update({ where: { id: orderId }, data: { fulfilmentStatus: 'PICKING' } });
      await tx.orderFulfilmentGroup.updateMany({
        where: { tenantId, orderId, status: 'CONFIRMED' },
        data: { status: 'PICKING' },
      });
      return pickList;
    });
  }

  async pickList(orderId: string) {
    const list = await this.db.client.pickList.findFirst({ where: { orderId } });
    if (!list) throw new NotFoundException('Pick list not found');
    const items = await this.db.client.pickListItem.findMany({ where: { pickListId: list.id } });
    const orderItems = await this.db.client.orderItem.findMany({
      where: { id: { in: items.map((item) => item.orderItemId) } },
    });
    const products = await this.db.client.product.findMany({
      where: { id: { in: orderItems.map((item) => item.productId) } },
      select: { id: true, storageType: true },
    });
    const enriched = items.map((item) => {
      const orderItem = orderItems.find((line) => line.id === item.orderItemId);
      const product = products.find((entry) => entry.id === orderItem?.productId);
      return {
        ...item,
        orderItem,
        storageType: product?.storageType ?? 'AMBIENT',
        aisle: 'UNASSIGNED',
      };
    });
    const grouped = new Map<string, typeof enriched>();
    for (const item of enriched) {
      const key = `${item.storageType}:${item.aisle}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return {
      ...list,
      items: enriched,
      groups: [...grouped].map(([key, groupedItems]) => ({ key, items: groupedItems })),
    };
  }

  async recordPick(orderId: string, pickItemId: string, raw: unknown) {
    const input = pickItemSchema.parse(raw);
    const tenantId = TenantContext.requireTenantId();
    const actorId = this.userId();
    return this.db.transaction(async (tx) => {
      const list = await tx.pickList.findFirst({ where: { tenantId, orderId } });
      if (!list || list.status !== 'IN_PROGRESS')
        throw new ConflictException('Pick list is not open');
      const item = await tx.pickListItem.findFirst({
        where: { tenantId, id: pickItemId, pickListId: list.id },
      });
      if (!item) throw new NotFoundException('Pick item not found');
      if (input.picked > item.requested) throw new ConflictException('Picked quantity is too high');
      const line = await tx.orderItem.findFirstOrThrow({
        where: { tenantId, id: item.orderItemId },
      });
      if (
        line.pricingMode === 'WEIGHT_ESTIMATED' &&
        input.outcome !== 'SHORT' &&
        !input.actualWeightGrams
      )
        throw new UnprocessableEntityException(
          'Actual weight is required for variable-weight lines',
        );
      if (input.outcome === 'SUBSTITUTED') {
        if (!input.substituteProductId)
          throw new ConflictException('Substitute product is required');
        const substitute = await tx.product.findFirst({
          where: { tenantId, id: input.substituteProductId, status: 'ACTIVE' },
        });
        if (!substitute) throw new NotFoundException('Substitute product not found');
        validateSubstitution(line, substitute);
        await tx.substitution.create({
          data: {
            tenantId,
            orderItemId: line.id,
            substituteProductId: substitute.id,
            status: 'ACCEPTED',
            proposedPriceMinor: substitute.priceMinor,
            currency: substitute.currency,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
      if (input.actualWeightGrams)
        await tx.weightCapture.upsert({
          where: { orderItemId: line.id },
          update: { grams: input.actualWeightGrams, capturedById: actorId, capturedAt: new Date() },
          create: {
            tenantId,
            orderItemId: line.id,
            grams: input.actualWeightGrams,
            capturedById: actorId,
          },
        });
      await tx.orderItem.update({
        where: { id: line.id },
        data: { actualWeightGrams: input.actualWeightGrams ?? null },
      });
      return tx.pickListItem.update({
        where: { id: item.id },
        data: {
          picked: input.picked,
          outcome: input.outcome,
          substituteProductId: input.substituteProductId ?? null,
          completedAt: new Date(),
        },
      });
    });
  }

  async completePick(orderId: string) {
    const tenantId = TenantContext.requireTenantId();
    const result = await this.db.transaction(async (tx) => {
      const list = await tx.pickList.findFirst({ where: { tenantId, orderId } });
      if (!list || list.status !== 'IN_PROGRESS')
        throw new ConflictException('Pick list is not open');
      const picks = await tx.pickListItem.findMany({ where: { tenantId, pickListId: list.id } });
      if (picks.length === 0 || picks.some((pick) => !pick.completedAt))
        throw new UnprocessableEntityException('Every pick line must be completed');
      const lines = await tx.orderItem.findMany({ where: { tenantId, orderId } });
      const order = await tx.order.findFirstOrThrow({ where: { tenantId, id: orderId } });
      let recomputed = order.deliveryFeeMinor;
      for (const line of lines) {
        const pick = picks.find((entry) => entry.orderItemId === line.id);
        if (!pick) continue;
        if (
          line.pricingMode === 'WEIGHT_ESTIMATED' &&
          line.actualWeightGrams &&
          line.estimatedWeightGrams
        )
          recomputed +=
            (line.lineTotalMinor * BigInt(line.actualWeightGrams)) /
            BigInt(line.estimatedWeightGrams);
        else recomputed += (line.lineTotalMinor * BigInt(pick.picked)) / BigInt(line.quantity);
      }
      await tx.pickList.update({ where: { id: list.id }, data: { status: 'COMPLETE' } });
      await tx.order.update({ where: { id: orderId }, data: { fulfilmentStatus: 'PICKED' } });
      await tx.orderFulfilmentGroup.updateMany({
        where: { tenantId, orderId, status: 'PICKING' },
        data: { status: 'PICKED' },
      });
      return {
        recomputed,
        manualCapture:
          (await tx.payment.findFirst({ where: { tenantId, orderId } }))?.manualCapture ?? false,
      };
    });
    if (result.manualCapture)
      await this.payments.captureAtPickCompletion(orderId, result.recomputed);
    return { orderId, recomputedAmountMinor: result.recomputed };
  }

  async dayBook(date: Date) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.db.client.alcoholDayBookEntry.findMany({
      where: { dispatchDate: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async dayBookCsv(date: Date): Promise<string> {
    return renderAlcoholComplianceCsv(await this.dayBook(date));
  }

  async dayBookPdf(date: Date): Promise<Buffer> {
    const dateLabel = date.toISOString().slice(0, 10);
    return renderAlcoholCompliancePdf(
      `ALCOHOL DESPATCH DAY BOOK — ${dateLabel}`,
      await this.dayBook(date),
    );
  }

  private async detail(id: string) {
    const order = await this.db.client.order.findFirst({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const [items, fulfilmentGroups, payment, invoice, ageChecks, audit] = await Promise.all([
      this.db.client.orderItem.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.client.orderFulfilmentGroup.findMany({ where: { orderId: id } }),
      this.db.client.payment.findFirst({ where: { orderId: id } }),
      this.db.client.invoice.findFirst({ where: { orderId: id } }),
      this.db.client.deliveryAgeCheck.findMany({
        where: { orderId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.db.client.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } }),
    ]);
    const productIds = [...new Set(items.map((item) => item.productId))];
    const productImages = await this.db.client.productImage.findMany({
      where: { productId: { in: productIds } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const imageByProduct = new Map<string, string>();
    productImages.forEach((image) => {
      if (!imageByProduct.has(image.productId) && /^https?:\/\//.test(image.url))
        imageByProduct.set(image.productId, image.url);
    });
    const storefrontItems = items.map((item) => ({
      ...item,
      imageUrl: imageByProduct.get(item.productId) ?? null,
    }));
    return {
      ...order,
      displayOrderNumber: this.orderNumber(order.orderNumber, order.orderNumberYear),
      sections: {
        grocery: storefrontItems.filter((item) => item.orderCategory === 'GROCERY'),
        alcohol: storefrontItems.filter((item) => item.orderCategory === 'ALCOHOL'),
      },
      fulfilmentGroups,
      payment,
      invoice: invoice
        ? {
            ...invoice,
            displayInvoiceNumber: this.invoiceNumber(
              invoice.invoiceNumber,
              invoice.invoiceNumberYear,
            ),
          }
        : null,
      deliveryAgeChecks: ageChecks,
      audit,
    };
  }

  private async summary(order: {
    id: string;
    orderNumber: bigint;
    orderNumberYear: number;
    createdAt: Date;
    basketType: string;
    totalMinor: bigint;
    currency: string;
    paymentStatus: string;
    fulfilmentStatus: string;
    ageVerificationStatus: string;
    deliveryAgeCheckStatus: string;
  }) {
    const counts = await this.db.client.orderItem.groupBy({
      by: ['orderCategory'],
      where: { orderId: order.id },
      _sum: { quantity: true },
    });
    const count = (category: 'GROCERY' | 'ALCOHOL') =>
      counts.find((entry) => entry.orderCategory === category)?._sum.quantity ?? 0;
    return {
      ...order,
      displayOrderNumber: this.orderNumber(order.orderNumber, order.orderNumberYear),
      label: `Grocery (${String(count('GROCERY'))}) · Alcohol (${String(count('ALCOHOL'))})`,
    };
  }

  private deriveStatus(statuses: FulfilmentStatus[]): FulfilmentStatus {
    if (statuses.includes('REFUSED')) return 'REFUSED';
    if (statuses.every((status) => status === 'CANCELLED')) return 'CANCELLED';
    return (
      statuses
        .filter((status) => status !== 'CANCELLED')
        .sort((left, right) => progress.indexOf(left) - progress.indexOf(right))[0] ?? 'CANCELLED'
    );
  }

  private orderNumber(value: bigint, year: number): string {
    return `ORD-${String(year)}-${value.toString().padStart(6, '0')}`;
  }

  private invoiceNumber(value: bigint, year: number): string {
    return `INV-${String(year)}-${value.toString().padStart(6, '0')}`;
  }

  private userId(): string {
    const userId = TenantContext.get()?.userId;
    if (!userId) throw new NotFoundException('Authenticated user not found');
    return userId;
  }
}
