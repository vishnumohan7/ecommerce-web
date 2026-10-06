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

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  path: string;
  position: number;
  active: boolean;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
}

export interface DeliveryZone {
  id: string;
  code: string;
  name: string;
  postcodePatterns: string[];
  groceryFeeMinor: string;
  alcoholFeeMinor: string;
  freeDeliveryThresholdMinor: string | null;
  alcoholDeliveryAllowed: boolean;
  active: boolean;
}

export interface DeliverySlot {
  id: string;
  zoneId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reserved: number;
  surchargeMinor: string;
  allowsAgeRestricted: boolean;
  active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  valueBps: number | null;
  valueMinor: string | null;
  currency: string;
  couponClass: string;
  appliesTo: string;
  startsAt: string;
  endsAt: string;
  uses: number;
  maxUses: number | null;
  active: boolean;
}

export interface Influencer {
  id: string;
  code: string;
  displayName: string;
  commissionBps: number;
  active: boolean;
}

export interface TaxRule {
  id: string;
  taxCategory: string;
  rateBps: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function get<T>(path: string, admin = false): Promise<ApiResult<T>> {
  try {
    const token = process.env.ADMIN_API_TOKEN;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(admin && token ? { authorization: `Bearer ${token}` } : {}),
      },
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

export async function adminMutation<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token)
    return { ok: false, error: 'ADMIN_API_TOKEN is not configured for write operations.' };
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;
      return {
        ok: false,
        error: payload?.message ?? payload?.error ?? `API returned ${String(response.status)}.`,
      };
    }
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
export function fetchCategories() {
  return get<PageResult<Category>>('/api/v1/categories?limit=100');
}
export function fetchBrands() {
  return get<PageResult<Brand>>('/api/v1/brands?limit=100');
}
export function fetchDeliveryZones() {
  return get<DeliveryZone[]>('/api/v1/admin/delivery/zones', true);
}
export function fetchDeliverySlots() {
  return get<DeliverySlot[]>('/api/v1/admin/delivery/slots', true);
}
export function fetchCoupons() {
  return get<Coupon[]>('/api/v1/admin/coupons', true);
}
export function fetchInfluencers() {
  return get<Influencer[]>('/api/v1/admin/influencers', true);
}
export function fetchTaxRules() {
  return get<TaxRule[]>('/api/v1/admin/tax-rules', true);
}
export function fetchSearch(query: string) {
  const params = new URLSearchParams({ limit: '50', sort: query ? 'relevance' : 'name-asc' });
  if (query) params.set('q', query);
  return get<SearchResponse>(`/api/v1/search?${params}`);
}
export { API_BASE_URL };
