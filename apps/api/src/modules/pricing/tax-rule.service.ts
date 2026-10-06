import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { TaxCategory } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { taxRuleCreateSchema } from './pricing.schemas';

@Injectable()
export class TaxRuleService {
  constructor(private readonly db: TenantScopedPrismaService) {}

  list() {
    return this.db.client.taxRule.findMany({
      orderBy: [{ taxCategory: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  create(raw: unknown) {
    const input = taxRuleCreateSchema.parse(raw);
    return this.db.client.taxRule.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        ...input,
        effectiveTo: input.effectiveTo ?? null,
      },
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
}
