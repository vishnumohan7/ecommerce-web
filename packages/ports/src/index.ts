export type InjectionToken = symbol;
export interface ProviderContract {
  health(): Promise<{ ok: boolean }>;
}
export const providerNames = [
  'Payment',
  'Wallet',
  'AgeVerification',
  'AddressLookup',
  'Email',
  'Sms',
  'Push',
  'WhatsApp',
  'Storage',
  'Image',
  'Search',
  'CacheQueue',
  'Dispatch',
  'Geo',
  'ErrorMonitoring',
  'Telemetry',
  'Analytics',
  'Flag',
  'Pdf',
  'Accounting',
  'AbuseProtection',
  'Secrets',
  'ReviewSyndication',
  'SupportWidget',
] as const;
export type ProviderName = (typeof providerNames)[number];
export const TOKENS: Readonly<Record<ProviderName, InjectionToken>> = Object.freeze(
  Object.fromEntries(providerNames.map((name) => [name, Symbol.for(`port.${name}`)])) as Record<
    ProviderName,
    InjectionToken
  >,
);
export type PaymentProvider = ProviderContract;
export type WalletProvider = ProviderContract;
export type AgeVerificationOutcome = 'PENDING' | 'PASSED' | 'FAILED' | 'CANCELLED';
export interface AgeVerificationContext {
  requiredAge: number;
  dateOfBirth?: string;
  returnUrl?: string;
  postcode?: string;
}
export interface AgeVerificationResult {
  sessionId: string;
  outcome: AgeVerificationOutcome;
  verifiedAgeOver?: number;
  method: 'DOB_DECLARATION' | 'DVS' | 'MANUAL_REVIEW';
  providerRef?: string;
  redirectUrl?: string;
}
export interface AgeVerificationProvider extends ProviderContract {
  readonly name: string;
  initiate(subjectId: string, context: AgeVerificationContext): Promise<AgeVerificationResult>;
  getResult(sessionId: string): Promise<AgeVerificationResult>;
  handleWebhook(payload: Uint8Array, signature: string): Promise<AgeVerificationResult>;
}
export type AddressLookupProvider = ProviderContract;
export type EmailProvider = ProviderContract;
export type SmsProvider = ProviderContract;
export type PushProvider = ProviderContract;
export type WhatsAppProvider = ProviderContract;
export type StorageProvider = ProviderContract;
export type ImageProvider = ProviderContract;
export type SearchSort = 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'rating-desc';
export interface SearchRequest {
  tenantId: string;
  query?: string;
  limit: number;
  cursor?: string;
  sort: SearchSort;
  allowAlcohol: boolean;
  categoryIds?: string[];
  brandIds?: string[];
  minimumPriceMinor?: bigint;
  maximumPriceMinor?: bigint;
  inStock?: boolean;
  dietaryTags?: string[];
  allergenFree?: string[];
  alcohol?: boolean;
  minimumAbv?: string;
  maximumAbv?: string;
  storageTypes?: string[];
  minimumRatingBps?: number;
  onOffer?: boolean;
  synonyms?: string[];
}
export interface SearchHit {
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
  priceMinor: string;
  currency: string;
  isAlcohol: boolean;
  abv: string | null;
  dietaryTags: string[];
  allergens: string[];
  storageType: string;
  ratingAverageBps: number;
  ratingCount: number;
  inStock: boolean;
  onOffer: boolean;
  rank: number;
}
export interface SearchFacetValue {
  value: string;
  count: number;
}
export interface SearchResponse {
  items: SearchHit[];
  nextCursor: string | null;
  facets: Record<string, SearchFacetValue[]>;
  resultCount: number;
}
export interface SearchProvider extends ProviderContract {
  search(request: SearchRequest): Promise<SearchResponse>;
  autocomplete(
    request: Pick<SearchRequest, 'tenantId' | 'query' | 'limit' | 'allowAlcohol' | 'synonyms'>,
  ): Promise<string[]>;
  upsert(document: SearchHit): Promise<void>;
  remove(tenantId: string, productId: string): Promise<void>;
}
export type CacheQueueProvider = ProviderContract;
export type DispatchProvider = ProviderContract;
export type GeoProvider = ProviderContract;
export type ErrorMonitoringProvider = ProviderContract;
export type TelemetryProvider = ProviderContract;
export type AnalyticsProvider = ProviderContract;
export type FlagProvider = ProviderContract;
export type PdfProvider = ProviderContract;
export type AccountingProvider = ProviderContract;
export type AbuseProtectionProvider = ProviderContract;
export type SecretsProvider = ProviderContract;
export type ReviewSyndicationProvider = ProviderContract;
export type SupportWidgetProvider = ProviderContract;
export function providerContractSuite(name: ProviderName, factory: () => ProviderContract): void {
  describe(name, () => {
    it('reports health', async () => {
      expect(await factory().health()).toEqual({ ok: true });
    });
  });
}
declare const describe: (name: string, body: () => void) => void;
declare const it: (name: string, body: () => Promise<void>) => void;
declare const expect: (value: unknown) => { toEqual(expected: unknown): void };
