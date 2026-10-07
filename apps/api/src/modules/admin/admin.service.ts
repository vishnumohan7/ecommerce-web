import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { PrismaService } from '../../common/database/prisma.service';
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
} from './admin.schemas';

type RangeInput = { from?: string | undefined; to?: string | undefined };

@Injectable()
export class AdminService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly root: PrismaService) {}

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

  async salesReport(input: RangeInput) {
    const range = this.range(input);
    const [orders, lineGroups] = await Promise.all([
      this.db.client.order.findMany({ where: { createdAt: range }, select: { id: true, totalMinor: true, basketType: true } }),
      this.db.client.orderItem.groupBy({ by: ['orderCategory'], where: { createdAt: range }, _sum: { lineTotalMinor: true, quantity: true } }),
    ]);
    const byCategory = Object.fromEntries(lineGroups.map((row) => [row.orderCategory.toLowerCase(), {
      revenueMinor: (row._sum.lineTotalMinor ?? 0n).toString(),
      units: row._sum.quantity ?? 0,
    }]));
    return {
      range: this.serialiseRange(range),
      orders: orders.length,
      totalRevenueMinor: orders.reduce((sum, order) => sum + order.totalMinor, 0n).toString(),
      groceryRevenueMinor: byCategory.grocery?.revenueMinor ?? '0',
      alcoholRevenueMinor: byCategory.alcohol?.revenueMinor ?? '0',
      units: { grocery: byCategory.grocery?.units ?? 0, alcohol: byCategory.alcohol?.units ?? 0 },
      basketCounts: {
        grocery: orders.filter((order) => order.basketType === 'GROCERY').length,
        alcohol: orders.filter((order) => order.basketType === 'ALCOHOL').length,
        mixed: orders.filter((order) => order.basketType === 'MIXED').length,
      },
    };
  }

  async customerReport(input: RangeInput) {
    const range = this.range(input);
    const orders = await this.db.client.order.groupBy({ by: ['userId'], where: { createdAt: range, userId: { not: null } }, _count: true, _sum: { totalMinor: true } });
    return {
      range: this.serialiseRange(range),
      customers: orders.length,
      repeatCustomers: orders.filter((row) => row._count > 1).length,
      topCustomers: orders.sort((a, b) => Number((b._sum.totalMinor ?? 0n) - (a._sum.totalMinor ?? 0n))).slice(0, 20).map((row) => ({ userId: row.userId, orders: row._count, spendMinor: (row._sum.totalMinor ?? 0n).toString() })),
    };
  }

  async productReport(input: RangeInput) {
    const range = this.range(input);
    const rows = await this.db.client.orderItem.groupBy({ by: ['productId', 'productName', 'sku'], where: { createdAt: range }, _sum: { quantity: true, lineTotalMinor: true }, orderBy: { _sum: { lineTotalMinor: 'desc' } }, take: 100 });
    return rows.map((row) => ({ productId: row.productId, name: row.productName, sku: row.sku, units: row._sum.quantity ?? 0, revenueMinor: (row._sum.lineTotalMinor ?? 0n).toString() }));
  }

  async categoryReport(input: RangeInput) {
    const range = this.range(input);
    const lines = await this.db.client.orderItem.findMany({ where: { createdAt: range }, select: { productId: true, quantity: true, lineTotalMinor: true } });
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

  async couponReport(input: RangeInput) {
    const range = this.range(input);
    const rows = await this.db.client.couponRedemption.groupBy({ by: ['couponId'], where: { createdAt: range }, _count: true, _sum: { discountMinor: true } });
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
    return { settings: settings?.settings ?? {}, settingsVersion: settings?.version ?? 0, branding };
  }

  async updateSettings(body: unknown) {
    const input = settingsUpdateSchema.parse(body);
    const tenantId = TenantContext.requireTenantId();
    const result = await this.db.transaction(async (tx) => {
      if (input.settings) {
        const settings = input.settings as Prisma.InputJsonValue;
        await tx.tenantSettings.upsert({ where: { tenantId }, create: { tenantId, settings, version: 1 }, update: { settings, version: { increment: 1 } } });
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
    await this.audit('SETTINGS_UPDATED', 'Tenant', tenantId, undefined, input);
    return result;
  }

  auditLog(filters: { entity?: string | undefined; action?: string | undefined; actorId?: string | undefined }) {
    return this.db.client.auditLog.findMany({ where: { ...(filters.entity ? { entity: filters.entity } : {}), ...(filters.action ? { action: filters.action } : {}), ...(filters.actorId ? { actorId: filters.actorId } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  private range(input: RangeInput) {
    const parsed = dateRangeSchema.parse(input);
    if (parsed.from && parsed.to && parsed.from > parsed.to) throw new BadRequestException('from must be before to');
    return { ...(parsed.from ? { gte: parsed.from } : {}), ...(parsed.to ? { lte: parsed.to } : {}) };
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
