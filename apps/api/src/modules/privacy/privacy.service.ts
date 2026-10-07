import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { renderTextPdf } from '../orders/invoice.renderer';
import { consentUpdateSchema, privacyReviewSchema } from './privacy.schemas';

const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item: unknown) => typeof item === 'bigint' ? item.toString() : item)) as Prisma.InputJsonValue;

@Injectable()
export class PrivacyService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  private userId() { const id = TenantContext.get()?.userId; if (!id) throw new BadRequestException('Authenticated user is required'); return id; }

  async consents() {
    const rows = await this.db.client.privacyConsent.findMany({ where: { userId: this.userId() }, orderBy: { createdAt: 'desc' } });
    const current = new Map<string, (typeof rows)[number]>();
    for (const row of rows) if (!current.has(row.category)) current.set(row.category, row);
    return { current: [...current.values()], history: rows };
  }

  async updateConsents(raw: unknown) {
    const input = consentUpdateSchema.parse(raw); const userId = this.userId(); const tenantId = TenantContext.requireTenantId();
    await this.db.client.privacyConsent.createMany({ data: input.consents.map((consent) => ({ tenantId, userId, category: consent.category, granted: consent.category === 'ESSENTIAL' ? true : consent.granted, version: input.version, source: input.source })) });
    await this.audit('PRIVACY_CONSENT_UPDATED', 'User', userId, { categories: input.consents.map((item) => item.category) });
    return this.consents();
  }

  async createExportRequest() {
    const userId = this.userId(); const tenantId = TenantContext.requireTenantId();
    const request = await this.db.client.privacyRequest.create({ data: { tenantId, userId, type: 'EXPORT', status: 'IN_REVIEW', deadlineAt: new Date(Date.now() + 30 * 86400000) } });
    const result = await this.exportData(userId);
    const completed = await this.db.client.privacyRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', result: jsonSafe(result), completedAt: new Date() } });
    await this.audit('DSAR_EXPORT_COMPLETED', 'PrivacyRequest', request.id, { userId });
    return completed;
  }

  async createErasureRequest() {
    const userId = this.userId(); const tenantId = TenantContext.requireTenantId();
    const existing = await this.db.client.privacyRequest.findFirst({ where: { userId, type: 'ERASURE', status: { in: ['PENDING', 'IN_REVIEW'] } } });
    if (existing) return existing;
    const request = await this.db.client.privacyRequest.create({ data: { tenantId, userId, type: 'ERASURE', deadlineAt: new Date(Date.now() + 30 * 86400000) } });
    await this.audit('ERASURE_REQUESTED', 'PrivacyRequest', request.id, { userId });
    return request;
  }

  requests() { return this.db.client.privacyRequest.findMany({ where: { userId: this.userId() }, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, status: true, deadlineAt: true, adminNote: true, completedAt: true, createdAt: true } }); }

  async exportFile(id: string, format: 'json' | 'pdf') {
    const request = await this.db.client.privacyRequest.findFirst({ where: { id, userId: this.userId(), type: 'EXPORT', status: 'COMPLETED' } });
    if (!request?.result) throw new NotFoundException('Completed export not found');
    if (format === 'json') return { contentType: 'application/json', extension: 'json', body: Buffer.from(JSON.stringify(request.result, null, 2)) };
    const payload = request.result as Record<string, unknown>;
    return { contentType: 'application/pdf', extension: 'pdf', body: renderTextPdf(['DENES COMMERCE DATA EXPORT', `REQUEST ${request.id}`, `GENERATED ${request.completedAt?.toISOString() ?? new Date().toISOString()}`, ...JSON.stringify(payload, null, 2).split('\n').slice(0, 55)]) };
  }

  adminRequests(status?: string) { return this.db.client.privacyRequest.findMany({ where: status ? { status } : {}, orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'asc' }], take: 200 }); }

  async review(id: string, raw: unknown) {
    const input = privacyReviewSchema.parse(raw); const request = await this.db.client.privacyRequest.findFirst({ where: { id } });
    if (!request) throw new NotFoundException('Privacy request not found');
    if (request.status === 'COMPLETED' || request.status === 'REJECTED') throw new BadRequestException('Privacy request is already closed');
    if (input.status === 'COMPLETED' && request.type === 'ERASURE') await this.anonymise(request.userId, request.id);
    const now = new Date();
    const updated = await this.db.client.privacyRequest.update({ where: { id }, data: { status: input.status, adminNote: input.adminNote ?? null, reviewedById: TenantContext.get()?.userId ?? null, reviewedAt: now, ...(input.status === 'COMPLETED' ? { completedAt: now } : {}) } });
    await this.audit(`PRIVACY_REQUEST_${input.status}`, 'PrivacyRequest', id, { type: request.type, userId: request.userId });
    return updated;
  }

  private async exportData(userId: string) {
    const [profile, addresses, orders, reviews, consents, notifications] = await Promise.all([
      this.db.client.user.findFirst({ where: { id: userId }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, updatedAt: true } }),
      this.db.client.address.findMany({ where: { userId } }), this.db.client.order.findMany({ where: { userId } }), this.db.client.review.findMany({ where: { userId } }), this.db.client.privacyConsent.findMany({ where: { userId } }), this.db.client.notificationDelivery.findMany({ where: { userId }, select: { event: true, channel: true, status: true, createdAt: true } }),
    ]);
    return { exportedAt: new Date(), profile, addresses, orders, reviews, consents, notifications };
  }

  private async anonymise(userId: string, requestId: string) {
    const tenantId = TenantContext.requireTenantId(); const marker = createHash('sha256').update(`${tenantId}:${userId}`).digest('hex').slice(0, 16); const redacted = `REDACTED-${marker}`;
    await this.db.transaction(async (tx) => {
      await tx.address.deleteMany({ where: { tenantId, userId } });
      const wishlists = await tx.wishlist.findMany({ where: { tenantId, userId }, select: { id: true } });
      await tx.wishlistItem.deleteMany({ where: { tenantId, wishlistId: { in: wishlists.map((item) => item.id) } } });
      await tx.wishlist.deleteMany({ where: { tenantId, userId } });
      await tx.pushSubscription.deleteMany({ where: { tenantId, userId } });
      await tx.notificationPreference.deleteMany({ where: { tenantId, userId } });
      await tx.refreshToken.deleteMany({ where: { tenantId, userId } });
      await tx.authToken.deleteMany({ where: { tenantId, userId } });
      await tx.review.deleteMany({ where: { tenantId, userId } });
      await tx.ageVerification.updateMany({ where: { tenantId, userId }, data: { declaredDateOfBirth: null, providerRef: redacted } });
      await tx.notificationDelivery.updateMany({ where: { tenantId, userId }, data: { recipient: redacted, payload: { redacted: true } } });
      await tx.order.updateMany({ where: { tenantId, userId }, data: { customerSnapshot: { name: redacted, email: `${redacted.toLowerCase()}@invalid.test`, retainedFor: 'legal-accounting' }, deliveryAddress: { redacted: true, retainedFor: 'legal-accounting' } } });
      await tx.user.update({ where: { id: userId, tenantId }, data: { email: `${redacted.toLowerCase()}@invalid.test`, firstName: redacted, lastName: 'REDACTED', phone: null, passwordHash: `disabled-${randomBytes(32).toString('hex')}`, active: false, tombstonedAt: new Date() } });
      await tx.auditLog.create({ data: { tenantId, actorId: TenantContext.get()?.userId ?? null, actorType: 'USER', action: 'USER_ANONYMISED', entity: 'User', entityId: userId, after: { marker, requestId, retained: ['orders','invoices','payments','age-verification-audit'] }, requestId: TenantContext.get()?.requestId ?? randomUUID() } });
    });
  }

  private audit(action: string, entity: string, entityId: string, after: Prisma.InputJsonValue) { return this.db.client.auditLog.create({ data: { tenantId: TenantContext.requireTenantId(), actorId: TenantContext.get()?.userId ?? null, actorType: 'USER', action, entity, entityId, after, requestId: TenantContext.get()?.requestId ?? randomUUID() } }); }
}
