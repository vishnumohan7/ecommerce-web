import { Injectable } from '@nestjs/common';
import type {
  SearchFacetValue,
  SearchHit,
  SearchProvider,
  SearchRequest,
  SearchResponse,
} from '@app/ports';
import { AppConfigService } from '../../common/config/app-config.service';
import { decodeSearchCursor, encodeSearchCursor } from './search.cursor';

interface MeiliResult {
  hits: SearchHit[];
  facetDistribution?: Record<string, Record<string, number>>;
  [key: string]: unknown;
}

@Injectable()
export class MeilisearchProvider implements SearchProvider {
  private readonly host: string;
  private readonly headers: Record<string, string>;
  constructor(config: AppConfigService) {
    this.host = config.values.MEILI_HOST.replace(/\/$/, '');
    this.headers = {
      'content-type': 'application/json',
      ...(config.values.MEILI_MASTER_KEY
        ? { authorization: `Bearer ${config.values.MEILI_MASTER_KEY}` }
        : {}),
    };
  }

  async health(): Promise<{ ok: boolean }> {
    const response = await fetch(`${this.host}/health`, { headers: this.headers });
    return { ok: response.ok };
  }

  async search(input: SearchRequest): Promise<SearchResponse> {
    const filter = this.filters(input);
    const cursor = decodeSearchCursor(input.cursor);
    if (cursor) filter.push(`id > ${JSON.stringify(cursor.id)}`);
    const response = await fetch(`${this.host}/indexes/products/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        q: input.query ?? '',
        limit: input.limit + 1,
        filter,
        sort: this.sort(input.sort),
        facets: ['categoryName', 'brandName', 'storageType', 'isAlcohol', 'onOffer'],
        attributesToRetrieve: ['*'],
        showRankingScore: true,
      }),
    });
    if (!response.ok) throw new Error(`Meilisearch query failed with ${String(response.status)}`);
    const data = (await response.json()) as MeiliResult;
    const page = data.hits.slice(0, input.limit);
    const last = page.at(-1);
    const estimatedCount = data['estimatedTotalHits'];
    return {
      items: page,
      nextCursor:
        data.hits.length > input.limit && last
          ? encodeSearchCursor({ id: last.id, value: last.id })
          : null,
      facets: this.facets(data.facetDistribution ?? {}),
      resultCount: typeof estimatedCount === 'number' ? estimatedCount : page.length,
    };
  }

  async autocomplete(
    input: Pick<SearchRequest, 'tenantId' | 'query' | 'limit' | 'allowAlcohol' | 'synonyms'>,
  ): Promise<string[]> {
    const response = await fetch(`${this.host}/indexes/products/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        q: input.query ?? '',
        limit: input.limit,
        filter: [
          `tenantId = ${JSON.stringify(input.tenantId)}`,
          ...(!input.allowAlcohol ? ['isAlcohol = false'] : []),
        ],
        attributesToRetrieve: ['name'],
      }),
    });
    if (!response.ok)
      throw new Error(`Meilisearch autocomplete failed with ${String(response.status)}`);
    const data = (await response.json()) as { hits: Array<{ name: string }> };
    return data.hits.map((hit) => hit.name);
  }

  async upsert(document: SearchHit): Promise<void> {
    const response = await fetch(`${this.host}/indexes/products/documents?primaryKey=id`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify([document]),
    });
    if (!response.ok)
      throw new Error(`Meilisearch index update failed with ${String(response.status)}`);
  }

  async remove(_tenantId: string, productId: string): Promise<void> {
    const response = await fetch(
      `${this.host}/indexes/products/documents/${encodeURIComponent(productId)}`,
      { method: 'DELETE', headers: this.headers },
    );
    if (!response.ok && response.status !== 404)
      throw new Error(`Meilisearch index delete failed with ${String(response.status)}`);
  }

  private filters(input: SearchRequest): string[] {
    const values = [`tenantId = ${JSON.stringify(input.tenantId)}`, 'status = ACTIVE'];
    if (!input.allowAlcohol) values.push('isAlcohol = false');
    else if (input.alcohol !== undefined) values.push(`isAlcohol = ${String(input.alcohol)}`);
    if (input.categoryIds?.length)
      values.push(
        `categoryId IN [${input.categoryIds.map((value) => JSON.stringify(value)).join(',')}]`,
      );
    if (input.brandIds?.length)
      values.push(`brandId IN [${input.brandIds.map((value) => JSON.stringify(value)).join(',')}]`);
    if (input.minimumPriceMinor !== undefined)
      values.push(`priceMinor >= ${input.minimumPriceMinor.toString()}`);
    if (input.maximumPriceMinor !== undefined)
      values.push(`priceMinor <= ${input.maximumPriceMinor.toString()}`);
    if (input.inStock !== undefined) values.push(`inStock = ${String(input.inStock)}`);
    for (const tag of input.dietaryTags ?? []) values.push(`dietaryTags = ${JSON.stringify(tag)}`);
    for (const allergen of input.allergenFree ?? [])
      values.push(`allergens != ${JSON.stringify(allergen)}`);
    if (input.minimumAbv !== undefined) values.push(`abv >= ${input.minimumAbv}`);
    if (input.maximumAbv !== undefined) values.push(`abv <= ${input.maximumAbv}`);
    if (input.storageTypes?.length)
      values.push(
        `storageType IN [${input.storageTypes.map((value) => JSON.stringify(value)).join(',')}]`,
      );
    if (input.minimumRatingBps !== undefined)
      values.push(`ratingAverageBps >= ${String(input.minimumRatingBps)}`);
    if (input.onOffer !== undefined) values.push(`onOffer = ${String(input.onOffer)}`);
    return values;
  }

  private sort(sort: SearchRequest['sort']): string[] | undefined {
    if (sort === 'price-asc') return ['priceMinor:asc', 'id:asc'];
    if (sort === 'price-desc') return ['priceMinor:desc', 'id:asc'];
    if (sort === 'name-asc') return ['name:asc', 'id:asc'];
    if (sort === 'rating-desc') return ['ratingAverageBps:desc', 'id:asc'];
    return undefined;
  }

  private facets(
    distribution: Record<string, Record<string, number>>,
  ): Record<string, SearchFacetValue[]> {
    return Object.fromEntries(
      Object.entries(distribution).map(([facet, values]) => [
        facet,
        Object.entries(values).map(([value, count]) => ({ value, count })),
      ]),
    );
  }
}
