'use server';

import { redirect } from 'next/navigation';
import { adminMutation } from './lib/api';

function textValue(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function finish(path: string, result: { ok: boolean; error?: string }, success: string): never {
  const params = new URLSearchParams(
    result.ok ? { success } : { error: result.error ?? 'The operation failed.' },
  );
  redirect(`${path}?${params.toString()}`);
}

export async function createCategory(data: FormData) {
  const result = await adminMutation('/api/v1/categories', 'POST', {
    name: textValue(data, 'name'),
    slug: textValue(data, 'slug'),
    parentId: textValue(data, 'parentId') || null,
    position: Number(textValue(data, 'position') || '0'),
    active: true,
  });
  finish('/catalogue', result, 'Category created.');
}

export async function createBrand(data: FormData) {
  const result = await adminMutation('/api/v1/brands', 'POST', {
    name: textValue(data, 'name'),
    slug: textValue(data, 'slug'),
  });
  finish('/catalogue', result, 'Brand created.');
}

function optionalNumber(data: FormData, key: string) {
  const value = textValue(data, key);
  return value ? Number(value) : null;
}

function productInput(data: FormData) {
  const alcohol = data.get('isAlcohol') === 'on';
  const pricingMode = textValue(data, 'pricingMode') || 'UNIT';
  return {
    categoryId: textValue(data, 'categoryId'),
    brandId: textValue(data, 'brandId') || null,
    sku: textValue(data, 'sku'),
    slug: textValue(data, 'slug'),
    name: textValue(data, 'name'),
    description: textValue(data, 'description'),
    priceMinor: textValue(data, 'priceMinor'),
    currency: 'GBP',
    vatRateBps: alcohol ? 2000 : Number(textValue(data, 'vatRateBps')),
    taxCategory: alcohol ? 'STANDARD_20' : textValue(data, 'taxCategory'),
    pricingMode,
    pricePerKgMinor:
      pricingMode === 'WEIGHT_ESTIMATED' ? textValue(data, 'pricePerKgMinor') || null : null,
    estimatedWeightGrams:
      pricingMode === 'WEIGHT_ESTIMATED' ? optionalNumber(data, 'estimatedWeightGrams') : null,
    weightToleranceBps:
      pricingMode === 'WEIGHT_ESTIMATED' ? optionalNumber(data, 'weightToleranceBps') : null,
    abv: alcohol ? textValue(data, 'abv') : null,
    alcoholType: alcohol ? textValue(data, 'alcoholType') : null,
    ageRestriction: alcohol ? 18 : 0,
    restrictionReason: alcohol ? 'ALCOHOL' : 'NONE',
    returnPolicy: alcohol
      ? 'AGE_RESTRICTED_RESTRICTED'
      : textValue(data, 'returnPolicy') || 'STANDARD_14_DAY',
    unitPriceDisplay: textValue(data, 'unitPriceDisplay'),
    hfssStatus: textValue(data, 'hfssStatus') || 'NOT_IN_SCOPE',
    hfssCategory:
      textValue(data, 'hfssStatus') === 'IN_SCOPE' ? textValue(data, 'hfssCategory') || null : null,
    dietaryTags: textValue(data, 'dietaryTags')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    allergens: textValue(data, 'allergens')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    countryOfOrigin: textValue(data, 'countryOfOrigin').toUpperCase(),
    storageType: textValue(data, 'storageType'),
    shelfLifeDays: optionalNumber(data, 'shelfLifeDays'),
  };
}

export async function createProduct(data: FormData) {
  const result = await adminMutation('/api/v1/products', 'POST', productInput(data));
  finish('/products', result, 'Product created.');
}

export async function updateProduct(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/products/${encodeURIComponent(id)}`, 'PATCH', productInput(data));
  finish(`/products/${encodeURIComponent(id)}`, result, 'Product updated.');
}

export async function archiveProduct(data: FormData) {
  const result = await adminMutation(`/api/v1/products/${textValue(data, 'id')}`, 'DELETE');
  finish('/products', result, 'Product archived.');
}

export async function removeTaxonomy(data: FormData) {
  const kind = textValue(data, 'kind') === 'brand' ? 'brands' : 'categories';
  const result = await adminMutation(`/api/v1/${kind}/${textValue(data, 'id')}`, 'DELETE');
  finish('/catalogue', result, kind === 'brands' ? 'Brand deleted.' : 'Category archived.');
}

export async function updateCategory(data: FormData) {
  const result = await adminMutation(
    `/api/v1/categories/${encodeURIComponent(textValue(data, 'id'))}`,
    'PATCH',
    {
      name: textValue(data, 'name'),
      slug: textValue(data, 'slug'),
      parentId: textValue(data, 'parentId') || null,
      position: Number(textValue(data, 'position') || '0'),
    },
  );
  finish('/catalogue', result, 'Category updated.');
}

export async function updateBrand(data: FormData) {
  const result = await adminMutation(
    `/api/v1/brands/${encodeURIComponent(textValue(data, 'id'))}`,
    'PATCH',
    { name: textValue(data, 'name'), slug: textValue(data, 'slug') },
  );
  finish('/catalogue', result, 'Brand updated.');
}

export async function createDeliveryZone(data: FormData) {
  const fee = Number(textValue(data, 'feeMinor'));
  const result = await adminMutation('/api/v1/admin/delivery/zones', 'POST', {
    code: textValue(data, 'code').toUpperCase(),
    name: textValue(data, 'name'),
    postcodePatterns: textValue(data, 'postcodePatterns')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
    groceryFeeMinor: fee,
    alcoholFeeMinor: fee,
    supportedStorageTypes: ['AMBIENT', 'CHILLED', 'FROZEN'],
    alcoholDeliveryAllowed: true,
    active: true,
  });
  finish('/delivery', result, 'Delivery zone created.');
}

export async function toggleDelivery(data: FormData) {
  const kind = textValue(data, 'kind');
  const result = await adminMutation(
    `/api/v1/admin/delivery/${kind}/${textValue(data, 'id')}`,
    'PATCH',
    { active: textValue(data, 'active') !== 'true' },
  );
  finish('/delivery', result, 'Delivery record updated.');
}

export async function createCoupon(data: FormData) {
  const type = textValue(data, 'type');
  const amount = Number(textValue(data, 'amount'));
  const result = await adminMutation('/api/v1/admin/coupons', 'POST', {
    code: textValue(data, 'code'),
    type,
    ...(type === 'PERCENTAGE' ? { valueBps: amount } : { valueMinor: String(amount) }),
    startsAt: textValue(data, 'startsAt'),
    endsAt: textValue(data, 'endsAt'),
    appliesTo: textValue(data, 'appliesTo'),
    couponClass: 'SITE_WIDE',
  });
  finish('/pricing', result, 'Coupon created.');
}

export async function toggleCoupon(data: FormData) {
  const result = await adminMutation(`/api/v1/admin/coupons/${textValue(data, 'id')}`, 'PATCH', {
    active: textValue(data, 'active') !== 'true',
  });
  finish('/pricing', result, 'Coupon updated.');
}

export async function createInfluencer(data: FormData) {
  const result = await adminMutation('/api/v1/admin/influencers', 'POST', {
    code: textValue(data, 'code'),
    displayName: textValue(data, 'displayName'),
    commissionBps: Number(textValue(data, 'commissionBps')),
    active: true,
  });
  finish('/pricing', result, 'Influencer created.');
}

export async function createTaxRule(data: FormData) {
  const result = await adminMutation('/api/v1/admin/tax-rules', 'POST', {
    taxCategory: textValue(data, 'taxCategory'),
    rateBps: Number(textValue(data, 'rateBps')),
    effectiveFrom: textValue(data, 'effectiveFrom'),
    active: true,
  });
  finish('/pricing', result, 'Tax rule created.');
}

export async function transitionFulfilment(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const groupId = textValue(data, 'groupId');
  const result = await adminMutation(
    `/api/v1/admin/orders/${orderId}/fulfilment-groups/${groupId}`,
    'PATCH',
    { status: textValue(data, 'status') },
  );
  finish(`/orders/${orderId}`, result, 'Fulfilment status updated.');
}

export async function reviewReturn(data: FormData) {
  const id = textValue(data, 'id');
  const status = textValue(data, 'status');
  const result = await adminMutation(`/api/v1/admin/returns/${id}`, 'PATCH', {
    status,
    adminNote: textValue(data, 'adminNote') || undefined,
    ...(status === 'APPROVED' ? { disposition: textValue(data, 'disposition') } : {}),
  });
  finish('/returns', result, status === 'APPROVED' ? 'Return approved.' : 'Return rejected.');
}

export async function initiateRefund(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const items = [...data.entries()]
    .filter(([key, value]) => key.startsWith('quantity:') && Number(value) > 0)
    .map(([key, value]) => ({
      orderItemId: key.slice('quantity:'.length),
      quantity: Number(value),
    }));
  if (items.length === 0) {
    finish(`/orders/${orderId}`, { ok: false, error: 'Select at least one item to refund.' }, '');
  }
  const result = await adminMutation(`/api/v1/admin/orders/${orderId}/refunds`, 'POST', {
    idempotencyKey: textValue(data, 'idempotencyKey'),
    reason: textValue(data, 'reason'),
    method: textValue(data, 'method'),
    items,
  });
  finish(`/orders/${orderId}`, result, 'Refund initiated successfully.');
}

export async function adjustInventory(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/inventory/${encodeURIComponent(id)}/adjustments`, 'POST', {
    quantity: Number(textValue(data, 'quantity')),
    reason: textValue(data, 'reason'),
    reference: textValue(data, 'reference') || undefined,
  });
  finish('/inventory', result, 'Inventory adjusted.');
}

export async function toggleCustomer(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/admin/customers/${encodeURIComponent(id)}`, 'PATCH', { active: textValue(data, 'active') !== 'true' });
  finish('/customers', result, 'Customer status updated.');
}

export async function moderateReview(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/admin/reviews/${encodeURIComponent(id)}/moderation`, 'PATCH', { status: textValue(data, 'status'), reason: textValue(data, 'reason') || null });
  finish('/reviews', result, 'Review moderation saved.');
}

export async function togglePromotion(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/promotions/${encodeURIComponent(id)}`, 'PATCH', { active: textValue(data, 'active') !== 'true' });
  finish('/promotions', result, 'Promotion updated.');
}

export async function saveRolePermissions(data: FormData) {
  const id = textValue(data, 'id');
  const permissionKeys = data.getAll('permissionKeys').filter((value): value is string => typeof value === 'string');
  const result = await adminMutation(`/api/v1/admin/rbac/roles/${encodeURIComponent(id)}`, 'PATCH', { permissionKeys });
  finish('/access', result, 'Role permissions updated.');
}

export async function saveSettings(data: FormData) {
  try {
    const settings = JSON.parse(textValue(data, 'settings')) as Record<string, unknown>;
    const result = await adminMutation('/api/v1/admin/settings', 'PATCH', { settings });
    finish('/settings', result, 'Settings updated.');
  } catch { finish('/settings', { ok: false, error: 'Settings must be valid JSON.' }, ''); }
}

export async function updateNotificationTemplate(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/admin/notification-templates/${encodeURIComponent(id)}`, 'PATCH', {
    event: textValue(data, 'event'),
    channel: textValue(data, 'channel'),
    locale: textValue(data, 'locale'),
    subject: textValue(data, 'subject') || null,
    body: textValue(data, 'body'),
  });
  finish('/notifications', result, 'A new template version was created.');
}

export async function reviewPrivacyRequest(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/admin/privacy/requests/${encodeURIComponent(id)}`, 'PATCH', { status: textValue(data, 'status'), adminNote: textValue(data, 'adminNote') || null });
  finish('/privacy', result, 'Privacy request updated.');
}

export async function validateLicense(data: FormData) {
  const result = await adminMutation('/api/v1/admin/license/validate', 'POST', { token: textValue(data, 'token') });
  finish('/license', result, 'Licence validated and installed.');
}
