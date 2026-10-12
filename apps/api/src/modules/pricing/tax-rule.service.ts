import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type TaxCategory } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { taxRuleCreateSchema, taxRuleUpdateSchema } from './pricing.schemas';

@Injectable()
export class TaxRuleService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  list() {
    return this.db.client.taxRule.findMany({
      orderBy: [{ taxCategory: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async create(raw: unknown) {
    const input = taxRuleCreateSchema.parse(raw);
    await this.ensureUniqueStart(input.taxCategory, input.effectiveFrom);
    return this.db.transaction(async (tx, tenantId) => {
      const created = await tx.taxRule.create({
        data: { tenantId, ...input, effectiveTo: input.effectiveTo ?? null },
      });
      await this.audit(tx, 'TAX_RULE_CREATED', created.id, null, created);
      return created;
    });
  }

  async update(id: string, raw: unknown) {
    const input = taxRuleUpdateSchema.parse(raw);
    const current = await this.db.client.taxRule.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Tax rule not found');
    const effectiveFrom = input.effectiveFrom ?? current.effectiveFrom;
    const effectiveTo = input.effectiveTo === undefined ? current.effectiveTo : input.effectiveTo;
    const taxCategory = input.taxCategory ?? current.taxCategory;
    if (effectiveTo !== null && effectiveTo <= effectiveFrom)
      throw new UnprocessableEntityException({
        code: 'INVALID_TAX_RULE_WINDOW',
        message: 'The end date must be after the start date',
      });
    await this.ensureUniqueStart(taxCategory, effectiveFrom, id);
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.taxRule.update({
        where: { id, tenantId },
        data: {
          ...(input.taxCategory !== undefined ? { taxCategory: input.taxCategory } : {}),
          ...(input.rateBps !== undefined ? { rateBps: input.rateBps } : {}),
          ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
          ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.audit(tx, 'TAX_RULE_UPDATED', id, current, updated);
      return updated;
    });
  }

  async remove(id: string) {
    const current = await this.db.client.taxRule.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Tax rule not found');
    const now = new Date();
    const isCurrentlyEffective =
      current.active &&
      current.effectiveFrom <= now &&
      (current.effectiveTo === null || current.effectiveTo > now);
    if (isCurrentlyEffective) {
      const replacement = await this.db.client.taxRule.findFirst({
        where: {
          id: { not: id },
          taxCategory: current.taxCategory,
          active: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
      });
      if (!replacement)
        throw new ConflictException({
          code: 'TAX_RULE_REQUIRED',
          message: 'Add or activate a replacement rule before deleting the current VAT rule',
        });
    }
    return this.db.transaction(async (tx, tenantId) => {
      await tx.taxRule.delete({ where: { id, tenantId } });
      await this.audit(tx, 'TAX_RULE_DELETED', id, current, null);
      return { deleted: true, id };
    });
  }

  async effectiveRates(at = new Date()): Promise<Record<TaxCategory, number>> {
    const rules = await this.db.client.taxRule.findMany({
      where: {
        active: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const categories: TaxCategory[] = ['STANDARD_20', 'REDUCED_5', 'ZERO', 'EXEMPT'];
    return Object.fromEntries(
      categories.map((category) => {
        const rule = rules.find((candidate) => candidate.taxCategory === category);
        if (!rule)
          throw new UnprocessableEntityException({
            code: 'TAX_RULE_MISSING',
            message: `No effective tax rule for ${category}`,
          });
        return [category, rule.rateBps];
      }),
    ) as Record<TaxCategory, number>;
  }

  private async ensureUniqueStart(
    taxCategory: TaxCategory,
    effectiveFrom: Date,
    excludingId?: string,
  ) {
    const existing = await this.db.client.taxRule.findFirst({
      where: {
        taxCategory,
        effectiveFrom,
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
    });
    if (existing)
      throw new ConflictException({
        code: 'TAX_RULE_START_EXISTS',
        message: 'A rule for this tax category already starts on that date',
      });
  }

  private audit(
    tx: Prisma.TransactionClient,
    action: string,
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
        entity: 'TaxRule',
        entityId,
        before: before as Prisma.InputJsonValue,
        after: after as Prisma.InputJsonValue,
        requestId: TenantContext.get()?.requestId ?? entityId,
      },
    });
  }
}
