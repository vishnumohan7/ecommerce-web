import { readableApiError } from './error-message';

const API_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

export interface Product {
  id: string;
  categoryId: string;
  brandId: string | null;
  sku: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  priceMinor: string;
  currency: string;
  vatRateBps: number;
  taxCategory: 'STANDARD_20' | 'REDUCED_5' | 'ZERO' | 'EXEMPT';
  pricingMode: 'UNIT' | 'WEIGHT_ESTIMATED';
  pricePerKgMinor: string | null;
  estimatedWeightGrams: number | null;
  weightToleranceBps: number | null;
  unitPriceDisplay: string;
  storageType: string;
  dietaryTags: string[];
  allergens: string[];
  isAlcohol: boolean;
  abv: string | null;
  alcoholType: 'BEER' | 'WINE' | 'SPIRITS' | 'CIDER' | 'OTHER' | null;
  ageRestriction: number;
  restrictionReason: string;
  returnPolicy:
    'STANDARD_14_DAY' | 'PERISHABLE_EXEMPT' | 'AGE_RESTRICTED_RESTRICTED' | 'NON_RETURNABLE';
  hfssStatus: 'NOT_IN_SCOPE' | 'IN_SCOPE';
  hfssCategory: string | null;
  countryOfOrigin: string;
  shelfLifeDays: number | null;
  ratingAverageBps: number;
  ratingCount: number;
  imageUrl?: string | null;
  variants?: Array<{
    id: string;
    sku: string;
    name: string;
    priceMinor: string;
    currency: string;
    packSize: string | null;
    weightGrams: number | null;
    abv: string | null;
    flavour: string | null;
    attributes: Record<string, string>;
    active: boolean;
  }>;
  images?: Array<{
    id: string;
    url: string;
    altText: string;
    position: number;
  }>;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  active: boolean;
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
export interface NumberedPageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  imageUrl: string | null;
  path: string;
  position: number;
  active: boolean;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
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

export type OrderCategory = 'GROCERY' | 'ALCOHOL';

export interface OrderSummary {
  id: string;
  displayOrderNumber: string;
  createdAt: string;
  basketType: 'GROCERY' | 'ALCOHOL' | 'MIXED';
  totalMinor: string;
  currency: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  ageVerificationStatus: string;
  deliveryAgeCheckStatus: string;
  label: string;
}

export interface OrderLine {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceMinor: string;
  lineTotalMinor: string;
  currency: string;
  vatRateBps: number;
  orderCategory: OrderCategory;
  ageRestriction: number;
  abv: string | null;
  unitPriceDisplay: string;
}

export interface FulfilmentGroup {
  id: string;
  category: OrderCategory;
  status: string;
  updatedAt: string;
}
export interface PickList {
  id: string;
  status: string;
  items: Array<{
    id: string;
    requested: number;
    picked: number;
    outcome: string | null;
    completedAt: string | null;
    storageType: string;
    aisle: string;
    orderItem: OrderLine | null;
  }>;
}

export interface OrderDetail extends OrderSummary {
  subtotalMinor: string;
  discountMinor: string;
  taxMinor: string;
  deliveryFeeMinor: string;
  refundStatus: string;
  deliveryAddress: Record<string, unknown>;
  customerSnapshot: Record<string, unknown>;
  sections: { grocery: OrderLine[]; alcohol: OrderLine[] };
  fulfilmentGroups: FulfilmentGroup[];
  payment: {
    id: string;
    provider: string;
    status: string;
    capturedAmountMinor: string;
    refundedAmountMinor: string;
  } | null;
  invoice: { id: string; displayInvoiceNumber: string; issuedAt: string } | null;
}

export type ReturnRequestStatus =
  'REQUESTED' | 'APPROVED' | 'REJECTED' | 'REFUND_PENDING' | 'COMPLETED';

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
  status: ReturnRequestStatus;
  reason: string;
  customerNote: string | null;
  adminNote: string | null;
  disposition: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RefundDetail {
  id: string;
  orderId: string;
  returnRequestId: string | null;
  method: 'CARD' | 'STORE_CREDIT';
  amountMinor: string;
  currency: string;
  status: string;
  reason: string;
  createdAt: string;
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    amountMinor: string;
    vatPortionMinor: string;
  }>;
}

export interface DashboardMetrics {
  orders: number;
  revenueMinor: string;
  averageOrderValueMinor: string;
  newCustomers: number;
  repeatCustomers: number;
  unitsSold: number;
  lowStock: number;
  refunds: number;
  refundAmountMinor: string;
  couponUsage: number;
  basketSplit: { grocery: number; alcohol: number; mixed: number };
}
export interface SalesReport {
  orders: number;
  totalRevenueMinor: string;
  groceryRevenueMinor: string;
  alcoholRevenueMinor: string;
  units: { grocery: number; alcohol: number };
  basketCounts: { grocery: number; alcohol: number; mixed: number };
}
export interface ReportFilters {
  from?: string;
  to?: string;
  productId?: string;
  categoryId?: string;
  customerId?: string;
  couponId?: string;
  basketType?: string;
  paymentStatus?: string;
  fulfilmentStatus?: string;
}
export interface CustomerSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  active: boolean;
  tombstonedAt: string | null;
  createdAt: string;
  orderCount: number;
  spendMinor: string;
}
export interface CustomerDetail extends Omit<CustomerSummary, 'orderCount' | 'spendMinor'> {
  updatedAt: string;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    postcode: string;
    country: string;
    isDefault: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: number;
    orderNumberYear: number;
    totalMinor: string;
    paymentStatus: string;
    fulfilmentStatus: string;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    productId: string;
    rating: number;
    title: string | null;
    body: string;
    status: string;
    createdAt: string;
  }>;
}
export interface InventoryRow {
  id: string;
  productId: string;
  variantId: string | null;
  warehouseId: string;
  onHand: number;
  reserved: number;
  stockAvailable: number;
  lowStockThreshold: number;
  updatedAt: string;
  product?: { id: string; name: string; sku: string } | null;
}
export interface AuditRow {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  requestId: string;
  createdAt: string;
}
export interface AdminSettings {
  settings: Record<string, unknown>;
  settingsVersion: number;
  branding: null | {
    brandName: string;
    legalEntityName: string;
    companyNumber: string | null;
    vatNumber: string | null;
    registeredAddress: Record<string, unknown>;
    assets: Record<string, unknown>;
    colours: Record<string, unknown>;
    typography: Record<string, unknown>;
    emailBranding: Record<string, unknown>;
  };
  integrations: {
    email: {
      provider: 'LOG' | 'RESEND' | 'SMTP';
      fromName: string;
      fromEmail: string;
      replyTo: string;
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      smtpUsername: string;
      smtpPasswordConfigured: boolean;
      resendApiKeyConfigured: boolean;
    };
    socialLogin: {
      googleEnabled: boolean;
      googleClientId: string;
      googleClientSecretConfigured: boolean;
      appleEnabled: boolean;
      appleClientId: string;
      appleTeamId: string;
      appleKeyId: string;
      applePrivateKeyConfigured: boolean;
    };
  };
}
export interface RbacData {
  permissions: Array<{ id: string; key: string; description: string }>;
  roles: Array<{
    id: string;
    key: string;
    name: string;
    description: string;
    system: boolean;
    permissionKeys: string[];
  }>;
  assignments: Array<{ userId: string; roleId: string }>;
  users: Array<{ id: string; email: string; firstName: string; lastName: string; active: boolean }>;
}
export interface ReviewRow {
  id: string;
  userId: string;
  productId: string;
  orderId: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  moderationReason: string | null;
  createdAt: string;
}
export interface PromotionRow {
  id: string;
  name: string;
  type: string;
  priority: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
}
export interface NotificationTemplateRow {
  id: string;
  event: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  version: number;
  active: boolean;
  createdAt: string;
}
export interface NotificationDeliveryRow {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}
export interface ContentData {
  banners: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    position: number;
    active: boolean;
    startsAt: string | null;
    endsAt: string | null;
    imageUrl: string;
    mobileImageUrl: string | null;
    linkUrl: string | null;
  }>;
  blocks: Array<{
    id: string;
    type: string;
    title: string | null;
    position: number;
    active: boolean;
    content: Record<string, unknown>;
  }>;
  pages: Array<{
    id: string;
    type: string;
    locale: string;
    title: string;
    published: boolean;
    updatedAt: string;
    content: string;
  }>;
}
export interface PrivacyRequestRow {
  id: string;
  userId: string;
  type: 'EXPORT' | 'ERASURE';
  status: string;
  adminNote: string | null;
  deadlineAt: string;
  completedAt: string | null;
  createdAt: string;
}
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function get<T>(path: string, admin = false): Promise<ApiResult<T>> {
  try {
    const token = admin ? await adminToken() : undefined;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(admin && token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(admin ? 20_000 : 8_000),
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
  const token = await adminToken();
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
      const payload: unknown = await response.json().catch(() => null);
      return {
        ok: false,
        error: readableApiError(payload, response.status),
      };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The API request failed.' };
  }
}

export async function adminFormMutation<T>(path: string, body: FormData): Promise<ApiResult<T>> {
  const token = await adminToken();
  if (!token)
    return { ok: false, error: 'ADMIN_API_TOKEN is not configured for write operations.' };
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      return { ok: false, error: readableApiError(payload, response.status) };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The upload failed.' };
  }
}

async function adminToken() {
  const cookieStore = await cookies();
  return cookieStore.get('denes_admin_access')?.value ?? process.env.ADMIN_API_TOKEN;
}

export function fetchHealth(kind: 'health' | 'ready' = 'health') {
  return get<{ status: string; checks?: string[] }>(`/${kind}`);
}
export function fetchProducts() {
  return get<Product[]>('/api/v1/products');
}
export function fetchAdminProducts(filters: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sort?: string;
} = {}) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 25),
  });
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort) params.set('sort', filters.sort);
  return get<NumberedPageResult<Product>>(`/api/v1/admin/catalog/products?${params}`, true);
}
export function fetchProduct(id: string) {
  return get<Product>(`/api/v1/products/${encodeURIComponent(id)}`, true);
}
export function fetchCategories() {
  return get<PageResult<Category>>('/api/v1/categories?limit=100');
}
export function fetchCategory(id: string) {
  return get<Category>(`/api/v1/categories/${encodeURIComponent(id)}`);
}
export function fetchBrands() {
  return get<PageResult<Brand>>('/api/v1/brands?limit=100');
}
export function fetchBrand(id: string) {
  return get<Brand>(`/api/v1/brands/${encodeURIComponent(id)}`);
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
export function fetchOrders(filters: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams({ page: filters.page ?? '1', pageSize: filters.pageSize ?? '25' });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return get<NumberedPageResult<OrderSummary>>(`/api/v1/admin/orders${query}`, true);
}
export function fetchOrder(id: string) {
  return get<OrderDetail>(`/api/v1/admin/orders/${encodeURIComponent(id)}`, true);
}
export function fetchPickList(id: string) {
  return get<PickList>(`/api/v1/admin/orders/${encodeURIComponent(id)}/pick-list`, true);
}
export function fetchReturns(filters: { status?: string; orderId?: string; page?: number } = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: '25' });
  if (filters.status) params.set('status', filters.status);
  if (filters.orderId) params.set('orderId', filters.orderId);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return get<NumberedPageResult<ReturnRequest>>(`/api/v1/admin/returns${query}`, true);
}
export function fetchRefund(id: string) {
  return get<RefundDetail>(`/api/v1/admin/refunds/${encodeURIComponent(id)}`, true);
}
export function fetchSearch(query: string) {
  const params = new URLSearchParams({ limit: '50', sort: query ? 'relevance' : 'name-asc' });
  if (query) params.set('q', query);
  return get<SearchResponse>(`/api/v1/search?${params}`);
}
export function fetchDashboard() {
  return get<DashboardMetrics>('/api/v1/admin/dashboard', true);
}
function reportQuery(filters: ReportFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.size ? `?${params}` : '';
}
export function fetchSalesReport(filters: ReportFilters = {}) {
  return get<SalesReport>(`/api/v1/admin/reports/sales${reportQuery(filters)}`, true);
}
export function fetchCustomerReport(filters: ReportFilters = {}) {
  return get<{
    customers: number;
    repeatCustomers: number;
    topCustomers: Array<{
      userId: string;
      email: string | null;
      name: string | null;
      orders: number;
      spendMinor: string;
    }>;
  }>(`/api/v1/admin/reports/customers${reportQuery(filters)}`, true);
}
export function fetchProductReport(filters: ReportFilters = {}) {
  return get<
    Array<{ productId: string; name: string; sku: string; units: number; revenueMinor: string }>
  >(`/api/v1/admin/reports/products${reportQuery(filters)}`, true);
}
export function fetchCouponReport(filters: ReportFilters = {}) {
  return get<Array<{ couponId: string; code: string; uses: number; discountMinor: string }>>(
    `/api/v1/admin/reports/coupons${reportQuery(filters)}`,
    true,
  );
}
export function fetchCategoryReport(filters: ReportFilters = {}) {
  return get<Array<{ categoryId: string; name: string; units: number; revenueMinor: string }>>(
    `/api/v1/admin/reports/categories${reportQuery(filters)}`,
    true,
  );
}
export function fetchInfluencerReport(id: string) {
  return get<{
    orders: number;
    revenueMinor: string | null;
    commissionMinor: string | null;
    currency: string;
  }>(`/api/v1/admin/influencers/${encodeURIComponent(id)}/report`, true);
}
export function fetchCustomerPage(filters: { q?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 25) });
  if (filters.q) params.set('q', filters.q);
  return get<NumberedPageResult<CustomerSummary>>(`/api/v1/admin/customers?${params}`, true);
}
export async function fetchCustomers(query = '') {
  const result = await fetchCustomerPage({ q: query, pageSize: 100 });
  return result.ok ? { ok: true as const, data: result.data.items } : result;
}
export function fetchCustomer(id: string) {
  return get<CustomerDetail>(`/api/v1/admin/customers/${encodeURIComponent(id)}`, true);
}
export function fetchInventory(productId = '') {
  return get<InventoryRow[]>(
    `/api/v1/inventory${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`,
    true,
  );
}
export function fetchInventoryPage(filters: { page?: number; pageSize?: number; q?: string } = {}) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 25),
  });
  if (filters.q) params.set('q', filters.q);
  return get<NumberedPageResult<InventoryRow>>(`/api/v1/inventory?${params}`, true);
}
export function fetchWarehouses() {
  return get<Warehouse[]>('/api/v1/inventory/warehouses', true);
}
export function fetchAuditLog(filters: { page?: number; entity?: string; action?: string } = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: '25' });
  if (filters.entity) params.set('entity', filters.entity);
  if (filters.action) params.set('action', filters.action);
  return get<NumberedPageResult<AuditRow>>(`/api/v1/admin/audit-log?${params}`, true);
}
export function fetchAdminSettings() {
  return get<AdminSettings>('/api/v1/admin/settings', true);
}
export function fetchRbac() {
  return get<RbacData>('/api/v1/admin/rbac', true);
}
export function fetchReviews(filters: { status?: string; page?: number } = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: '25' });
  if (filters.status) params.set('status', filters.status);
  return get<NumberedPageResult<ReviewRow>>(`/api/v1/admin/reviews?${params}`, true);
}
export function fetchPromotions(page = 1) {
  return get<NumberedPageResult<PromotionRow>>(`/api/v1/promotions?page=${String(page)}&pageSize=25`, true);
}
export function fetchNotificationTemplates() {
  return get<NotificationTemplateRow[]>('/api/v1/admin/notification-templates', true);
}
export function fetchNotificationDeliveries() {
  return get<NotificationDeliveryRow[]>('/api/v1/admin/notification-deliveries', true);
}
export function fetchContent() {
  return get<ContentData>('/api/v1/admin/content', true);
}
export function fetchPrivacyRequests() {
  return get<PrivacyRequestRow[]>('/api/v1/admin/privacy/requests', true);
}
export { API_BASE_URL };
import 'server-only';
import { cookies } from 'next/headers';
