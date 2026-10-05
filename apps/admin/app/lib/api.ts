const API_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  priceMinor: string;
  currency: string;
  unitPriceDisplay: string;
  storageType: string;
  dietaryTags: string[];
  allergens: string[];
  isAlcohol: boolean;
  abv: string | null;
  restrictionReason: string;
  ratingAverageBps: number;
  ratingCount: number;
}

export interface SearchResponse {
  items: Array<
    Product & {
      categoryName?: string;
      brandName?: string | null;
      inStock?: boolean;
      onOffer?: boolean;
    }
  >;
  nextCursor: string | null;
  resultCount: number;
  responseTimeMs: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function get<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok)
      return {
        ok: false,
        error: `API returned ${String(response.status)} ${response.statusText}.`,
      };
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The API request failed.' };
  }
}

export function fetchHealth(kind: 'health' | 'ready' = 'health') {
  return get<{ status: string; checks?: string[] }>(`/${kind}`);
}
export function fetchProducts() {
  return get<Product[]>('/api/v1/products');
}
export function fetchSearch(query: string) {
  const params = new URLSearchParams({ limit: '50', sort: query ? 'relevance' : 'name-asc' });
  if (query) params.set('q', query);
  return get<SearchResponse>(`/api/v1/search?${params}`);
}
export { API_BASE_URL };
