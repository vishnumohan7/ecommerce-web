import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = 'https://api-theta-jade-1ftquke8hz.vercel.app';
const generatedAt = '2026-10-11T00:00:00.000Z';
const outputDirectory = new URL('../docs/postman/', import.meta.url);

const response = await fetch(`${baseUrl}/api/docs-json`);
if (!response.ok) throw new Error(`Unable to read deployed OpenAPI: HTTP ${response.status}`);
const openapi = await response.json();

const ids = [
  'productId',
  'variantId',
  'imageId',
  'mediaId',
  'categoryId',
  'brandId',
  'attributeSetId',
  'warehouseId',
  'inventoryId',
  'promotionId',
  'couponId',
  'influencerId',
  'taxRuleId',
  'zoneId',
  'slotId',
  'orderId',
  'fulfilmentGroupId',
  'pickItemId',
  'returnId',
  'refundId',
  'customerId',
  'reviewId',
  'bannerId',
  'roleId',
  'userId',
  'templateId',
  'deliveryId',
  'privacyRequestId',
  'synonymId',
  'importId',
  'staffUserId',
];

const samples = {
  login: { email: '<ADMIN_EMAIL>', password: '<ADMIN_PASSWORD>' },
  refresh: { refreshToken: '{{refreshToken}}' },
  product: {
    categoryId: '{{categoryId}}',
    brandId: '{{brandId}}',
    sku: 'POSTMAN-PRODUCT-001',
    slug: 'postman-product-001',
    name: 'Postman Product',
    description: 'Product created during manual API testing.',
    priceMinor: '499',
    currency: 'GBP',
    vatRateBps: 2000,
    taxCategory: 'STANDARD_20',
    pricingMode: 'UNIT',
    pricePerKgMinor: null,
    estimatedWeightGrams: null,
    weightToleranceBps: null,
    abv: null,
    alcoholType: null,
    weightGrams: 500,
    ageRestriction: 0,
    restrictionReason: 'NONE',
    returnPolicy: 'STANDARD_14_DAY',
    unitPriceDisplay: 'GBP 4.99 each',
    hfssStatus: 'NOT_IN_SCOPE',
    hfssCategory: null,
    dietaryTags: [],
    allergens: [],
    countryOfOrigin: 'GB',
    storageType: 'AMBIENT',
    shelfLifeDays: 365,
  },
  variant: {
    sku: 'POSTMAN-PRODUCT-001-SINGLE',
    name: 'Single pack',
    priceMinor: '499',
    currency: 'GBP',
    packSize: '1 pack',
    weightGrams: 500,
    abv: null,
    flavour: null,
    attributes: { size: 'single' },
    warehouseId: '{{warehouseId}}',
    stockOnHand: 20,
    lowStockThreshold: 5,
  },
  category: {
    parentId: null,
    slug: 'postman-category',
    name: 'Postman Category',
    position: 99,
    active: true,
  },
  brand: { slug: 'postman-brand', name: 'Postman Brand' },
  attributeSet: {
    key: 'pack_details',
    name: 'Pack details',
    definitions: [{ key: 'size', label: 'Size', type: 'TEXT', required: true }],
  },
  synonym: { terms: ['soft drink', 'soda', 'pop'], enabled: true },
  inventory: {
    productId: '{{productId}}',
    warehouseId: '{{warehouseId}}',
    onHand: 20,
    lowStockThreshold: 5,
  },
  reserve: { quantity: 2, reference: 'POSTMAN-STOCK-001' },
  adjust: { quantity: 5, reason: 'ADJUSTMENT', reference: 'POSTMAN-ADJUST-001' },
  promotion: {
    name: 'Postman 10 Percent Promotion',
    type: 'PERCENTAGE',
    startsAt: '2026-10-11T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
    productIds: ['{{productId}}'],
    conditions: {},
    effect: { percentageBps: 1000 },
  },
  coupon: {
    code: 'POSTMAN10',
    type: 'PERCENTAGE',
    valueBps: 1000,
    valueMinor: null,
    currency: 'GBP',
    minimumSpendMinor: '2000',
    maximumDiscountMinor: '1000',
    startsAt: '2026-10-11T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
    maxUses: 100,
    couponClass: 'SITE_WIDE',
    appliesTo: 'BOTH',
    perCustomerLimit: 1,
    firstOrderOnly: false,
    productIds: [],
    categoryIds: [],
    brandIds: [],
    attributionWindowDays: 30,
  },
  influencer: {
    code: 'CREATOR10',
    displayName: 'Sample Creator',
    commissionBps: 500,
    active: true,
  },
  taxRule: {
    taxCategory: 'STANDARD_20',
    rateBps: 2000,
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    effectiveTo: null,
    active: true,
  },
  zone: {
    code: 'LONDON_1',
    name: 'Central London',
    postcodePatterns: ['SW1*'],
    postcodeIncludes: [],
    postcodeExcludes: [],
    groceryFeeMinor: 299,
    alcoholFeeMinor: 399,
    freeDeliveryThresholdMinor: 4000,
    minimumOrderMinor: 1000,
    maximumOrderMinor: null,
    alcoholMinimumSubtotalMinor: null,
    feeSchedule: [],
    supportedStorageTypes: ['AMBIENT', 'CHILLED', 'FROZEN'],
    currency: 'GBP',
    alcoholDeliveryAllowed: true,
    active: true,
  },
  slot: {
    zoneId: '{{zoneId}}',
    startsAt: '2026-10-20T10:00:00.000Z',
    endsAt: '2026-10-20T12:00:00.000Z',
    capacity: 20,
    surchargeMinor: 0,
    cutoffMinutes: 120,
    allowsAgeRestricted: true,
    active: true,
  },
  fulfilment: { status: 'PICKING' },
  pickItem: { outcome: 'PICKED', picked: 1, actualWeightGrams: 500 },
  capture: { recomputedAmountMinor: '1499' },
  ageCheck: {
    orderId: '{{orderId}}',
    outcome: 'PASSED',
    challengeAge: 25,
    idType: 'PASSPORT',
    recipientPresent: true,
    note: 'Manual test; no ID number retained',
  },
  returnReview: { status: 'APPROVED', adminNote: 'Evidence checked', disposition: 'WRITE_OFF' },
  refund: {
    orderId: '{{orderId}}',
    returnRequestId: '{{returnId}}',
    idempotencyKey: 'postman-refund-0001',
    reason: 'Approved returned item',
    method: 'CARD',
    items: [{ orderItemId: '<ORDER_ITEM_UUID>', quantity: 1 }],
  },
  customer: { firstName: 'Manual', lastName: 'Tester', phone: '+447700900123', active: true },
  moderation: { status: 'APPROVED', reason: 'Verified purchase and acceptable content' },
  banner: {
    title: 'Postman Banner',
    subtitle: 'Manual testing banner',
    imageUrl: 'https://example.test/banner.jpg',
    mobileImageUrl: null,
    linkUrl: 'https://example.test/offers',
    position: 1,
    startsAt: null,
    endsAt: null,
    active: true,
  },
  block: {
    type: 'FEATURED_PRODUCTS',
    title: 'Featured products',
    content: { productIds: ['{{productId}}'] },
    position: 1,
    startsAt: null,
    endsAt: null,
    active: true,
  },
  page: {
    type: 'TERMS',
    locale: 'en-GB',
    title: 'Terms and Conditions',
    content: '<p>Approved content</p>',
    published: true,
  },
  template: {
    event: 'ORDER_CONFIRMED',
    channel: 'EMAIL',
    locale: 'en-GB',
    subject: 'Order {{orderNumber}} confirmed',
    body: 'Hello {{firstName}}, your order is confirmed.',
    mjml: null,
  },
  preview: {
    subject: 'Order {{orderNumber}} confirmed',
    body: 'Hello {{firstName}}',
    data: { orderNumber: 'DEN-1001', firstName: 'Manual' },
  },
  testSend: {
    recipient: 'tester@example.test',
    data: { orderNumber: 'DEN-1001', firstName: 'Manual' },
  },
  role: { permissionKeys: ['catalog.read', 'catalog.write', 'inventory.read', 'orders.read'] },
  userRole: { roleKeys: ['CATALOG_MANAGER'] },
  staffCreate: {
    email: 'staff@example.test',
    firstName: 'Store',
    lastName: 'Operator',
    roleKeys: ['STORE_MANAGER'],
  },
  staffUpdate: {
    firstName: 'Store',
    lastName: 'Operator',
    active: true,
    roleKeys: ['STORE_MANAGER'],
  },
  settings: { settings: { minimumOrderMinor: 2000, supportEmail: 'support@example.test' } },
  privacy: { status: 'IN_REVIEW', adminNote: 'Identity check started' },
};

function inAdminScope(method, path) {
  if (path.startsWith('/api/v1/admin/')) return true;
  if (['/health', '/ready'].includes(path)) return method === 'GET';
  if (
    [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/me',
    ].includes(path)
  )
    return true;
  return /^\/api\/v1\/(products|categories|brands|attribute-sets|inventory|promotions|catalog\/imports|search\/synonyms|delivery-age-check|media\/)/.test(
    path,
  );
}

function folder(path) {
  if (
    path === '/health' ||
    path === '/ready' ||
    path.includes('/auth/') ||
    path.includes('/media/')
  )
    return '01 - Authentication and system';
  if (path.includes('/reports/') || path.endsWith('/dashboard'))
    return '02 - Dashboard and reports';
  if (path.includes('/products')) return '03 - Products, variants and media';
  if (/\/(categories|brands|attribute-sets)/.test(path))
    return '04 - Categories, brands and attributes';
  if (path.includes('/catalog/imports') || path.includes('/search/synonyms'))
    return '05 - Imports and search synonyms';
  if (path.includes('/inventory')) return '06 - Inventory';
  if (path.includes('/promotions')) return '07 - Promotions';
  if (/\/(coupons|influencers|tax-rules)/.test(path)) return '08 - Pricing, coupons and tax';
  if (path.includes('/delivery/')) return '09 - Delivery administration';
  if (
    path.includes('/orders') ||
    path.includes('/payments/') ||
    path.includes('/compliance/') ||
    path.includes('/delivery-age-check')
  )
    return '10 - Orders and fulfilment';
  if (path.includes('/returns') || path.includes('/refunds')) return '11 - Returns and refunds';
  if (path.includes('/customers') || path.includes('/reviews')) return '12 - Customers and reviews';
  if (path.includes('/content')) return '13 - Content management';
  if (path.includes('/notification')) return '14 - Notifications';
  return '15 - RBAC, settings, audit and privacy';
}

function variablePath(path) {
  const replacements = [
    [/\/products\/\{id\}/, '/products/{{productId}}'],
    [/\/categories\/\{id\}/, '/categories/{{categoryId}}'],
    [/\/brands\/\{id\}/, '/brands/{{brandId}}'],
    [/\/attribute-sets\/\{id\}/, '/attribute-sets/{{attributeSetId}}'],
    [/\/inventory\/\{id\}/, '/inventory/{{inventoryId}}'],
    [/\/promotions\/\{id\}/, '/promotions/{{promotionId}}'],
    [/\/catalog\/imports\/\{id\}/, '/catalog/imports/{{importId}}'],
    [/\/search\/synonyms\/\{id\}/, '/search/synonyms/{{synonymId}}'],
    [/\/coupons\/\{id\}/, '/coupons/{{couponId}}'],
    [/\/influencers\/\{id\}/, '/influencers/{{influencerId}}'],
    [/\/delivery\/zones\/\{id\}/, '/delivery/zones/{{zoneId}}'],
    [/\/delivery\/slots\/\{id\}/, '/delivery/slots/{{slotId}}'],
    [/\/payments\/\{orderId\}/, '/payments/{{orderId}}'],
    [/\/orders\/\{orderId\}/, '/orders/{{orderId}}'],
    [/\/orders\/\{id\}/, '/orders/{{orderId}}'],
    [/\/fulfilment-groups\/\{groupId\}/, '/fulfilment-groups/{{fulfilmentGroupId}}'],
    [/\/items\/\{itemId\}/, '/items/{{pickItemId}}'],
    [/\/returns\/\{id\}/, '/returns/{{returnId}}'],
    [/\/refunds\/\{id\}/, '/refunds/{{refundId}}'],
    [/\/customers\/\{id\}/, '/customers/{{customerId}}'],
    [/\/reviews\/\{id\}/, '/reviews/{{reviewId}}'],
    [/\/content\/banners\/\{id\}/, '/content/banners/{{bannerId}}'],
    [/\/rbac\/roles\/\{id\}/, '/rbac/roles/{{roleId}}'],
    [/\/rbac\/users\/\{id\}/, '/rbac/users/{{userId}}'],
    [/\/staff\/\{id\}/, '/staff/{{staffUserId}}'],
    [/\/notification-templates\/\{id\}/, '/notification-templates/{{templateId}}'],
    [/\/notification-deliveries\/\{id\}/, '/notification-deliveries/{{deliveryId}}'],
    [/\/privacy\/requests\/\{id\}/, '/privacy/requests/{{privacyRequestId}}'],
    [/\/media\/\{id\}/, '/media/{{mediaId}}'],
    [/\/images\/\{imageId\}/, '/images/{{imageId}}'],
    [/\/variants\/\{variantId\}/, '/variants/{{variantId}}'],
  ];
  return replacements.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    path,
  );
}

function queryFor(method, path) {
  const values =
    {
      'GET /api/v1/admin/catalog/products': [
        ['page', '1'],
        ['pageSize', '25'],
        ['q', ''],
        ['status', 'ALL'],
        ['sort', 'newest'],
      ],
      'GET /api/v1/products': [['alcohol', 'false']],
      'GET /api/v1/categories': [['limit', '50']],
      'GET /api/v1/brands': [['limit', '50']],
      'GET /api/v1/attribute-sets': [['limit', '50']],
      'POST /api/v1/catalog/imports': [
        ['duplicatePolicy', 'fail'],
        ['dryRun', 'true'],
      ],
      'GET /api/v1/inventory': [
        ['page', '1'],
        ['pageSize', '25'],
        ['q', ''],
      ],
      'GET /api/v1/promotions': [
        ['page', '1'],
        ['pageSize', '25'],
      ],
      'GET /api/v1/admin/dashboard': [
        ['from', '2026-10-01'],
        ['to', '2026-10-31'],
      ],
      'GET /api/v1/admin/orders': [
        ['page', '1'],
        ['pageSize', '25'],
      ],
      'GET /api/v1/admin/returns': [
        ['page', '1'],
        ['pageSize', '25'],
      ],
      'GET /api/v1/admin/customers': [
        ['page', '1'],
        ['pageSize', '25'],
        ['q', ''],
      ],
      'GET /api/v1/admin/reviews': [
        ['page', '1'],
        ['pageSize', '25'],
        ['status', 'PENDING'],
      ],
      'GET /api/v1/admin/notification-deliveries': [
        ['page', '1'],
        ['pageSize', '25'],
        ['status', ''],
        ['q', ''],
      ],
      'GET /api/v1/admin/audit-log': [
        ['page', '1'],
        ['pageSize', '25'],
      ],
      'GET /api/v1/admin/staff': [
        ['page', '1'],
        ['pageSize', '25'],
        ['q', ''],
      ],
      'GET /api/v1/admin/compliance/alcohol-day-book': [['date', '2026-10-11']],
      'GET /api/v1/admin/privacy/requests': [['status', 'IN_REVIEW']],
    }[`${method} ${path}`] ?? [];
  if (path.includes('/admin/reports/'))
    return [
      ['from', '2026-10-01'],
      ['to', '2026-10-31'],
    ];
  return values.map(([key, value]) => ({ key, value }));
}

function bodyFor(method, path) {
  if (!['POST', 'PATCH'].includes(method)) return undefined;
  if (path.endsWith('/auth/login')) return samples.login;
  if (path.endsWith('/auth/refresh') || path.endsWith('/auth/logout')) return samples.refresh;
  if (path === '/api/v1/products') return samples.product;
  if (/^\/api\/v1\/products\/\{id\}$/.test(path)) return samples.product;
  if (path.includes('/variants/{variantId}'))
    return { name: 'Case of 6', priceMinor: '1499', active: true };
  if (path.endsWith('/variants')) return samples.variant;
  if (path === '/api/v1/categories') return samples.category;
  if (path.includes('/categories/{id}')) return { name: 'Fresh Food', position: 2, active: true };
  if (path === '/api/v1/brands') return samples.brand;
  if (path.includes('/brands/{id}')) return { name: 'Updated Brand', slug: 'updated-brand' };
  if (path === '/api/v1/attribute-sets') return samples.attributeSet;
  if (path.includes('/attribute-sets/{id}')) return { name: 'Updated pack details' };
  if (path === '/api/v1/search/synonyms') return samples.synonym;
  if (path.includes('/search/synonyms/{id}')) return samples.synonym;
  if (path === '/api/v1/inventory') return samples.inventory;
  if (path.endsWith('/reservations') || path.endsWith('/releases')) return samples.reserve;
  if (path.endsWith('/adjustments')) return samples.adjust;
  if (/^\/api\/v1\/inventory\/\{id\}$/.test(path)) return { lowStockThreshold: 5 };
  if (path === '/api/v1/promotions') return samples.promotion;
  if (path.includes('/promotions/{id}'))
    return { active: true, priority: 10, endsAt: '2026-12-31T23:59:59.000Z' };
  if (path === '/api/v1/admin/coupons') return samples.coupon;
  if (path.includes('/admin/coupons/{id}')) return { active: false, maximumDiscountMinor: '1000' };
  if (path === '/api/v1/admin/influencers') return samples.influencer;
  if (path === '/api/v1/admin/tax-rules') return samples.taxRule;
  if (path === '/api/v1/admin/delivery/zones') return samples.zone;
  if (path.includes('/admin/delivery/zones/{id}')) return { groceryFeeMinor: 349, active: true };
  if (path === '/api/v1/admin/delivery/slots') return samples.slot;
  if (path.includes('/admin/delivery/slots/{id}')) return { capacity: 25, active: true };
  if (path.includes('/fulfilment-groups/')) return samples.fulfilment;
  if (path.includes('/pick-list/items/')) return samples.pickItem;
  if (path.includes('/admin/payments/')) return samples.capture;
  if (path.endsWith('/delivery-age-check')) return samples.ageCheck;
  if (path.includes('/admin/returns/{id}')) return samples.returnReview;
  if (path === '/api/v1/admin/refunds') return samples.refund;
  if (path.includes('/admin/orders/{orderId}/refunds')) {
    const body = { ...samples.refund };
    delete body.orderId;
    return body;
  }
  if (path.includes('/admin/customers/{id}')) return samples.customer;
  if (path.includes('/admin/reviews/{id}')) return samples.moderation;
  if (path.endsWith('/content/banners')) return samples.banner;
  if (path.includes('/content/banners/{id}'))
    return { title: 'Updated Postman Banner', active: true };
  if (path.endsWith('/content/blocks')) return samples.block;
  if (path.endsWith('/content/pages')) return samples.page;
  if (path === '/api/v1/admin/notification-templates') return samples.template;
  if (path.includes('/notification-templates/{id}/test')) return samples.testSend;
  if (path.includes('/notification-templates/{id}')) return samples.template;
  if (path.endsWith('/notification-templates/preview')) return samples.preview;
  if (path.includes('/rbac/roles/')) return samples.role;
  if (path.includes('/rbac/users/')) return samples.userRole;
  if (path === '/api/v1/admin/staff') return samples.staffCreate;
  if (/^\/api\/v1\/admin\/staff\/\{id\}$/.test(path)) return samples.staffUpdate;
  if (path.endsWith('/admin/settings')) return samples.settings;
  if (path.includes('/admin/privacy/requests/')) return samples.privacy;
  return undefined;
}

function multipartFor(path) {
  if (path.endsWith('/images'))
    return [
      { key: 'file', type: 'file', src: [] },
      { key: 'altText', type: 'text', value: 'Postman product image' },
      { key: 'featured', type: 'text', value: 'true' },
    ];
  if (path.endsWith('/image')) return [{ key: 'file', type: 'file', src: [] }];
  if (path === '/api/v1/catalog/imports') return [{ key: 'file', type: 'file', src: [] }];
  return undefined;
}

function isPublic(method, path, operation) {
  return (
    !operation.security?.length ||
    [
      '/health',
      '/ready',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/media/{id}',
      '/api/v1/products',
      '/api/v1/products/{id}',
      '/api/v1/categories',
      '/api/v1/categories/{id}',
      '/api/v1/brands',
      '/api/v1/brands/{id}',
    ].includes(path)
  );
}

function label(method, path, operation) {
  if (operation.summary) return operation.summary;
  return `${method} ${path.split('/').filter(Boolean).slice(-3).join(' / ')}`;
}

const folders = new Map();
for (const [path, operations] of Object.entries(openapi.paths)) {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const operation = operations[method.toLowerCase()];
    if (!operation || !inAdminScope(method, path)) continue;
    const renderedPath = variablePath(path);
    const query = queryFor(method, path);
    const rawUrl = `{{baseUrl}}${renderedPath}${query.length ? `?${query.map(({ key, value }) => `${key}=${value}`).join('&')}` : ''}`;
    const multipart = multipartFor(path);
    const sample = bodyFor(method, path);
    const request = {
      method,
      header: multipart ? [] : [{ key: 'Content-Type', value: 'application/json', type: 'text' }],
      url: {
        raw: rawUrl,
        host: ['{{baseUrl}}'],
        path: renderedPath.split('/').filter(Boolean),
        ...(query.length ? { query } : {}),
      },
      description: `${method} ${path}\n\nSee docs/ADMIN_API_ENDPOINTS.txt for permissions, validation rules and expected results.`,
    };
    if (isPublic(method, path, operation)) request.auth = { type: 'noauth' };
    if (multipart) request.body = { mode: 'formdata', formdata: multipart };
    else if (sample !== undefined)
      request.body = {
        mode: 'raw',
        raw: JSON.stringify(sample, null, 2),
        options: { raw: { language: 'json' } },
      };
    const events = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            "pm.test('No server error', function () { pm.expect(pm.response.code).to.be.below(500); });",
            "pm.test('Request ID is returned', function () { pm.expect(pm.response.headers.has('x-request-id')).to.eql(true); });",
          ],
        },
      },
    ];
    if (path === '/api/v1/auth/login' || path === '/api/v1/auth/refresh')
      events.push({
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            'if (pm.response.code >= 200 && pm.response.code < 300) {',
            '  const data = pm.response.json();',
            "  if (data.accessToken) pm.environment.set('accessToken', data.accessToken);",
            "  if (data.refreshToken) pm.environment.set('refreshToken', data.refreshToken);",
            '}',
          ],
        },
      });
    const item = { name: label(method, path, operation), request, event: events };
    const folderName = folder(path);
    if (!folders.has(folderName)) folders.set(folderName, []);
    folders.get(folderName).push(item);
  }
}

folders.get('01 - Authentication and system').unshift({
  name: 'Prometheus metrics',
  request: {
    method: 'GET',
    auth: { type: 'noauth' },
    header: [],
    url: { raw: '{{baseUrl}}/metrics', host: ['{{baseUrl}}'], path: ['metrics'] },
    description: 'GET /metrics',
  },
});

const collection = {
  info: {
    _postman_id: '7b1ec357-a2ac-4d6b-a8b0-b72cd79fd8e9',
    name: 'Denes Commerce - Admin API',
    description:
      'Admin-only manual testing collection generated from the deployed NestJS OpenAPI document. Customer storefront, cart and checkout routes are excluded.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          "if (!pm.environment.get('baseUrl')) pm.environment.set('baseUrl', 'https://api-theta-jade-1ftquke8hz.vercel.app');",
        ],
      },
    },
  ],
  item: [...folders.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, item]) => ({ name, item })),
  variable: [
    { key: 'baseUrl', value: baseUrl },
    { key: 'accessToken', value: '' },
    { key: 'refreshToken', value: '' },
    ...ids.map((key) => ({ key, value: '' })),
  ],
};

const environment = {
  id: '270a3c13-50f6-475d-bc37-8cc7d53863aa',
  name: 'Denes Commerce - Production API',
  values: [
    { key: 'baseUrl', value: baseUrl, enabled: true },
    { key: 'accessToken', value: '', enabled: true, type: 'secret' },
    { key: 'refreshToken', value: '', enabled: true, type: 'secret' },
    ...ids.map((key) => ({ key, value: '', enabled: true })),
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: generatedAt,
  _postman_exported_using: 'Codex admin OpenAPI generator',
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL('Denes_Admin_API.postman_collection.json', outputDirectory),
  `${JSON.stringify(collection, null, 2)}\n`,
);
await writeFile(
  new URL('Denes_Production_API.postman_environment.json', outputDirectory),
  `${JSON.stringify(environment, null, 2)}\n`,
);

console.log(
  `Generated ${collection.item.reduce((total, entry) => total + entry.item.length, 0)} requests in ${collection.item.length} folders.`,
);
