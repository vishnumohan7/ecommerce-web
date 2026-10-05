import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SearchProvider, SearchRequest } from '@app/ports';
import { TOKENS } from '@app/ports';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { searchQuerySchema, synonymSchema } from './search.schemas';

@Injectable()
export class SearchService {
  constructor(
    @Inject(TOKENS.Search) private readonly provider: SearchProvider,
    private readonly db: TenantScopedPrismaService,
  ) {}

  async search(raw: unknown, allowAlcohol: boolean) {
    const input = searchQuerySchema.parse(raw);
    const tenantId = TenantContext.requireTenantId();
    const synonyms = await this.synonymsFor(input.q);
    const request: SearchRequest = {
      tenantId,
      limit: input.limit,
      sort: input.sort,
      allowAlcohol,
      ...(input.q ? { query: input.q } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.category?.length || input.subcategory?.length
        ? { categoryIds: [...(input.category ?? []), ...(input.subcategory ?? [])] }
        : {}),
      ...(input.brand?.length ? { brandIds: input.brand } : {}),
      ...(input.minPriceMinor !== undefined ? { minimumPriceMinor: input.minPriceMinor } : {}),
      ...(input.maxPriceMinor !== undefined ? { maximumPriceMinor: input.maxPriceMinor } : {}),
      ...(input.inStock !== undefined ? { inStock: input.inStock } : {}),
      ...(input.dietary?.length ? { dietaryTags: input.dietary } : {}),
      ...(input.allergenFree?.length ? { allergenFree: input.allergenFree } : {}),
      ...(input.alcohol !== undefined ? { alcohol: input.alcohol } : {}),
      ...(input.minAbv ? { minimumAbv: input.minAbv } : {}),
      ...(input.maxAbv ? { maximumAbv: input.maxAbv } : {}),
      ...(input.storage?.length ? { storageTypes: input.storage } : {}),
      ...(input.minRatingBps !== undefined ? { minimumRatingBps: input.minRatingBps } : {}),
      ...(input.onOffer !== undefined ? { onOffer: input.onOffer } : {}),
      ...(synonyms.length ? { synonyms } : {}),
    };
    const started = performance.now();
    const result = await this.provider.search(request);
    const responseTimeMs = Math.max(0, Math.round(performance.now() - started));
    await this.db.client.searchLog.create({
      data: {
        tenantId,
        userId: TenantContext.get()?.userId ?? null,
        query: input.q ?? '',
        filters: this.loggable(input) as Prisma.InputJsonObject,
        resultCount: result.resultCount,
        responseTimeMs,
      },
    });
    return { ...result, responseTimeMs };
  }

  async autocomplete(
    q: string | undefined,
    limitRaw: string | undefined,
    allowAlcohol: boolean,
  ): Promise<string[]> {
    const query = q?.trim();
    if (!query) return [];
    const limit = Math.min(Math.max(Number(limitRaw ?? 8) || 8, 1), 20);
    const synonyms = await this.synonymsFor(query);
    return this.provider.autocomplete({
      tenantId: TenantContext.requireTenantId(),
      query,
      limit,
      allowAlcohol,
      ...(synonyms.length ? { synonyms } : {}),
    });
  }

  listSynonyms() {
    return this.db.client.searchSynonym.findMany({ orderBy: { createdAt: 'asc' } });
  }
  createSynonym(raw: unknown) {
    const input = synonymSchema.parse(raw);
    return this.db.client.searchSynonym.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        terms: input.terms,
        enabled: input.enabled,
      },
    });
  }
  async updateSynonym(id: string, raw: unknown) {
    const input = synonymSchema.parse(raw);
    const existing = await this.db.client.searchSynonym.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Search synonym not found');
    return this.db.client.searchSynonym.update({ where: { id }, data: input });
  }
  async deleteSynonym(id: string) {
    const existing = await this.db.client.searchSynonym.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Search synonym not found');
    await this.db.client.searchSynonym.delete({ where: { id } });
    return { deleted: true };
  }

  private async synonymsFor(query?: string): Promise<string[]> {
    if (!query) return [];
    const normalized = query.toLowerCase();
    const groups = await this.db.client.searchSynonym.findMany({
      where: { enabled: true },
      select: { terms: true },
    });
    return [
      ...new Set(
        groups
          .filter((group) => group.terms.some((term) => normalized.includes(term)))
          .flatMap((group) => group.terms)
          .filter((term) => !normalized.includes(term)),
      ),
    ];
  }

  private loggable(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'bigint' ? item.toString() : item,
      ]),
    );
  }
}
