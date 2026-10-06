import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import {
  attributeSetSchema,
  attributeSetUpdateSchema,
  brandCreateSchema,
  brandUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
} from './catalog.schemas';

@Injectable()
export class TaxonomyService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async categories(cursor?: string, requestedLimit?: number) {
    const limit = Math.min(Math.max(requestedLimit ?? 100, 1), 100);
    const items = await this.db.client.category.findMany({
      where: { active: true, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    return page(items, limit);
  }

  async category(id: string) {
    const value = await this.db.client.category.findFirst({ where: { id, active: true } });
    if (!value) throw new NotFoundException('Category not found');
    return value;
  }

  async createCategory(raw: unknown) {
    const input = categoryCreateSchema.parse(raw);
    const parent = input.parentId
      ? await this.db.client.category.findFirst({ where: { id: input.parentId, active: true } })
      : null;
    if (input.parentId && !parent) throw new NotFoundException('Parent category not found');
    await this.uniqueCategorySlug(input.slug);
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.category.create({
        data: {
          tenantId,
          parentId: parent?.id ?? null,
          slug: input.slug,
          name: input.name,
          path: `${parent?.path ?? ''}/${input.slug}`,
          position: input.position,
          active: input.active,
        },
      });
      await this.audit(tx, 'CATEGORY_CREATED', 'Category', created.id, null, created);
      return created;
    });
  }

  async updateCategory(id: string, raw: unknown) {
    const input = categoryUpdateSchema.parse(raw);
    const current = await this.db.client.category.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Category not found');
    if (input.slug && input.slug !== current.slug) await this.uniqueCategorySlug(input.slug, id);
    const parentId = input.parentId === undefined ? current.parentId : input.parentId;
    const parent = parentId
      ? await this.db.client.category.findFirst({ where: { id: parentId, active: true } })
      : null;
    if (parentId && !parent) throw new NotFoundException('Parent category not found');
    if (
      parent &&
      (parent.id === id ||
        parent.path === current.path ||
        parent.path.startsWith(`${current.path}/`))
    )
      throw new ConflictException({
        code: 'CATEGORY_CYCLE',
        message: 'A category cannot be moved below itself',
      });
    const slug = input.slug ?? current.slug;
    const nextPath = `${parent?.path ?? ''}/${slug}`;
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.category.update({
        where: { id, tenantId },
        data: {
          parentId,
          slug,
          name: input.name ?? current.name,
          path: nextPath,
          position: input.position ?? current.position,
          active: input.active ?? current.active,
        },
      });
      if (nextPath !== current.path)
        await tx.$executeRaw`
          UPDATE "Category"
          SET "path" = ${nextPath} || substring("path" from ${current.path.length + 1}::integer)
          WHERE "tenantId" = ${tenantId}::uuid AND "path" LIKE ${`${current.path}/%`}
        `;
      await this.audit(tx, 'CATEGORY_UPDATED', 'Category', id, current, updated);
      return updated;
    });
  }

  async deleteCategory(id: string) {
    const current = await this.db.client.category.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Category not found');
    const [products, children] = await Promise.all([
      this.db.client.product.count({ where: { categoryId: id, status: { not: 'INACTIVE' } } }),
      this.db.client.category.count({ where: { parentId: id, active: true } }),
    ]);
    if (products > 0 || children > 0)
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message: 'Archive child categories and products before archiving this category',
        details: { products, children },
      });
    return this.db.transaction(async (tx, tenantId) => {
      const archived = await tx.category.update({
        where: { id, tenantId },
        data: { active: false },
      });
      await this.audit(tx, 'CATEGORY_ARCHIVED', 'Category', id, current, archived);
      return { archived: true, id };
    });
  }

  async brands(cursor?: string, requestedLimit?: number) {
    const limit = Math.min(Math.max(requestedLimit ?? 100, 1), 100);
    const items = await this.db.client.brand.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    return page(items, limit);
  }

  async brand(id: string) {
    const value = await this.db.client.brand.findFirst({ where: { id } });
    if (!value) throw new NotFoundException('Brand not found');
    return value;
  }

  async createBrand(raw: unknown) {
    const input = brandCreateSchema.parse(raw);
    await this.uniqueBrandSlug(input.slug);
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.brand.create({ data: { tenantId, ...input } });
      await this.audit(tx, 'BRAND_CREATED', 'Brand', created.id, null, created);
      return created;
    });
  }

  async updateBrand(id: string, raw: unknown) {
    const input = brandUpdateSchema.parse(raw);
    const current = await this.db.client.brand.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Brand not found');
    if (input.slug && input.slug !== current.slug) await this.uniqueBrandSlug(input.slug, id);
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.brand.update({
        where: { id, tenantId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
        },
      });
      await this.audit(tx, 'BRAND_UPDATED', 'Brand', id, current, updated);
      return updated;
    });
  }

  async deleteBrand(id: string) {
    const current = await this.db.client.brand.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Brand not found');
    const products = await this.db.client.product.count({ where: { brandId: id } });
    if (products > 0)
      throw new ConflictException({
        code: 'BRAND_IN_USE',
        message: 'Remove the brand from products before deleting it',
        details: { products },
      });
    return this.db.transaction(async (tx, tenantId) => {
      await tx.brand.delete({ where: { id, tenantId } });
      await this.audit(tx, 'BRAND_DELETED', 'Brand', id, current, null);
      return { deleted: true, id };
    });
  }

  async attributeSets(cursor?: string, requestedLimit?: number) {
    const limit = Math.min(Math.max(requestedLimit ?? 100, 1), 100);
    const items = await this.db.client.attributeSet.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    return page(items, limit);
  }

  async attributeSet(id: string) {
    const value = await this.db.client.attributeSet.findFirst({ where: { id } });
    if (!value) throw new NotFoundException('Attribute set not found');
    return value;
  }

  async createAttributeSet(raw: unknown) {
    const input = attributeSetSchema.parse(raw);
    if (await this.db.client.attributeSet.findFirst({ where: { key: input.key } }))
      throw duplicate('ATTRIBUTE_SET_KEY_EXISTS', 'Attribute-set key already exists');
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.attributeSet.create({
        data: { tenantId, key: input.key, name: input.name, definitions: input.definitions },
      });
      await this.audit(tx, 'ATTRIBUTE_SET_CREATED', 'AttributeSet', created.id, null, created);
      return created;
    });
  }

  async updateAttributeSet(id: string, raw: unknown) {
    const input = attributeSetUpdateSchema.parse(raw);
    const current = await this.db.client.attributeSet.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Attribute set not found');
    if (
      input.key &&
      input.key !== current.key &&
      (await this.db.client.attributeSet.findFirst({ where: { key: input.key } }))
    )
      throw duplicate('ATTRIBUTE_SET_KEY_EXISTS', 'Attribute-set key already exists');
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.attributeSet.update({
        where: { id, tenantId },
        data: {
          ...(input.key !== undefined ? { key: input.key } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.definitions !== undefined ? { definitions: input.definitions } : {}),
        },
      });
      await this.audit(tx, 'ATTRIBUTE_SET_UPDATED', 'AttributeSet', id, current, updated);
      return updated;
    });
  }

  async deleteAttributeSet(id: string) {
    const current = await this.db.client.attributeSet.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Attribute set not found');
    const products = await this.db.client.productAttribute.count({ where: { attributeSetId: id } });
    if (products > 0)
      throw new ConflictException({
        code: 'ATTRIBUTE_SET_IN_USE',
        message: 'Remove product attribute values before deleting the attribute set',
        details: { products },
      });
    return this.db.transaction(async (tx, tenantId) => {
      await tx.attributeSet.delete({ where: { id, tenantId } });
      await this.audit(tx, 'ATTRIBUTE_SET_DELETED', 'AttributeSet', id, current, null);
      return { deleted: true, id };
    });
  }

  private async uniqueCategorySlug(slug: string, excludingId?: string) {
    const existing = await this.db.client.category.findFirst({
      where: { slug, ...(excludingId ? { id: { not: excludingId } } : {}) },
    });
    if (existing) throw duplicate('CATEGORY_SLUG_EXISTS', 'Category slug already exists');
  }

  private async uniqueBrandSlug(slug: string, excludingId?: string) {
    const existing = await this.db.client.brand.findFirst({
      where: { slug, ...(excludingId ? { id: { not: excludingId } } : {}) },
    });
    if (existing) throw duplicate('BRAND_SLUG_EXISTS', 'Brand slug already exists');
  }

  private audit(
    tx: Prisma.TransactionClient,
    action: string,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        actorId: TenantContext.get()?.userId ?? null,
        actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
        action,
        entity,
        entityId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
        requestId: TenantContext.get()?.requestId ?? entityId,
      },
    });
  }
}

function page<T extends { id: string }>(items: T[], limit: number) {
  const hasNext = items.length > limit;
  const visible = hasNext ? items.slice(0, limit) : items;
  return { items: visible, nextCursor: hasNext ? (visible.at(-1)?.id ?? null) : null };
}

function duplicate(code: string, message: string) {
  return new ConflictException({ code, message });
}
