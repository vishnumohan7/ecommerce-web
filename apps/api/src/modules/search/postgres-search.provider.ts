import { Injectable } from '@nestjs/common';
import type {
  SearchFacetValue,
  SearchHit,
  SearchProvider,
  SearchRequest,
  SearchResponse,
} from '@app/ports';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { decodeSearchCursor, encodeSearchCursor } from './search.cursor';

interface SearchRow {
  id: string;
  tenantId: string;
  status: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  brandId: string | null;
  brandName: string | null;
  priceMinor: bigint;
  currency: string;
  isAlcohol: boolean;
  abv: Prisma.Decimal | null;
  dietaryTags: string[];
  allergens: string[];
  storageType: string;
  ratingAverageBps: number;
  ratingCount: number;
  imageUrl: string | null;
  inStock: boolean;
  onOffer: boolean;
  rank: number;
  total: bigint;
}
interface FacetRow {
  facet: string;
  value: string;
  count: bigint;
}

@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  private readonly autocompleteCache = new Map<string, { expiresAt: number; values: string[] }>();
  private readonly searchCache = new Map<string, { expiresAt: number; value: SearchResponse }>();
  constructor(private readonly db: TenantScopedPrismaService) {}

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }

  async search(input: SearchRequest): Promise<SearchResponse> {
    const cacheKey = JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const query = this.expandedQuery(input.query, input.synonyms);
    const rank = this.rankSql(query);
    const offer = Prisma.sql`EXISTS (
      SELECT 1 FROM "PromotionProduct" pp JOIN "Promotion" promotion ON promotion."id" = pp."promotionId"
      WHERE pp."tenantId" = p."tenantId" AND pp."productId" = p."id" AND promotion."active" = true
        AND promotion."startsAt" <= CURRENT_TIMESTAMP AND promotion."endsAt" >= CURRENT_TIMESTAMP
    )`;
    const inStock = Prisma.sql`EXISTS (SELECT 1 FROM "Inventory" inventory WHERE inventory."tenantId" = p."tenantId" AND inventory."productId" = p."id" AND inventory."stockAvailable" > 0)`;
    const conditions = this.conditions(input, query, rank, offer, inStock);
    const where = Prisma.sql`${Prisma.join(conditions, ' AND ')}`;
    const cursor = decodeSearchCursor(input.cursor);
    const cursorCondition = this.cursorCondition(input.sort, cursor);
    const order = this.orderBy(input.sort);
    const rowsPromise = this.db.client.$queryRaw<SearchRow[]>(Prisma.sql`
      WITH matched AS (
        SELECT p."id", p."tenantId", p."status"::text, p."sku", p."slug", p."name", p."description", p."categoryId", c."name" AS "categoryName",
          p."brandId", b."name" AS "brandName", p."priceMinor", p."currency", p."isAlcohol", p."abv",
          p."dietaryTags", p."allergens", p."storageType"::text, p."ratingAverageBps", p."ratingCount",
          (SELECT image."url" FROM "ProductImage" image
            WHERE image."tenantId" = p."tenantId" AND image."productId" = p."id"
              AND image."url" ~ '^https?://'
            ORDER BY image."position" ASC, image."createdAt" ASC LIMIT 1) AS "imageUrl",
          ${inStock} AS "inStock", ${offer} AS "onOffer", ${rank}::double precision AS rank
        FROM "Product" p
        JOIN "Category" c ON c."id" = p."categoryId" AND c."tenantId" = p."tenantId"
        LEFT JOIN "Brand" b ON b."id" = p."brandId" AND b."tenantId" = p."tenantId"
        WHERE ${where}
      ), counted AS (SELECT matched.*, count(*) OVER() AS total FROM matched)
      SELECT * FROM counted WHERE ${cursorCondition} ORDER BY ${order} LIMIT ${input.limit + 1}
    `);
    const facetRowsPromise = this.db.client.$queryRaw<FacetRow[]>(Prisma.sql`
      WITH matched AS (
        SELECT p.*, c."name" AS "categoryName", b."name" AS "brandName", ${offer} AS "onOffer"
        FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" AND c."tenantId" = p."tenantId"
        LEFT JOIN "Brand" b ON b."id" = p."brandId" AND b."tenantId" = p."tenantId"
        WHERE ${where}
      )
      SELECT 'category' AS facet, "categoryName" AS value, count(*) AS count FROM matched GROUP BY "categoryName"
      UNION ALL SELECT 'brand', coalesce("brandName", 'Unbranded'), count(*) FROM matched GROUP BY "brandName"
      UNION ALL SELECT 'storageType', "storageType"::text, count(*) FROM matched GROUP BY "storageType"
      UNION ALL SELECT 'alcohol', CASE WHEN "isAlcohol" THEN 'alcohol' ELSE 'non-alcohol' END, count(*) FROM matched GROUP BY "isAlcohol"
      UNION ALL SELECT 'onOffer', CASE WHEN "onOffer" THEN 'true' ELSE 'false' END, count(*) FROM matched GROUP BY "onOffer"
    `);
    const [rows, facetRows] = await Promise.all([rowsPromise, facetRowsPromise]);
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > input.limit && last
        ? encodeSearchCursor({ id: last.id, value: this.cursorValue(input.sort, last) })
        : null;
    const response = {
      items: page.map((row) => this.hit(row)),
      nextCursor,
      facets: this.facets(facetRows),
      resultCount: Number(rows[0]?.total ?? 0n),
    };
    this.searchCache.set(cacheKey, { expiresAt: Date.now() + 10_000, value: response });
    return response;
  }

  async autocomplete(
    input: Pick<SearchRequest, 'tenantId' | 'query' | 'limit' | 'allowAlcohol' | 'synonyms'>,
  ): Promise<string[]> {
    const query = this.expandedQuery(input.query, input.synonyms);
    if (!query) return [];
    const cacheKey = `${input.tenantId}:${String(input.allowAlcohol)}:${String(input.limit)}:${query.toLowerCase()}`;
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.values;
    const rows = await this.db.client.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT p."name" FROM "Product" p
      WHERE p."tenantId" = ${input.tenantId}::uuid AND p."status" = 'ACTIVE'::"ProductStatus"
        AND (${input.allowAlcohol} OR p."isAlcohol" = false)
        AND (p."name" ILIKE ${`${query}%`} OR p."name" ILIKE ${`%${query}%`} OR word_similarity(${query}, p."name") >= 0.35)
      ORDER BY CASE WHEN p."name" ILIKE ${`${query}%`} THEN 0 ELSE 1 END, word_similarity(${query}, p."name") DESC, p."name" ASC
      LIMIT ${input.limit}
    `);
    const values = rows.map((row) => row.name);
    this.autocompleteCache.set(cacheKey, { expiresAt: Date.now() + 30_000, values });
    return values;
  }

  upsert(): Promise<void> {
    this.clearCaches();
    return Promise.resolve();
  }
  remove(): Promise<void> {
    this.clearCaches();
    return Promise.resolve();
  }

  private clearCaches(): void {
    this.searchCache.clear();
    this.autocompleteCache.clear();
  }

  private expandedQuery(query?: string, synonyms?: string[]): string {
    return [query?.trim(), ...(synonyms ?? [])]
      .filter((term): term is string => Boolean(term))
      .join(' OR ');
  }

  private rankSql(query: string): Prisma.Sql {
    if (!query) return Prisma.sql`0.0`;
    return Prisma.sql`(
      ts_rank_cd(p."searchDocument", websearch_to_tsquery('english', ${query})) * 4 +
      ts_rank_cd(
        setweight(to_tsvector('english', coalesce(b."name", '')), 'B') ||
        setweight(to_tsvector('english', c."name"), 'B') ||
        setweight(to_tsvector('english', array_to_string(p."dietaryTags", ' ')), 'B'),
        websearch_to_tsquery('english', ${query})
      ) * 2 +
      greatest(word_similarity(${query}, p."name"), similarity(p."sku", ${query}), word_similarity(${query}, coalesce(b."name", '')), word_similarity(${query}, c."name"))
    )`;
  }

  private conditions(
    input: SearchRequest,
    query: string,
    rank: Prisma.Sql,
    offer: Prisma.Sql,
    inStock: Prisma.Sql,
  ): Prisma.Sql[] {
    const values: Prisma.Sql[] = [
      Prisma.sql`p."tenantId" = ${input.tenantId}::uuid`,
      Prisma.sql`p."status" = 'ACTIVE'::"ProductStatus"`,
    ];
    if (!input.allowAlcohol) values.push(Prisma.sql`p."isAlcohol" = false`);
    else if (input.alcohol !== undefined) values.push(Prisma.sql`p."isAlcohol" = ${input.alcohol}`);
    if (query)
      values.push(
        Prisma.sql`(p."searchDocument" @@ websearch_to_tsquery('english', ${query}) OR ${rank} >= 0.18)`,
      );
    if (input.categoryIds?.length)
      values.push(
        Prisma.sql`p."categoryId" IN (${Prisma.join(input.categoryIds.map((value) => Prisma.sql`${value}::uuid`))})`,
      );
    if (input.brandIds?.length)
      values.push(
        Prisma.sql`p."brandId" IN (${Prisma.join(input.brandIds.map((value) => Prisma.sql`${value}::uuid`))})`,
      );
    if (input.minimumPriceMinor !== undefined)
      values.push(Prisma.sql`p."priceMinor" >= ${input.minimumPriceMinor}`);
    if (input.maximumPriceMinor !== undefined)
      values.push(Prisma.sql`p."priceMinor" <= ${input.maximumPriceMinor}`);
    if (input.inStock !== undefined) values.push(Prisma.sql`${inStock} = ${input.inStock}`);
    if (input.dietaryTags?.length)
      values.push(Prisma.sql`p."dietaryTags" @> ARRAY[${Prisma.join(input.dietaryTags)}]::text[]`);
    if (input.allergenFree?.length)
      values.push(
        Prisma.sql`NOT (p."allergens" && ARRAY[${Prisma.join(input.allergenFree)}]::text[])`,
      );
    if (input.minimumAbv !== undefined)
      values.push(Prisma.sql`p."abv" >= ${new Prisma.Decimal(input.minimumAbv)}`);
    if (input.maximumAbv !== undefined)
      values.push(Prisma.sql`p."abv" <= ${new Prisma.Decimal(input.maximumAbv)}`);
    if (input.storageTypes?.length)
      values.push(Prisma.sql`p."storageType"::text IN (${Prisma.join(input.storageTypes)})`);
    if (input.minimumRatingBps !== undefined)
      values.push(Prisma.sql`p."ratingAverageBps" >= ${input.minimumRatingBps}`);
    if (input.onOffer !== undefined) values.push(Prisma.sql`${offer} = ${input.onOffer}`);
    return values;
  }

  private cursorCondition(
    sort: SearchRequest['sort'],
    cursor: ReturnType<typeof decodeSearchCursor>,
  ): Prisma.Sql {
    if (!cursor) return Prisma.sql`true`;
    if (sort === 'price-asc')
      return Prisma.sql`("priceMinor" > ${BigInt(cursor.value)} OR ("priceMinor" = ${BigInt(cursor.value)} AND "id" > ${cursor.id}::uuid))`;
    if (sort === 'price-desc')
      return Prisma.sql`("priceMinor" < ${BigInt(cursor.value)} OR ("priceMinor" = ${BigInt(cursor.value)} AND "id" > ${cursor.id}::uuid))`;
    if (sort === 'name-asc')
      return Prisma.sql`(lower("name") > ${String(cursor.value)} OR (lower("name") = ${String(cursor.value)} AND "id" > ${cursor.id}::uuid))`;
    if (sort === 'rating-desc')
      return Prisma.sql`("ratingAverageBps" < ${Number(cursor.value)} OR ("ratingAverageBps" = ${Number(cursor.value)} AND "id" > ${cursor.id}::uuid))`;
    return Prisma.sql`(rank < ${Number(cursor.value)} OR (rank = ${Number(cursor.value)} AND "id" > ${cursor.id}::uuid))`;
  }

  private orderBy(sort: SearchRequest['sort']): Prisma.Sql {
    if (sort === 'price-asc') return Prisma.sql`"priceMinor" ASC, "id" ASC`;
    if (sort === 'price-desc') return Prisma.sql`"priceMinor" DESC, "id" ASC`;
    if (sort === 'name-asc') return Prisma.sql`lower("name") ASC, "id" ASC`;
    if (sort === 'rating-desc') return Prisma.sql`"ratingAverageBps" DESC, "id" ASC`;
    return Prisma.sql`rank DESC, "id" ASC`;
  }

  private cursorValue(sort: SearchRequest['sort'], row: SearchRow): string | number {
    if (sort === 'price-asc' || sort === 'price-desc') return row.priceMinor.toString();
    if (sort === 'name-asc') return row.name.toLowerCase();
    if (sort === 'rating-desc') return row.ratingAverageBps;
    return row.rank;
  }

  private hit(row: SearchRow): SearchHit {
    return {
      id: row.id,
      tenantId: row.tenantId,
      status: row.status,
      sku: row.sku,
      slug: row.slug,
      name: row.name,
      description: row.description,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      brandId: row.brandId,
      brandName: row.brandName,
      priceMinor: row.priceMinor.toString(),
      currency: row.currency,
      isAlcohol: row.isAlcohol,
      abv: row.abv?.toFixed(2) ?? null,
      dietaryTags: row.dietaryTags,
      allergens: row.allergens,
      storageType: row.storageType,
      ratingAverageBps: row.ratingAverageBps,
      ratingCount: row.ratingCount,
      imageUrl: row.imageUrl,
      inStock: row.inStock,
      onOffer: row.onOffer,
      rank: row.rank,
    };
  }

  private facets(rows: FacetRow[]): Record<string, SearchFacetValue[]> {
    return rows.reduce<Record<string, SearchFacetValue[]>>((result, row) => {
      (result[row.facet] ??= []).push({ value: row.value, count: Number(row.count) });
      return result;
    }, {});
  }
}
