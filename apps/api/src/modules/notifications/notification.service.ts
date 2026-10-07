import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import {
  NOTIFICATION_PROVIDERS,
  NotificationChannel,
  NotificationProvider,
} from './notification.providers';
import {
  preferenceSchema,
  previewSchema,
  pushSubscriptionSchema,
  templateSchema,
  testSendSchema,
} from './notification.schemas';
import { renderTemplate } from './template.renderer';
import { renderInvoicePdf } from '../orders/invoice.renderer';

const topicEvents: Record<string, string> = {
  'order.placed': 'ORDER_PLACED',
  'payment.succeeded': 'PAYMENT_SUCCEEDED',
  'notification.payment-failed': 'PAYMENT_FAILED',
  'notification.order-confirmed': 'ORDER_CONFIRMED',
  'notification.final-amount': 'FINAL_AMOUNT_CAPTURED',
  'notification.substitutions-proposed': 'SUBSTITUTIONS_PROPOSED',
  'notification.age-verification-failed': 'AGE_VERIFICATION_FAILED',
  'refund.initiated': 'REFUND_INITIATED',
  'refund.completed': 'REFUND_COMPLETED',
  'return.approved': 'RETURN_APPROVED',
  'return.rejected': 'RETURN_REJECTED',
  'auth.password-reset': 'PASSWORD_RESET',
  'auth.otp': 'OTP',
  'inventory.low-stock': 'LOW_STOCK',
  'admin.new-order': 'NEW_ORDER',
};

const fallback: Record<string, { subject: string; body: string }> = {
  ORDER_PLACED: { subject: 'Order received', body: 'We have received order {{orderNumber}}.' },
  PAYMENT_SUCCEEDED: {
    subject: 'Payment succeeded',
    body: 'Payment for {{orderNumber}} succeeded.',
  },
  PAYMENT_FAILED: { subject: 'Payment failed', body: 'We could not complete your payment.' },
  ORDER_CONFIRMED: {
    subject: 'Order {{orderNumber}} confirmed',
    body: 'Order {{orderNumber}} confirmed\n\nGROCERY ITEMS\n{{grocerySection}}\n\nALCOHOL ITEMS (18+)\n{{alcoholSection}}\n\nDelivery: {{delivery}}\nTotal: {{total}}\n{{challenge25Notice}}\n\nYour VAT invoice is attached.',
  },
  PICKING_STARTED: {
    subject: 'Picking started',
    body: 'We have started picking order {{orderNumber}}.',
  },
  SUBSTITUTIONS_PROPOSED: {
    subject: 'Substitutions proposed',
    body: 'Substitutions are ready for {{orderNumber}}.',
  },
  FINAL_AMOUNT_CAPTURED: {
    subject: 'Final amount captured',
    body: 'The final total for {{orderNumber}} is {{total}}.',
  },
  DISPATCHED: { subject: 'Order dispatched', body: 'Order {{orderNumber}} has been dispatched.' },
  OUT_FOR_DELIVERY: {
    subject: 'Out for delivery',
    body: 'Order {{orderNumber}} is out for delivery.',
  },
  DELIVERED: { subject: 'Order delivered', body: 'Order {{orderNumber}} has been delivered.' },
  DELIVERY_FAILED: {
    subject: 'Delivery failed',
    body: 'Delivery of {{orderNumber}} was unsuccessful.',
  },
  AGE_VERIFICATION_FAILED: {
    subject: 'Age verification failed',
    body: 'Age verification was unsuccessful.',
  },
  DELIVERY_AGE_CHECK_REFUSED: {
    subject: 'Delivery refused',
    body: 'The age check for {{orderNumber}} was refused.',
  },
  REFUND_INITIATED: {
    subject: 'Refund initiated',
    body: 'Your refund for {{orderNumber}} has started.',
  },
  REFUND_COMPLETED: {
    subject: 'Refund completed',
    body: 'Your refund for {{orderNumber}} is complete.',
  },
  RETURN_APPROVED: { subject: 'Return approved', body: 'Your return has been approved.' },
  RETURN_REJECTED: { subject: 'Return rejected', body: 'Your return was not approved.' },
  PASSWORD_RESET: {
    subject: 'Reset your password',
    body: 'Use this link to reset your password: {{resetUrl}}',
  },
  OTP: { subject: 'Your verification code', body: 'Your verification code is {{code}}.' },
  LOW_STOCK: {
    subject: 'Low stock alert',
    body: 'Inventory {{inventoryId}} is low ({{available}} remaining).',
  },
  NEW_ORDER: { subject: 'New order', body: 'A new order {{orderNumber}} has been placed.' },
};

@Injectable()
export class NotificationService {
  private readonly providers: Map<NotificationChannel, NotificationProvider>;

  constructor(
    private readonly db: TenantScopedPrismaService,
    @Inject(NOTIFICATION_PROVIDERS) providers: NotificationProvider[],
  ) {
    this.providers = new Map(providers.map((provider) => [provider.channel, provider]));
  }

  listTemplates() {
    return this.db.client.notificationTemplate.findMany({
      orderBy: [{ event: 'asc' }, { channel: 'asc' }, { version: 'desc' }],
    });
  }

  async createTemplate(raw: unknown) {
    const input = templateSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const latest = await tx.notificationTemplate.findFirst({
        where: { tenantId, event: input.event, channel: input.channel, locale: input.locale },
        orderBy: { version: 'desc' },
      });
      await tx.notificationTemplate.updateMany({
        where: {
          tenantId,
          event: input.event,
          channel: input.channel,
          locale: input.locale,
          active: true,
        },
        data: { active: false },
      });
      return tx.notificationTemplate.create({
        data: {
          tenantId,
          ...input,
          subject: input.subject ?? null,
          mjml: input.mjml ?? null,
          version: (latest?.version ?? 0) + 1,
          createdById: TenantContext.get()?.userId ?? null,
        },
      });
    });
  }

  async replaceTemplate(id: string, raw: unknown) {
    const current = await this.db.client.notificationTemplate.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Notification template not found');
    const update = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return this.createTemplate({
      event: current.event,
      channel: current.channel,
      locale: current.locale,
      subject: current.subject,
      body: current.body,
      mjml: current.mjml,
      ...update,
    });
  }

  preview(raw: unknown) {
    const input = previewSchema.parse(raw);
    return {
      subject: renderTemplate(input.subject, input.data),
      body: renderTemplate(input.body, input.data),
    };
  }

  async testSend(templateId: string, raw: unknown) {
    const input = testSendSchema.parse(raw);
    const template = await this.db.client.notificationTemplate.findFirst({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Notification template not found');
    return this.db.client.notificationDelivery.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        event: `TEST:${template.event}`,
        channel: template.channel,
        recipient: input.recipient,
        templateId,
        subject: renderTemplate(template.subject, input.data),
        body: renderTemplate(template.body, input.data),
        payload: input.data as Prisma.InputJsonValue,
      },
    });
  }

  async preferences() {
    const userId = this.userId();
    const existing = await this.db.client.notificationPreference.findFirst({ where: { userId } });
    return (
      existing ?? {
        userId,
        transactionalEmail: true,
        transactionalSms: true,
        transactionalPush: true,
        marketingEmail: false,
        marketingSms: false,
        marketingPush: false,
      }
    );
  }

  async updatePreferences(raw: unknown) {
    const input = preferenceSchema.parse(raw);
    const userId = this.userId();
    const existing = await this.db.client.notificationPreference.findFirst({ where: { userId } });
    const data = {
      ...(input.transactionalEmail !== undefined
        ? { transactionalEmail: input.transactionalEmail }
        : {}),
      ...(input.transactionalSms !== undefined ? { transactionalSms: input.transactionalSms } : {}),
      ...(input.transactionalPush !== undefined
        ? { transactionalPush: input.transactionalPush }
        : {}),
      ...(input.marketingEmail !== undefined ? { marketingEmail: input.marketingEmail } : {}),
      ...(input.marketingSms !== undefined ? { marketingSms: input.marketingSms } : {}),
      ...(input.marketingPush !== undefined ? { marketingPush: input.marketingPush } : {}),
      ...(input.consentVersion !== undefined ? { consentVersion: input.consentVersion } : {}),
      ...(input.marketingEmail || input.marketingSms || input.marketingPush
        ? { consentedAt: new Date() }
        : {}),
    };
    if (existing)
      return this.db.client.notificationPreference.update({ where: { id: existing.id }, data });
    return this.db.client.notificationPreference.create({
      data: { tenantId: TenantContext.requireTenantId(), userId, ...data },
    });
  }

  listDevices() {
    return this.db.client.pushSubscription.findMany({ where: { userId: this.userId() } });
  }

  async addDevice(raw: unknown) {
    const input = pushSubscriptionSchema.parse(raw);
    const current = await this.db.client.pushSubscription.findFirst({
      where: { endpoint: input.endpoint },
    });
    if (current)
      return this.db.client.pushSubscription.update({
        where: { id: current.id },
        data: { userId: this.userId(), keys: input.keys },
      });
    return this.db.client.pushSubscription.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        userId: this.userId(),
        endpoint: input.endpoint,
        keys: input.keys as Prisma.InputJsonValue,
      },
    });
  }

  async removeDevice(id: string) {
    const device = await this.db.client.pushSubscription.findFirst({
      where: { id, userId: this.userId() },
    });
    if (!device) throw new NotFoundException('Push subscription not found');
    await this.db.client.pushSubscription.delete({ where: { id } });
    return { deleted: true };
  }

  deliveryLog(status?: string) {
    return this.db.client.notificationDelivery.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  customerNotifications() {
    return this.db.client.notificationDelivery.findMany({
      where: { userId: this.userId() },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async process(limit = 100) {
    const fanOut = await this.fanOutEvents(limit);
    const delivered = await this.deliver(limit);
    return { fanOut, delivered };
  }

  async fanOutEvents(limit = 100): Promise<number> {
    const topics = [
      ...Object.keys(topicEvents),
      'order.fulfilment-status-changed',
      'notification.delivery-age-check',
    ];
    const messages = await this.db.client.outboxMessage.findMany({
      where: { status: 'PENDING', topic: { in: topics }, availableAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const message of messages) {
      const payload = message.payload as Record<string, unknown>;
      const event = this.eventFor(message.topic, payload);
      if (event) await this.createDeliveries(message.id, event, payload);
      await this.db.client.outboxMessage.update({
        where: { id: message.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }
    return messages.length;
  }

  async deliver(limit = 100): Promise<number> {
    const jobs = await this.db.client.notificationDelivery.findMany({
      where: { status: 'QUEUED', availableAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const job of jobs) {
      await this.db.client.notificationDelivery.update({
        where: { id: job.id },
        data: { status: 'PROCESSING' },
      });
      try {
        const provider = this.providers.get(job.channel as NotificationChannel);
        if (!provider) throw new Error(`No ${job.channel} notification provider is configured`);
        const attachments = job.channel === 'EMAIL' && job.event === 'ORDER_CONFIRMED'
          ? await this.invoiceAttachments(job.payload as Record<string, unknown>)
          : undefined;
        const result = await provider.send({
          recipient: job.recipient,
          subject: job.subject,
          body: job.body,
          data: job.payload as Record<string, unknown>,
          ...(attachments?.length ? { attachments } : {}),
        });
        await this.db.client.notificationDelivery.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            attempts: { increment: 1 },
            providerMessageId: result.messageId,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        const attempts = job.attempts + 1;
        await this.db.client.notificationDelivery.update({
          where: { id: job.id },
          data: {
            status: attempts >= job.maxAttempts ? 'DEAD_LETTER' : 'QUEUED',
            attempts,
            lastError:
              error instanceof Error ? error.message.slice(0, 2000) : 'Unknown provider error',
            availableAt: new Date(Date.now() + Math.min(3_600_000, 1000 * 2 ** attempts)),
          },
        });
      }
    }
    return jobs.length;
  }

  private eventFor(topic: string, payload: Record<string, unknown>): string | undefined {
    if (topic === 'order.fulfilment-status-changed') {
      const status = String(payload.status ?? '');
      return {
        PICKING: 'PICKING_STARTED',
        OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
        DELIVERED: 'DELIVERED',
        REFUSED: 'DELIVERY_FAILED',
      }[status];
    }
    if (topic === 'notification.delivery-age-check')
      return payload.outcome === 'REFUSED'
        ? 'DELIVERY_AGE_CHECK_REFUSED'
        : payload.outcome === 'FAILED'
          ? 'AGE_VERIFICATION_FAILED'
          : undefined;
    return topicEvents[topic];
  }

  private async createDeliveries(
    sourceMessageId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const context = await this.context(event, payload);
    if (!context) return;
    const templates = await this.db.client.notificationTemplate.findMany({
      where: { event, locale: context.locale, active: true },
      orderBy: { version: 'desc' },
    });
    const active = templates.filter(
      (template, index) =>
        templates.findIndex((other) => other.channel === template.channel) === index,
    );
    const candidates = active.length
      ? active
      : [
          {
            id: null,
            channel: 'EMAIL',
            subject: fallback[event]?.subject ?? event,
            body: fallback[event]?.body ?? event,
          },
        ];
    for (const template of candidates) {
      const channel = template.channel as NotificationChannel;
      const recipient = this.recipient(channel, context);
      if (!recipient) continue;
      const marketing = event.startsWith('MARKETING_');
      if (marketing && !(await this.marketingAllowed(context.userId, channel))) {
        await this.createDelivery({
          sourceMessageId,
          userId: context.userId,
          templateId: template.id,
          event,
          channel,
          recipient,
          transactional: false,
          status: 'BLOCKED',
          subject: template.subject,
          body: template.body,
          payload: context.data,
          error: 'Marketing consent not granted',
        });
        continue;
      }
      await this.createDelivery({
        sourceMessageId,
        userId: context.userId,
        templateId: template.id,
        event,
        channel,
        recipient,
        transactional: !marketing,
        status: 'QUEUED',
        subject: template.subject,
        body: template.body,
        payload: context.data,
      });
    }
  }

  private async createDelivery(input: {
    sourceMessageId: string;
    userId: string | null;
    templateId: string | null;
    event: string;
    channel: NotificationChannel;
    recipient: string;
    transactional: boolean;
    status: string;
    subject?: string | null;
    body: string;
    payload: Record<string, unknown>;
    error?: string;
  }) {
    const existing = await this.db.client.notificationDelivery.findFirst({
      where: {
        sourceMessageId: input.sourceMessageId,
        channel: input.channel,
        recipient: input.recipient,
      },
    });
    if (existing) return existing;
    return this.db.client.notificationDelivery.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        sourceMessageId: input.sourceMessageId,
        userId: input.userId,
        templateId: input.templateId,
        event: input.event,
        channel: input.channel,
        recipient: input.recipient,
        transactional: input.transactional,
        status: input.status,
        subject: renderTemplate(input.subject, input.payload),
        body: renderTemplate(input.body, input.payload),
        payload: input.payload as Prisma.InputJsonValue,
        ...(input.error ? { lastError: input.error } : {}),
      },
    });
  }

  private async context(event: string, payload: Record<string, unknown>) {
    let orderId = typeof payload.orderId === 'string' ? payload.orderId : undefined;
    if (!orderId && typeof payload.returnRequestId === 'string') {
      const request = await this.db.client.returnRequest.findFirst({
        where: { id: payload.returnRequestId },
      });
      orderId = request?.orderId;
    }
    const adminEvent = event === 'LOW_STOCK' || event === 'NEW_ORDER';
    if (!orderId) {
      const user = adminEvent
        ? await this.db.client.user.findFirst({
            where: { role: { in: ['SUPER_ADMIN', 'ADMINISTRATOR', 'STORE_MANAGER'] }, active: true },
            orderBy: { createdAt: 'asc' },
          })
        : undefined;
      if (!user && !adminEvent) return null;
      return {
        userId: user?.id ?? null,
        email: user?.email,
        phone: user?.phone,
        locale: 'en-GB',
        pushEndpoints: [] as string[],
        data: payload,
      };
    }
    const order = await this.db.client.order.findFirst({ where: { id: orderId } });
    if (!order) return null;
    const [user, lines, devices] = await Promise.all([
      order.userId ? this.db.client.user.findFirst({ where: { id: order.userId } }) : null,
      this.db.client.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
      order.userId
        ? this.db.client.pushSubscription.findMany({ where: { userId: order.userId } })
        : [],
    ]);
    const snapshot = order.customerSnapshot as Record<string, unknown>;
    const grocery =
      lines
        .filter((line) => line.orderCategory === 'GROCERY')
        .map((line) => `${line.quantity} × ${line.productName}`)
        .join('\n') || 'None';
    const alcohol =
      lines
        .filter((line) => line.orderCategory === 'ALCOHOL')
        .map((line) => `${line.quantity} × ${line.productName}`)
        .join('\n') || 'None';
    const address = order.deliveryAddress as Record<string, unknown>;
    return {
      userId: order.userId,
      email: user?.email ?? (typeof snapshot.email === 'string' ? snapshot.email : undefined),
      phone: user?.phone ?? (typeof snapshot.phone === 'string' ? snapshot.phone : undefined),
      locale: 'en-GB',
      pushEndpoints: devices.map((device) => device.endpoint),
      data: {
        ...payload,
        orderId,
        orderNumber: `${order.orderNumberYear}-${order.orderNumber.toString().padStart(6, '0')}`,
        grocerySection: grocery,
        alcoholSection: alcohol,
        delivery: [address.line1, address.city, address.postcode].filter(Boolean).join(', '),
        total: new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: order.currency,
        }).format(Number(order.totalMinor) / 100),
        challenge25Notice: lines.some((line) => line.ageRestriction > 0)
          ? 'Challenge 25: valid photo ID will be required on delivery.'
          : '',
      },
    };
  }

  private recipient(
    channel: NotificationChannel,
    context: {
      email?: string | undefined;
      phone?: string | null | undefined;
      pushEndpoints: string[];
    },
  ) {
    if (channel === 'EMAIL') return context.email;
    if (channel === 'SMS' || channel === 'WHATSAPP') return context.phone;
    return context.pushEndpoints[0];
  }

  private async invoiceAttachments(payload: Record<string, unknown>) {
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    if (!orderId) return [];
    const [order, invoice, lines, merchant] = await Promise.all([
      this.db.client.order.findFirst({ where: { id: orderId } }),
      this.db.client.invoice.findFirst({ where: { orderId } }),
      this.db.client.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } }),
      this.db.client.brandingProfile.findFirst(),
    ]);
    if (!order || !invoice || !merchant) throw new Error('The order invoice could not be prepared for email');
    const deliverySlot = order.deliverySlotId
      ? await this.db.client.deliverySlot.findFirst({ where: { id: order.deliverySlotId } })
      : null;
    const invoiceNumber = `INV-${String(invoice.invoiceNumberYear)}-${invoice.invoiceNumber.toString().padStart(6, '0')}`;
    const pdf = renderInvoicePdf({
      invoiceNumber,
      orderNumber: `${String(order.orderNumberYear)}-${order.orderNumber.toString().padStart(6, '0')}`,
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
    });
    return [{ filename: `${invoiceNumber}.pdf`, content: pdf.toString('base64'), contentType: 'application/pdf' }];
  }

  private async marketingAllowed(userId: string | null, channel: NotificationChannel) {
    if (!userId || channel === 'WHATSAPP') return false;
    const preference = await this.db.client.notificationPreference.findFirst({ where: { userId } });
    if (!preference) return false;
    return channel === 'EMAIL'
      ? preference.marketingEmail
      : channel === 'SMS'
        ? preference.marketingSms
        : preference.marketingPush;
  }

  private userId(): string {
    const id = TenantContext.get()?.userId;
    if (!id) throw new BadRequestException('Authenticated user context is required');
    return id;
  }
}
