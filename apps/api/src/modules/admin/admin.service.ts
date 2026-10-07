import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { PrismaService } from '../../common/database/prisma.service';
import { encryptConfigSecret } from '../../common/security/config-secret';
import { TenantContext } from '../../common/tenancy/tenant-context';
import {
  customerUpdateSchema,
  dateRangeSchema,
  rolePermissionUpdateSchema,
  settingsUpdateSchema,
  userRoleUpdateSchema,
  bannerCreateSchema,
  contentBlockCreateSchema,
  cmsPageUpsertSchema,
  reportFilterSchema,
} from './admin.schemas';

type RangeInput = { from?: string | undefined; to?: string | undefined };

@Injectable()
export class AdminService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly root: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async dashboard(input: RangeInput) {
    const range = this.range(input);
    const [orders, customers, items, refunds, lowStock, couponRedemptions] = await Promise.all([
      this.db.client.order.findMany({ where: { createdAt: range }, select: { userId: true, totalMinor: true, basketType: true } }),
      this.db.client.user.count({ where: { role: 'CUSTOMER', createdAt: range } }),
      this.db.client.orderItem.aggregate({ where: { createdAt: range }, _sum: { quantity: true } }),
      this.db.client.refund.aggregate({ where: { createdAt: range }, _sum: { amountMinor: true }, _count: true }),
      this.db.client.inventory.count({ where: { stockAvailable: { lte: 5 } } }),
      this.db.client.couponRedemption.count({ where: { createdAt: range } }),
    ]);
    const revenue = orders.reduce((sum, order) => sum + order.totalMinor, 0n);
    const customerCounts = new Map<string, number>();
    for (const order of orders) if (order.userId) customerCounts.set(order.userId, (customerCounts.get(order.userId) ?? 0) + 1);
    return {
      range: this.serialiseRange(range),
      orders: orders.length,
      revenueMinor: revenue.toString(),
      averageOrderValueMinor: orders.length ? (revenue / BigInt(orders.length)).toString() : '0',
      newCustomers: customers,
      repeatCustomers: [...customerCounts.values()].filter((count) => count > 1).length,
      unitsSold: items._sum.quantity ?? 0,
      lowStock,
      refunds: refunds._count,
      refundAmountMinor: (refunds._sum.amountMinor ?? 0n).toString(),
      couponUsage: couponRedemptions,
      basketSplit: {
        grocery: orders.filter((order) => order.basketType === 'GROCERY').length,
        alcohol: orders.filter((order) => order.basketType === 'ALCOHOL').length,
        mixed: orders.filter((order) => order.basketType === 'MIXED').length,
      },
    };
  }

  async salesReport(input: Record<string, string | undefined>) {
    const scope = await this.reportScope(input);
    const lineGroups = await this.db.client.orderItem.groupBy({
      by: ['orderCategory'],
      where: this.reportLineWhere(scope),
      _sum: { lineTotalMinor: true, quantity: true },
    });
    const byCategory = Object.fromEntries(lineGroups.map((row) => [row.orderCategory.toLowerCase(), {
      revenueMinor: (row._sum.lineTotalMinor ?? 0n).toString(),
      units: row._sum.quantity ?? 0,
    }]));
    return {
      range: this.serialiseRange(scope.range),
      orders: scope.orders.length,
      totalRevenueMinor: scope.productIds
        ? (BigInt(byCategory.grocery?.revenueMinor ?? '0') + BigInt(byCategory.alcohol?.revenueMinor ?? '0')).toString()
        : scope.orders.reduce((sum, order) => sum + order.totalMinor, 0n).toString(),
      groceryRevenueMinor: byCategory.grocery?.revenueMinor ?? '0',
      alcoholRevenueMinor: byCategory.alcohol?.revenueMinor ?? '0',
      units: { grocery: byCategory.grocery?.units ?? 0, alcohol: byCategory.alcohol?.units ?? 0 },
      basketCounts: {
        grocery: scope.orders.filter((order) => order.basketType === 'GROCERY').length,
        alcohol: scope.orders.filter((order) => order.basketType === 'ALCOHOL').length,
        mixed: scope.orders.filter((order) => order.basketType === 'MIXED').length,
      },
    };
  }

  async customerReport(input: Record<string, string | undefined>) {
    const scope = await this.reportScope(input);
    const totals = new Map<string, { orders: number; spendMinor: bigint }>();
    for (const order of scope.orders) {
      if (!order.userId) continue;
      const current = totals.get(order.userId) ?? { orders: 0, spendMinor: 0n };
      current.orders += 1;
      current.spendMinor += order.totalMinor;
      totals.set(order.userId, current);
    }
    const users = await this.db.client.user.findMany({
      where: { id: { in: [...totals.keys()] } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));
    const rows = [...totals.entries()].sort((a, b) => Number(b[1].spendMinor - a[1].spendMinor));
    return {
      range: this.serialiseRange(scope.range),
      customers: rows.length,
      repeatCustomers: rows.filter(([, row]) => row.orders > 1).length,
      topCustomers: rows.slice(0, 100).map(([userId, row]) => ({
        userId,
        email: userById.get(userId)?.email ?? null,
        name: userById.has(userId)
          ? `${userById.get(userId)?.firstName ?? ''} ${userById.get(userId)?.lastName ?? ''}`.trim()
          : null,
        orders: row.orders,
        spendMinor: row.spendMinor.toString(),
      })),
    };
  }

  async productReport(input: Record<string, string | undefined>) {
    const scope = await this.reportScope(input);
    const rows = await this.db.client.orderItem.groupBy({ by: ['productId', 'productName', 'sku'], where: this.reportLineWhere(scope), _sum: { quantity: true, lineTotalMinor: true }, orderBy: { _sum: { lineTotalMinor: 'desc' } }, take: 100 });
    return rows.map((row) => ({ productId: row.productId, name: row.productName, sku: row.sku, units: row._sum.quantity ?? 0, revenueMinor: (row._sum.lineTotalMinor ?? 0n).toString() }));
  }

  async categoryReport(input: Record<string, string | undefined>) {
    const scope = await this.reportScope(input);
    const lines = await this.db.client.orderItem.findMany({ where: this.reportLineWhere(scope), select: { productId: true, quantity: true, lineTotalMinor: true } });
    const products = await this.db.client.product.findMany({ where: { id: { in: [...new Set(lines.map((line) => line.productId))] } }, select: { id: true, categoryId: true } });
    const categories = await this.db.client.category.findMany({ where: { id: { in: [...new Set(products.map((product) => product.categoryId))] } }, select: { id: true, name: true } });
    const productCategory = new Map(products.map((product) => [product.id, product.categoryId]));
    const totals = new Map<string, { units: number; revenueMinor: bigint }>();
    for (const line of lines) {
      const categoryId = productCategory.get(line.productId);
      if (!categoryId) continue;
      const current = totals.get(categoryId) ?? { units: 0, revenueMinor: 0n };
      current.units += line.quantity;
      current.revenueMinor += line.lineTotalMinor;
      totals.set(categoryId, current);
    }
    return categories.map((category) => ({ categoryId: category.id, name: category.name, units: totals.get(category.id)?.units ?? 0, revenueMinor: (totals.get(category.id)?.revenueMinor ?? 0n).toString() })).sort((a, b) => Number(BigInt(b.revenueMinor) - BigInt(a.revenueMinor)));
  }

  async couponReport(input: Record<string, string | undefined>) {
    const scope = await this.reportScope(input);
    const rows = await this.db.client.couponRedemption.groupBy({
      by: ['couponId'],
      where: {
        createdAt: scope.range,
        orderId: { in: scope.orderIds },
        ...(scope.filters.couponId ? { couponId: scope.filters.couponId } : {}),
      },
      _count: true,
      _sum: { discountMinor: true },
    });
    const coupons = await this.db.client.coupon.findMany({ where: { id: { in: rows.map((row) => row.couponId) } }, select: { id: true, code: true } });
    const codes = new Map(coupons.map((coupon) => [coupon.id, coupon.code]));
    return rows.map((row) => ({ couponId: row.couponId, code: codes.get(row.couponId) ?? 'Unknown', uses: row._count, discountMinor: (row._sum.discountMinor ?? 0n).toString() }));
  }

  async customers(query?: string) {
    const users = await this.db.client.user.findMany({
      where: { role: 'CUSTOMER', ...(query ? { OR: [{ email: { contains: query, mode: 'insensitive' } }, { firstName: { contains: query, mode: 'insensitive' } }, { lastName: { contains: query, mode: 'insensitive' } }] } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, active: true, tombstonedAt: true, createdAt: true },
    });
    const aggregates = await this.db.client.order.groupBy({ by: ['userId'], where: { userId: { in: users.map((user) => user.id) } }, _count: true, _sum: { totalMinor: true } });
    const stats = new Map(aggregates.map((row) => [row.userId, row]));
    return users.map((user) => ({ ...user, orderCount: stats.get(user.id)?._count ?? 0, spendMinor: (stats.get(user.id)?._sum.totalMinor ?? 0n).toString() }));
  }

  async customer(id: string) {
    const user = await this.db.client.user.findFirst({ where: { id, role: 'CUSTOMER' }, select: { id: true, email: true, firstName: true, lastName: true, phone: true, active: true, tombstonedAt: true, createdAt: true, updatedAt: true } });
    if (!user) throw new NotFoundException('Customer not found');
    const [addresses, orders, reviews] = await Promise.all([
      this.db.client.address.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
      this.db.client.order.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, orderNumber: true, orderNumberYear: true, totalMinor: true, paymentStatus: true, fulfilmentStatus: true, createdAt: true } }),
      this.db.client.review.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { ...user, addresses, orders, reviews };
  }

  async updateCustomer(id: string, body: unknown) {
    const data = customerUpdateSchema.parse(body);
    const existing = await this.db.client.user.findFirst({ where: { id, role: 'CUSTOMER' } });
    if (!existing) throw new NotFoundException('Customer not found');
    const updateData = {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    };
    const updated = await this.db.client.user.update({ where: { id }, data: updateData, select: { id: true, email: true, firstName: true, lastName: true, phone: true, active: true, updatedAt: true } });
    await this.audit('CUSTOMER_UPDATED', 'User', id, existing, updated);
    return updated;
  }

  async rbac() {
    const [roles, permissions, assignments, users] = await Promise.all([
      this.db.client.role.findMany({ orderBy: { name: 'asc' } }),
      this.root.permission.findMany({ orderBy: { key: 'asc' } }),
      this.db.client.userRoleAssignment.findMany(),
      this.db.client.user.findMany({ where: { role: { not: 'CUSTOMER' } }, select: { id: true, email: true, firstName: true, lastName: true, active: true }, orderBy: { email: 'asc' } }),
    ]);
    const mappings = await this.db.client.rolePermission.findMany();
    return {
      permissions,
      roles: roles.map((role) => ({ ...role, permissionKeys: mappings.filter((mapping) => mapping.roleId === role.id).map((mapping) => permissions.find((permission) => permission.id === mapping.permissionId)?.key).filter(Boolean) })),
      assignments,
      users,
    };
  }

  inventory() { return this.db.client.inventory.findMany({ orderBy: [{ stockAvailable: 'asc' }, { updatedAt: 'desc' }], take: 250 }); }
  reviews(status?: string) { return this.db.client.review.findMany({ where: status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}, orderBy: { createdAt: 'desc' }, take: 200 }); }
  promotions() { return this.db.client.promotion.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }); }
  async content() {
    const [banners, blocks, pages] = await Promise.all([
      this.db.client.banner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] }),
      this.db.client.cmsContentBlock.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'desc' }] }),
      this.db.client.cmsPage.findMany({ orderBy: [{ type: 'asc' }, { locale: 'asc' }] }),
    ]);
    return { banners, blocks, pages };
  }

  async createBanner(body: unknown) {
    const input = bannerCreateSchema.parse(body);
    const created = await this.db.client.banner.create({ data: { tenantId: TenantContext.requireTenantId(), ...input, subtitle: input.subtitle ?? null, mobileImageUrl: input.mobileImageUrl ?? null, linkUrl: input.linkUrl ?? null, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null } });
    await this.audit('BANNER_CREATED', 'Banner', created.id, undefined, created);
    return created;
  }

  async updateBanner(id: string, body: unknown) {
    const input = bannerCreateSchema.partial().parse(body);
    const existing = await this.db.client.banner.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.BannerUncheckedUpdateInput;
    const updated = await this.db.client.banner.update({ where: { id }, data });
    await this.audit('BANNER_UPDATED', 'Banner', id, existing, updated);
    return updated;
  }

  async createContentBlock(body: unknown) {
    const input = contentBlockCreateSchema.parse(body);
    const created = await this.db.client.cmsContentBlock.create({ data: { tenantId: TenantContext.requireTenantId(), ...input, content: input.content as Prisma.InputJsonValue, title: input.title ?? null, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null } });
    await this.audit('CONTENT_BLOCK_CREATED', 'CmsContentBlock', created.id, undefined, created);
    return created;
  }

  async upsertCmsPage(body: unknown) {
    const input = cmsPageUpsertSchema.parse(body);
    const tenantId = TenantContext.requireTenantId();
    const page = await this.db.client.cmsPage.upsert({ where: { tenantId_type_locale: { tenantId, type: input.type, locale: input.locale } }, create: { tenantId, ...input }, update: { title: input.title, content: input.content, published: input.published } });
    await this.audit('CMS_PAGE_SAVED', 'CmsPage', page.id, undefined, { type: page.type, locale: page.locale, published: page.published });
    return page;
  }

  async updateRolePermissions(id: string, body: unknown) {
    const { permissionKeys } = rolePermissionUpdateSchema.parse(body);
    const [role, permissions] = await Promise.all([
      this.db.client.role.findFirst({ where: { id } }),
      this.root.permission.findMany({ where: { key: { in: permissionKeys } } }),
    ]);
    if (!role) throw new NotFoundException('Role not found');
    if (permissions.length !== permissionKeys.length) throw new BadRequestException('One or more permissions do not exist');
    await this.db.transaction(async (tx, tenantId) => {
      await tx.rolePermission.deleteMany({ where: { tenantId, roleId: id } });
      await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ tenantId, roleId: id, permissionId: permission.id })) });
    });
    await this.audit('ROLE_PERMISSIONS_UPDATED', 'Role', id, undefined, { permissionKeys });
    return { id, permissionKeys };
  }

  async updateUserRoles(userId: string, body: unknown) {
    const { roleKeys } = userRoleUpdateSchema.parse(body);
    const roles = await this.db.client.role.findMany({ where: { key: { in: roleKeys } } });
    if (roles.length !== roleKeys.length) throw new BadRequestException('One or more roles do not exist');
    await this.db.transaction(async (tx, tenantId) => {
      await tx.userRoleAssignment.deleteMany({ where: { tenantId, userId } });
      await tx.userRoleAssignment.createMany({ data: roles.map((role) => ({ tenantId, userId, roleId: role.id })) });
    });
    await this.audit('USER_ROLES_UPDATED', 'User', userId, undefined, { roleKeys });
    return { userId, roleKeys };
  }

  async settings() {
    const [settings, branding] = await Promise.all([
      this.db.client.tenantSettings.findFirst(),
      this.db.client.brandingProfile.findFirst(),
    ]);
    const stored = this.record(settings?.settings);
    const integrations = this.record(stored.integrations);
    const email = this.record(integrations.email);
    const social = this.record(integrations.socialLogin);
    const { integrations: _hidden, ...businessSettings } = stored;
    return {
      settings: businessSettings,
      settingsVersion: settings?.version ?? 0,
      branding,
      integrations: {
        email: {
          provider: typeof email.provider === 'string' ? email.provider : 'LOG',
          fromName: typeof email.fromName === 'string' ? email.fromName : 'Denes Commerce',
          fromEmail: typeof email.fromEmail === 'string' ? email.fromEmail : '',
          replyTo: typeof email.replyTo === 'string' ? email.replyTo : '',
          smtpHost: typeof email.smtpHost === 'string' ? email.smtpHost : '',
          smtpPort: typeof email.smtpPort === 'number' ? email.smtpPort : 587,
          smtpSecure: email.smtpSecure === true,
          smtpUsername: typeof email.smtpUsername === 'string' ? email.smtpUsername : '',
          smtpPasswordConfigured: typeof email.smtpPassword === 'string' && email.smtpPassword.length > 0,
          resendApiKeyConfigured: typeof email.resendApiKey === 'string' && email.resendApiKey.length > 0,
        },
        socialLogin: {
          googleEnabled: social.googleEnabled === true,
          googleClientId: typeof social.googleClientId === 'string' ? social.googleClientId : '',
          googleClientSecretConfigured:
            typeof social.googleClientSecret === 'string' && social.googleClientSecret.length > 0,
          appleEnabled: social.appleEnabled === true,
          appleClientId: typeof social.appleClientId === 'string' ? social.appleClientId : '',
          appleTeamId: typeof social.appleTeamId === 'string' ? social.appleTeamId : '',
          appleKeyId: typeof social.appleKeyId === 'string' ? social.appleKeyId : '',
          applePrivateKeyConfigured:
            typeof social.applePrivateKey === 'string' && social.applePrivateKey.length > 0,
        },
      },
    };
  }

  async updateSettings(body: unknown) {
    const input = settingsUpdateSchema.parse(body);
    const tenantId = TenantContext.requireTenantId();
    const result = await this.db.transaction(async (tx) => {
      const current = await tx.tenantSettings.findUnique({ where: { tenantId } });
      const currentSettings = this.record(current?.settings);
      if (input.settings) {
        const settings = {
          ...input.settings,
          ...(currentSettings.integrations ? { integrations: currentSettings.integrations } : {}),
        } as Prisma.InputJsonValue;
        await tx.tenantSettings.upsert({ where: { tenantId }, create: { tenantId, settings, version: 1 }, update: { settings, version: { increment: 1 } } });
      }
      if (input.integrations) {
        const existing = this.record(currentSettings.integrations);
        const existingEmail = this.record(existing.email);
        const existingSocial = this.record(existing.socialLogin);
        const email = input.integrations.email;
        if (email.provider === 'SMTP' && (!email.smtpHost || !email.smtpUsername) && !existingEmail.smtpHost)
          throw new BadRequestException('SMTP host and username are required');
        if (email.provider === 'RESEND' && !email.resendApiKey && !existingEmail.resendApiKey)
          throw new BadRequestException('A Resend API key is required');
        const protect = (secret: string) => encryptConfigSecret(secret, this.config.values.JWT_ACCESS_SECRET);
        const integrations = {
          email: {
            provider: email.provider,
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            replyTo: email.replyTo ?? '',
            smtpHost: email.smtpHost ?? '',
            smtpPort: email.smtpPort ?? 587,
            smtpSecure: email.smtpSecure,
            smtpUsername: email.smtpUsername ?? '',
            smtpPassword: email.smtpPassword ? protect(email.smtpPassword) : existingEmail.smtpPassword ?? '',
            resendApiKey: email.resendApiKey ? protect(email.resendApiKey) : existingEmail.resendApiKey ?? '',
          },
          socialLogin: {
            googleEnabled: input.integrations.socialLogin.googleEnabled,
            googleClientId: input.integrations.socialLogin.googleClientId ?? '',
            googleClientSecret: input.integrations.socialLogin.googleClientSecret
              ? protect(input.integrations.socialLogin.googleClientSecret)
              : existingSocial.googleClientSecret ?? '',
            appleEnabled: input.integrations.socialLogin.appleEnabled,
            appleClientId: input.integrations.socialLogin.appleClientId ?? '',
            appleTeamId: input.integrations.socialLogin.appleTeamId ?? '',
            appleKeyId: input.integrations.socialLogin.appleKeyId ?? '',
            applePrivateKey: input.integrations.socialLogin.applePrivateKey
              ? protect(input.integrations.socialLogin.applePrivateKey)
              : existingSocial.applePrivateKey ?? '',
          },
        };
        const settings = { ...currentSettings, integrations } as Prisma.InputJsonValue;
        await tx.tenantSettings.upsert({
          where: { tenantId },
          create: { tenantId, settings, version: 1 },
          update: { settings, version: { increment: 1 } },
        });
      }
      if (input.branding) {
        const branding = {
          brandName: input.branding.brandName,
          legalEntityName: input.branding.legalEntityName,
          companyNumber: input.branding.companyNumber ?? null,
          vatNumber: input.branding.vatNumber ?? null,
          registeredAddress: input.branding.registeredAddress as Prisma.InputJsonValue,
          assets: input.branding.assets as Prisma.InputJsonValue,
          colours: input.branding.colours as Prisma.InputJsonValue,
          typography: input.branding.typography as Prisma.InputJsonValue,
          emailBranding: input.branding.emailBranding as Prisma.InputJsonValue,
        };
        await tx.brandingProfile.upsert({ where: { tenantId }, create: { tenantId, ...branding }, update: branding });
      }
      return { updated: true };
    });
    await this.audit('SETTINGS_UPDATED', 'Store', tenantId, undefined, {
      settingsUpdated: Boolean(input.settings),
      integrationsUpdated: Boolean(input.integrations),
    });
    return result;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  auditLog(filters: { entity?: string | undefined; action?: string | undefined; actorId?: string | undefined }) {
    return this.db.client.auditLog.findMany({ where: { ...(filters.entity ? { entity: filters.entity } : {}), ...(filters.action ? { action: filters.action } : {}), ...(filters.actorId ? { actorId: filters.actorId } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  private range(input: RangeInput) {
    const parsed = dateRangeSchema.parse(input);
    if (parsed.from && parsed.to && parsed.from > parsed.to) throw new BadRequestException('from must be before to');
    return { ...(parsed.from ? { gte: parsed.from } : {}), ...(parsed.to ? { lte: parsed.to } : {}) };
  }

  private async reportScope(input: Record<string, string | undefined>) {
    const filters = reportFilterSchema.parse(input);
    const range = this.reportRange(filters.from, filters.to);
    const hasProductScope = Boolean(filters.productId || filters.categoryId);
    const scopedProducts = hasProductScope
      ? await this.db.client.product.findMany({
          where: {
            ...(filters.productId ? { id: filters.productId } : {}),
            ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          },
          select: { id: true },
        })
      : [];
    const productIds = hasProductScope ? scopedProducts.map((product) => product.id) : null;
    const productOrderIds = productIds
      ? (
          await this.db.client.orderItem.findMany({
            where: { productId: { in: productIds } },
            distinct: ['orderId'],
            select: { orderId: true },
          })
        ).map((line) => line.orderId)
      : null;
    const couponOrderIds = filters.couponId
      ? (
          await this.db.client.couponRedemption.findMany({
            where: { couponId: filters.couponId, orderId: { not: null } },
            distinct: ['orderId'],
            select: { orderId: true },
          })
        ).flatMap((redemption) => (redemption.orderId ? [redemption.orderId] : []))
      : null;
    const constrainedOrderIds = productOrderIds && couponOrderIds
      ? productOrderIds.filter((id) => couponOrderIds.includes(id))
      : productOrderIds ?? couponOrderIds;
    const orders = await this.db.client.order.findMany({
      where: {
        createdAt: range,
        ...(filters.customerId ? { userId: filters.customerId } : {}),
        ...(filters.basketType ? { basketType: filters.basketType } : {}),
        ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
        ...(filters.fulfilmentStatus ? { fulfilmentStatus: filters.fulfilmentStatus } : {}),
        ...(constrainedOrderIds ? { id: { in: constrainedOrderIds } } : {}),
      },
      select: { id: true, userId: true, totalMinor: true, basketType: true },
    });
    return { filters, range, orders, orderIds: orders.map((order) => order.id), productIds };
  }

  private reportLineWhere(scope: Awaited<ReturnType<AdminService['reportScope']>>): Prisma.OrderItemWhereInput {
    return {
      orderId: { in: scope.orderIds },
      ...(scope.productIds ? { productId: { in: scope.productIds } } : {}),
    };
  }

  private reportRange(from?: string, to?: string) {
    const parsed = dateRangeSchema.parse({ from, to });
    const start = parsed.from;
    const end = parsed.to;
    if (end && to && /^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
    if (start && end && start > end) throw new BadRequestException('from must be before to');
    return { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
  }

  private serialiseRange(range: { gte?: Date; lte?: Date }) { return { from: range.gte?.toISOString() ?? null, to: range.lte?.toISOString() ?? null }; }

  private async audit(action: string, entity: string, entityId: string, before?: unknown, after?: unknown) {
    const actorId = TenantContext.get()?.userId;
    await this.db.client.auditLog.create({ data: {
      tenantId: TenantContext.requireTenantId(),
      ...(actorId ? { actorId } : {}),
      actorType: 'USER', action, entity, entityId,
      ...(before !== undefined ? { before: before as Prisma.InputJsonValue } : {}),
      ...(after !== undefined ? { after: after as Prisma.InputJsonValue } : {}),
      requestId: TenantContext.get()?.requestId ?? randomUUID(),
    } });
  }
}
