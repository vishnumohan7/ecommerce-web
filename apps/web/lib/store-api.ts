export const API_BASE = (
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000'
).replace(/\/$/, '');

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  priceMinor: string | number;
  currency: string;
  categoryId: string;
  brandId?: string | null;
  isAlcohol: boolean;
  ageRestriction: number;
  abv?: string | number | null;
  unitPriceDisplay?: string | null;
  ratingAverageBps?: number;
  ratingCount?: number;
  inStock?: boolean;
  onOffer?: boolean;
  categoryName?: string;
  brandName?: string | null;
  imageUrl?: string | null;
  images?: Array<{ id: string; url: string; altText: string; position: number }>;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    priceMinor: string | number;
    packSize?: string | null;
  }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  path: string;
  imageUrl?: string | null;
}
export interface Brand { id: string; name: string; slug: string; imageUrl?: string | null }

export function productImage(product: Pick<Product, 'imageUrl' | 'images'>) {
  return (
    product.imageUrl ??
    product.images?.find((image) => /^https?:\/\//.test(image.url))?.url ??
    null
  );
}

export function money(value: string | number | bigint, currency = 'GBP') {
  const minor = typeof value === 'bigint' ? Number(value) : Number(value);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(minor / 100);
}

export async function serverApi<T>(path: string, headers?: HeadersInit): Promise<T | null> {
  try {
    const init: RequestInit = { cache: 'no-store' };
    if (headers) init.headers = headers;
    const response = await fetch(`${API_BASE}${path}`, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function browserApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/store${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...authHeader(), ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.message ?? data.error?.message ?? 'Request failed');
  return data;
}

export function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('denes_access_token');
  return token ? { authorization: `Bearer ${token}` } : {};
}
