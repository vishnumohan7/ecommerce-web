import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const outputDirectory = new URL('../docs/postman/', import.meta.url);
mkdirSync(outputDirectory, { recursive: true });

const json = (value) => JSON.stringify(value, null, 2);
const tests = [
  "pm.test('No server error', () => pm.expect(pm.response.code).to.be.below(500));",
  "pm.test('Request ID is returned', () => pm.expect(pm.response.headers.has('x-request-id')).to.eql(true));",
];

function request(name, method, path, options = {}) {
  const headers =
    options.body === undefined ? [] : [{ key: 'Content-Type', value: 'application/json' }];
  const item = {
    name,
    request: {
      method,
      auth: options.auth
        ? { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] }
        : { type: 'noauth' },
      header: headers,
      url: `{{baseUrl}}${path}`,
      description: `${method} ${path}${options.note ? `\n\n${options.note}` : ''}`,
      ...(options.body === undefined
        ? {}
        : {
            body: { mode: 'raw', raw: json(options.body), options: { raw: { language: 'json' } } },
          }),
    },
    event: [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: [...tests, ...(options.after ?? [])] },
      },
    ],
  };
  return item;
}

const captureTokens = [
  'if (pm.response.code >= 200 && pm.response.code < 300) {',
  '  const data = pm.response.json();',
  "  if (data.accessToken) pm.environment.set('accessToken', data.accessToken);",
  "  if (data.refreshToken) pm.environment.set('refreshToken', data.refreshToken);",
  '}',
];
const capture = (variable, expression) => [
  'if (pm.response.code >= 200 && pm.response.code < 300) {',
  '  const data = pm.response.json();',
  `  const value = ${expression};`,
  `  if (value) pm.environment.set('${variable}', value);`,
  '}',
];

const folders = [
  {
    name: '01 - Authentication',
    item: [
      request('Register customer', 'POST', '/api/v1/auth/register', {
        body: {
          email: '{{customerEmail}}',
          password: '{{customerPassword}}',
          firstName: '{{firstName}}',
          lastName: '{{lastName}}',
        },
      }),
      request('Verify email', 'POST', '/api/v1/auth/verify-email', {
        body: { token: '{{emailVerificationToken}}' },
      }),
      request('Resend verification email', 'POST', '/api/v1/auth/verify-email/resend', {
        body: { email: '{{customerEmail}}' },
      }),
      request('Customer login', 'POST', '/api/v1/auth/login', {
        body: { email: '{{customerEmail}}', password: '{{customerPassword}}' },
        after: captureTokens,
      }),
      request('Current customer session', 'GET', '/api/v1/auth/me', { auth: true }),
      request('Rotate refresh token', 'POST', '/api/v1/auth/refresh', {
        body: { refreshToken: '{{refreshToken}}' },
        after: captureTokens,
      }),
      request('Request password reset', 'POST', '/api/v1/auth/password/forgot', {
        body: { email: '{{customerEmail}}' },
      }),
      request('Reset password', 'POST', '/api/v1/auth/password/reset', {
        body: { token: '{{passwordResetToken}}', password: '{{newCustomerPassword}}' },
      }),
      request('Request mobile OTP', 'POST', '/api/v1/auth/otp/request', {
        body: { phone: '{{customerPhone}}' },
        note: 'Requires a configured SMS provider for production delivery.',
        after: capture('otpChallengeId', 'data.challengeId'),
      }),
      request('Verify mobile OTP', 'POST', '/api/v1/auth/otp/verify', {
        body: { challengeId: '{{otpChallengeId}}', code: '{{otpCode}}' },
        after: captureTokens,
      }),
      request('Logout', 'POST', '/api/v1/auth/logout', {
        body: { refreshToken: '{{refreshToken}}' },
      }),
    ],
  },
  {
    name: '02 - Catalogue and search',
    item: [
      request('List products', 'GET', '/api/v1/products', {
        after: capture('productId', '(data.items ?? data)[0]?.id'),
      }),
      request('Get product', 'GET', '/api/v1/products/{{productId}}'),
      request('List categories', 'GET', '/api/v1/categories?limit=100', {
        after: capture('categoryId', '(data.items ?? data)[0]?.id'),
      }),
      request('Get category', 'GET', '/api/v1/categories/{{categoryId}}'),
      request('List brands', 'GET', '/api/v1/brands?limit=100', {
        after: capture('brandId', '(data.items ?? data)[0]?.id'),
      }),
      request('Get brand', 'GET', '/api/v1/brands/{{brandId}}'),
      request('Search products', 'GET', '/api/v1/search?q=rice&inStock=true&sort=price-asc'),
      request('Autocomplete', 'GET', '/api/v1/search/autocomplete?q=ric&limit=8'),
      request('Product reviews', 'GET', '/api/v1/reviews?productId={{productId}}'),
      request('Home content', 'GET', '/api/v1/content/home'),
      request('Legal content', 'GET', '/api/v1/content/legal/PRIVACY?locale=en-GB'),
    ],
  },
  {
    name: '03 - Age gate and purchase verification',
    item: [
      request('Confirm alcohol browsing age gate', 'POST', '/api/v1/age-gate/confirm', {
        body: {},
      }),
      request('List alcohol products after age gate', 'GET', '/api/v1/products?alcohol=true'),
      request('Current purchase age verification', 'GET', '/api/v1/age-verification'),
      request('Declare date of birth', 'POST', '/api/v1/age-verification/dob', {
        body: { dateOfBirth: '1990-01-01' },
      }),
      request(
        'Start verification provider session',
        'POST',
        '/api/v1/age-verification/provider-session',
        {
          body: {
            provider: '{{ageProvider}}',
            returnUrl: '{{storefrontUrl}}/checkout',
            postcode: '{{postcode}}',
            testDateOfBirth: '1990-01-01',
          },
          note: 'STUB is suitable only outside production; configure Yoti or manual review for launch.',
          after: capture('ageSessionId', 'data.sessionId'),
        },
      ),
      request(
        'Read provider result',
        'GET',
        '/api/v1/age-verification/provider-session/{{ageProvider}}/{{ageSessionId}}',
      ),
      request('Decline alcohol browsing gate', 'POST', '/api/v1/age-gate/decline', { body: {} }),
    ],
  },
  {
    name: '04 - Basket, pricing and delivery',
    item: [
      request('Get basket', 'GET', '/api/v1/cart'),
      request('Add product to basket', 'POST', '/api/v1/cart/items', {
        body: { productId: '{{productId}}', quantity: 1 },
        after: capture(
          'cartItemId',
          'data.groups?.flatMap(group => group.items)[0]?.id ?? data.items?.[0]?.id',
        ),
      }),
      request('Update basket quantity', 'PATCH', '/api/v1/cart/items/{{cartItemId}}', {
        body: { quantity: 2 },
      }),
      request(
        'Set substitution preference',
        'POST',
        '/api/v1/cart/items/{{cartItemId}}/substitution-preference',
        { body: { preference: 'SIMILAR' } },
      ),
      request('Apply coupon', 'POST', '/api/v1/cart/coupon', { body: { code: '{{couponCode}}' } }),
      request('Remove coupon', 'DELETE', '/api/v1/cart/coupon'),
      request('Authoritative pricing quote', 'POST', '/api/v1/pricing/quote', {
        body: { postcode: '{{postcode}}', couponCode: '{{couponCode}}' },
      }),
      request('Validate coupon', 'POST', '/api/v1/coupons/validate', {
        body: { code: '{{couponCode}}' },
      }),
      request(
        'Resolve delivery zone',
        'GET',
        '/api/v1/delivery/zones/resolve?postcode={{postcode}}',
      ),
      request(
        'List available delivery slots',
        'GET',
        '/api/v1/delivery/slots?postcode={{postcode}}',
        { after: capture('deliverySlotId', '(data.items ?? data.options ?? data)[0]?.id') },
      ),
      request(
        'Reserve delivery slot',
        'POST',
        '/api/v1/delivery/slots/{{deliverySlotId}}/reserve',
        { body: { postcode: '{{postcode}}' } },
      ),
      request('Merge guest basket after login', 'POST', '/api/v1/cart/merge', {
        auth: true,
        body: {},
      }),
      request('Remove basket item', 'DELETE', '/api/v1/cart/items/{{cartItemId}}'),
    ],
  },
  {
    name: '05 - Checkout and payment',
    item: [
      request('Validate checkout', 'POST', '/api/v1/checkout/validate', {
        body: {
          deliveryAddress: {
            line1: '10 High Street',
            city: 'London',
            postcode: '{{postcode}}',
            country: 'GB',
          },
          deliverySlotId: '{{deliverySlotId}}',
          couponCode: '{{couponCode}}',
        },
      }),
      request('Create checkout session', 'POST', '/api/v1/checkout/session', {
        body: {
          deliveryAddress: {
            line1: '10 High Street',
            line2: '',
            city: 'London',
            postcode: '{{postcode}}',
            country: 'GB',
          },
          deliverySlotId: '{{deliverySlotId}}',
          couponCode: '{{couponCode}}',
          guest: {
            firstName: '{{firstName}}',
            lastName: '{{lastName}}',
            email: '{{customerEmail}}',
            phone: '{{customerPhone}}',
          },
        },
        after: capture('checkoutSessionId', 'data.id'),
      }),
      request('Read checkout session', 'GET', '/api/v1/checkout/session/{{checkoutSessionId}}'),
      request('Place COD order', 'POST', '/api/v1/payments/cash-on-delivery', {
        body: { checkoutSessionId: '{{checkoutSessionId}}' },
        note: 'Current production-supported payment path while Stripe is intentionally deferred.',
        after: [...capture('orderId', 'data.orderId'), ...capture('paymentId', 'data.id')],
      }),
      request('Create Stripe payment intent', 'POST', '/api/v1/checkout/payment-intent', {
        body: { checkoutSessionId: '{{checkoutSessionId}}' },
        note: 'Requires configured Stripe keys and webhook processing before production use.',
        after: capture('paymentId', 'data.id'),
      }),
      request('Read payment state', 'GET', '/api/v1/payments/{{paymentId}}'),
      request(
        'Cancel checkout session',
        'DELETE',
        '/api/v1/checkout/session/{{checkoutSessionId}}',
      ),
    ],
  },
  {
    name: '06 - Customer account',
    item: [
      request('Get profile', 'GET', '/api/v1/profile', { auth: true }),
      request('Update profile', 'PATCH', '/api/v1/profile', {
        auth: true,
        body: { firstName: '{{firstName}}', lastName: '{{lastName}}', phone: '{{customerPhone}}' },
      }),
      request('List addresses', 'GET', '/api/v1/addresses', { auth: true }),
      request('Create address', 'POST', '/api/v1/addresses', {
        auth: true,
        body: {
          label: 'Home',
          line1: '10 High Street',
          line2: null,
          city: 'London',
          postcode: '{{postcode}}',
          country: 'GB',
          isDefault: true,
        },
        after: capture('addressId', 'data.id'),
      }),
      request('Update address', 'PATCH', '/api/v1/addresses/{{addressId}}', {
        auth: true,
        body: { label: 'Primary home', isDefault: true },
      }),
      request('Delete address', 'DELETE', '/api/v1/addresses/{{addressId}}', { auth: true }),
      request('Get wishlist', 'GET', '/api/v1/wishlist', { auth: true }),
      request('Add wishlist item', 'POST', '/api/v1/wishlist/items', {
        auth: true,
        body: { productId: '{{productId}}' },
      }),
      request(
        'Move wishlist item to basket',
        'POST',
        '/api/v1/wishlist/items/{{productId}}/move-to-cart',
        { auth: true, body: { quantity: 1 } },
      ),
      request('Remove wishlist item', 'DELETE', '/api/v1/wishlist/items/{{productId}}', {
        auth: true,
      }),
      request('My reviews', 'GET', '/api/v1/reviews/mine', { auth: true }),
      request('Create verified-purchase review', 'POST', '/api/v1/reviews', {
        auth: true,
        body: {
          productId: '{{productId}}',
          rating: 5,
          title: 'Excellent',
          body: 'Fresh product and careful delivery.',
          imageUrls: [],
        },
        after: capture('reviewId', 'data.id'),
      }),
      request('Update review', 'PATCH', '/api/v1/reviews/{{reviewId}}', {
        auth: true,
        body: { rating: 4, body: 'Updated after another purchase.' },
      }),
      request('Delete review', 'DELETE', '/api/v1/reviews/{{reviewId}}', { auth: true }),
    ],
  },
  {
    name: '07 - Orders, returns and invoices',
    item: [
      request('List my orders', 'GET', '/api/v1/orders', {
        auth: true,
        after: capture('orderId', 'data[0]?.id'),
      }),
      request('Get my order', 'GET', '/api/v1/orders/{{orderId}}', {
        auth: true,
        after: capture(
          'orderItemId',
          '[...(data.sections?.grocery ?? []), ...(data.sections?.alcohol ?? [])][0]?.id',
        ),
      }),
      request('Track my order', 'GET', '/api/v1/orders/{{orderId}}/tracking', { auth: true }),
      request('Download invoice PDF', 'GET', '/api/v1/orders/{{orderId}}/invoice', { auth: true }),
      request('Reorder', 'POST', '/api/v1/orders/{{orderId}}/reorder', { auth: true, body: {} }),
      request('Create return request', 'POST', '/api/v1/orders/{{orderId}}/returns', {
        auth: true,
        body: {
          reason: 'DAMAGED',
          customerNote: 'Packaging was damaged on arrival.',
          items: [{ orderItemId: '{{orderItemId}}', quantity: 1 }],
        },
        after: capture('returnId', 'data.id'),
      }),
      request('List my returns', 'GET', '/api/v1/returns', { auth: true }),
      request('Get return request', 'GET', '/api/v1/returns/{{returnId}}', { auth: true }),
    ],
  },
  {
    name: '08 - Notifications and privacy',
    item: [
      request('Get notification preferences', 'GET', '/api/v1/notification-preferences', {
        auth: true,
      }),
      request('Update notification preferences', 'PATCH', '/api/v1/notification-preferences', {
        auth: true,
        body: {
          transactionalEmail: true,
          marketingEmail: false,
          marketingSms: false,
          marketingPush: false,
          consentVersion: '2026-10',
        },
      }),
      request('List notifications', 'GET', '/api/v1/notifications', { auth: true }),
      request('List notification devices', 'GET', '/api/v1/notification-devices', { auth: true }),
      request('Register push device', 'POST', '/api/v1/notification-devices', {
        auth: true,
        body: {
          endpoint: 'https://push.example.test/subscription/customer',
          keys: { p256dh: 'replace-with-browser-key', auth: 'replace-with-browser-secret' },
        },
        after: capture('deviceId', 'data.id'),
      }),
      request('Remove notification device', 'DELETE', '/api/v1/notification-devices/{{deviceId}}', {
        auth: true,
      }),
      request('Get privacy consents', 'GET', '/api/v1/privacy/consents', { auth: true }),
      request('Update privacy consents', 'PATCH', '/api/v1/privacy/consents', {
        auth: true,
        body: {
          version: '2026-10',
          source: 'WEB',
          consents: [
            { category: 'ESSENTIAL', granted: true },
            { category: 'ANALYTICS', granted: false },
            { category: 'MARKETING', granted: false },
          ],
        },
      }),
      request('List privacy requests', 'GET', '/api/v1/privacy/requests', { auth: true }),
      request('Create data export', 'POST', '/api/v1/privacy/export-requests', {
        auth: true,
        body: {},
        after: capture('privacyRequestId', 'data.id'),
      }),
      request(
        'Download JSON data export',
        'GET',
        '/api/v1/privacy/export-requests/{{privacyRequestId}}?format=json',
        { auth: true },
      ),
      request('Request account erasure', 'POST', '/api/v1/privacy/deletion-requests', {
        auth: true,
        body: {},
        note: 'Run only with a disposable tester account.',
      }),
    ],
  },
];

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: 'Denes Commerce - Storefront API',
    description:
      'Storefront/customer API only. Requests are ordered as a manual test workflow. The Postman cookie jar preserves guest-cart and age-gate cookies automatically. Admin, staff, webhook ingestion and scheduled-processing routes are excluded.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
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
  item: folders,
};

const environment = {
  id: randomUUID(),
  name: 'Denes Commerce - Storefront Production',
  values: [
    ['baseUrl', 'https://api-theta-jade-1ftquke8hz.vercel.app'],
    ['storefrontUrl', 'https://denes-commerce-store.vercel.app'],
    ['customerEmail', 'storefront.tester@example.com'],
    ['customerPassword', 'Replace-With-A-Strong-Password-123!'],
    ['newCustomerPassword', 'Replace-With-Another-Strong-Password-456!'],
    ['firstName', 'Storefront'],
    ['lastName', 'Tester'],
    ['customerPhone', '+447700900123'],
    ['postcode', 'SW1A 1AA'],
    ['couponCode', ''],
    ['ageProvider', 'STUB'],
    ...[
      'accessToken',
      'refreshToken',
      'emailVerificationToken',
      'passwordResetToken',
      'otpChallengeId',
      'otpCode',
      'productId',
      'categoryId',
      'brandId',
      'cartItemId',
      'deliverySlotId',
      'checkoutSessionId',
      'paymentId',
      'orderId',
      'orderItemId',
      'returnId',
      'addressId',
      'reviewId',
      'deviceId',
      'privacyRequestId',
      'ageSessionId',
    ].map((key) => [key, '']),
  ].map(([key, value]) => ({
    key,
    value,
    enabled: true,
    ...(key.toLowerCase().includes('token') || key.toLowerCase().includes('password')
      ? { type: 'secret' }
      : {}),
  })),
  _postman_variable_scope: 'environment',
};

writeFileSync(
  new URL('Denes_Storefront_API.postman_collection.json', outputDirectory),
  `${json(collection)}\n`,
);
writeFileSync(
  new URL('Denes_Storefront_Production.postman_environment.json', outputDirectory),
  `${json(environment)}\n`,
);
