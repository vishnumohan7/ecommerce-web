'use server';

import { redirect } from 'next/navigation';
import { adminFormMutation, adminMutation } from './lib/api';

function textValue(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function textValues(data: FormData, key: string) {
  return data.getAll(key).map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function finish(path: string, result: { ok: boolean; error?: string }, success: string): never {
  const params = new URLSearchParams(
    result.ok ? { success } : { error: result.error ?? 'The operation failed.' },
  );
  redirect(`${path}?${params.toString()}`);
}

export async function createCategory(data: FormData) {
  const result = await adminMutation<{ id: string }>('/api/v1/categories', 'POST', {
    name: textValue(data, 'name'),
    slug: textValue(data, 'slug'),
    parentId: textValue(data, 'parentId') || null,
    position: Number(textValue(data, 'position') || '0'),
    active: true,
  });
  if (!result.ok) finish('/categories', result, '');
  const upload = await uploadTaxonomyImage('categories', result.data.id, data.get('image'));
  finish('/categories', upload, 'Category created.');
}

export async function createBrand(data: FormData) {
  const result = await adminMutation<{ id: string }>('/api/v1/brands', 'POST', {
    name: textValue(data, 'name'),
    slug: textValue(data, 'slug'),
  });
  if (!result.ok) finish('/brands', result, '');
  const upload = await uploadTaxonomyImage('brands', result.data.id, data.get('image'));
  finish('/brands', upload, 'Brand created.');
}

async function uploadTaxonomyImage(
  kind: 'categories' | 'brands',
  id: string,
  value: FormDataEntryValue | null,
) {
  if (!(value instanceof File) || value.size === 0)
    return { ok: false, error: 'Choose an image file.' };
  const upload = new FormData();
  upload.set('file', value);
  return adminFormMutation(`/api/v1/${kind}/${encodeURIComponent(id)}/image`, upload);
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
  const featuredImage = data.get('featuredImage');
  if (!(featuredImage instanceof File) || featuredImage.size === 0)
    finish('/products/new', { ok: false, error: 'Choose a featured product image.' }, '');
  const result = await adminMutation<{ id: string }>(
    '/api/v1/products',
    'POST',
    productInput(data),
  );
  if (!result.ok) finish('/products/new', result, '');
  const imageUpload = new FormData();
  imageUpload.set('file', featuredImage);
  imageUpload.set('altText', textValue(data, 'featuredImageAltText') || textValue(data, 'name'));
  const imageResult = await adminFormMutation(
    `/api/v1/products/${encodeURIComponent(result.data.id)}/images`,
    imageUpload,
  );
  if (!imageResult.ok) finish(`/products/${result.data.id}`, imageResult, '');
  const galleryImages = data
    .getAll('galleryImages')
    .filter((value): value is File => value instanceof File && value.size > 0);
  for (let index = 0; index < galleryImages.length; index += 1) {
    const galleryImage = galleryImages[index];
    if (!galleryImage) continue;
    const galleryUpload = new FormData();
    galleryUpload.set('file', galleryImage);
    galleryUpload.set('altText', `${textValue(data, 'name')} gallery image ${index + 1}`);
    const galleryResult = await adminFormMutation(
      `/api/v1/products/${encodeURIComponent(result.data.id)}/images`,
      galleryUpload,
    );
    if (!galleryResult.ok) finish(`/products/${result.data.id}`, galleryResult, '');
  }
  const stockResult = await adminMutation('/api/v1/inventory', 'POST', {
    productId: result.data.id,
    warehouseId: textValue(data, 'warehouseId'),
    onHand: Number(textValue(data, 'stockOnHand') || '0'),
    lowStockThreshold: Number(textValue(data, 'lowStockThreshold') || '5'),
  });
  if (!stockResult.ok) finish(`/products/${result.data.id}`, stockResult, '');

  const names = textValues(data, 'variantName');
  const skus = textValues(data, 'variantSku');
  const prices = textValues(data, 'variantPriceMinor');
  const packSizes = textValues(data, 'variantPackSize');
  const weights = textValues(data, 'variantWeightGrams');
  const flavours = textValues(data, 'variantFlavour');
  const warehouseIds = textValues(data, 'variantWarehouseId');
  const stock = textValues(data, 'variantStockOnHand');
  const thresholds = textValues(data, 'variantLowStockThreshold');
  const abv = textValues(data, 'variantAbv');
  for (let index = 0; index < names.length; index += 1) {
    const variantResult = await adminMutation(
      `/api/v1/products/${encodeURIComponent(result.data.id)}/variants`,
      'POST',
      {
        sku: skus[index],
        name: names[index],
        priceMinor: prices[index],
        currency: 'GBP',
        packSize: packSizes[index] || null,
        weightGrams: weights[index] ? Number(weights[index]) : null,
        abv: abv[index] || null,
        flavour: flavours[index] || null,
        attributes: {},
        warehouseId: warehouseIds[index],
        stockOnHand: Number(stock[index] || '0'),
        lowStockThreshold: Number(thresholds[index] || '5'),
      },
    );
    if (!variantResult.ok) finish(`/products/${result.data.id}`, variantResult, '');
  }
  finish(
    `/products/${result.data.id}`,
    { ok: true },
    names.length
      ? `Product, ${galleryImages.length + 1} image${galleryImages.length === 0 ? '' : 's'}, opening stock and ${names.length} variant${names.length === 1 ? '' : 's'} created.`
      : `Product, ${galleryImages.length + 1} image${galleryImages.length === 0 ? '' : 's'} and opening stock created.`,
  );
}

export async function updateProduct(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(
    `/api/v1/products/${encodeURIComponent(id)}`,
    'PATCH',
    productInput(data),
  );
  finish(`/products/${encodeURIComponent(id)}`, result, 'Product updated.');
}

export async function deleteProduct(data: FormData) {
  const result = await adminMutation(`/api/v1/products/${textValue(data, 'id')}`, 'DELETE');
  finish('/products', result, 'Product removed from the catalogue.');
}

export async function importCatalogue(data: FormData) {
  const file = data.get('file');
  if (!(file instanceof File) || file.size === 0)
    finish('/products/import', { ok: false, error: 'Choose a CSV or XLSX file.' }, '');
  const upload = new FormData();
  upload.set('file', file);
  const policy = textValue(data, 'duplicatePolicy') || 'fail';
  const dryRun = data.get('dryRun') === 'on';
  const result = await adminFormMutation<{ jobId: string; applied: number; errors?: unknown[] }>(
    `/api/v1/catalog/imports?duplicatePolicy=${encodeURIComponent(policy)}&dryRun=${String(dryRun)}`,
    upload,
  );
  const success = result.ok
    ? `${dryRun ? 'Validation complete' : 'Import complete'} · ${result.data.applied} rows applied · job ${result.data.jobId}`
    : '';
  finish('/products/import', result, success);
}

export async function uploadProductImage(data: FormData) {
  const id = textValue(data, 'id');
  const file = data.get('file');
  if (!(file instanceof File) || file.size === 0)
    finish(`/products/${id}`, { ok: false, error: 'Choose an image file.' }, '');
  const upload = new FormData();
  upload.set('file', file);
  upload.set('altText', textValue(data, 'altText'));
  const result = await adminFormMutation(
    `/api/v1/products/${encodeURIComponent(id)}/images`,
    upload,
  );
  finish(`/products/${id}`, result, 'Product image uploaded and optimised.');
}

export async function createProductVariant(data: FormData) {
  const id = textValue(data, 'id');
  let attributes: Record<string, string> = {};
  try {
    attributes = textValue(data, 'attributes')
      ? (JSON.parse(textValue(data, 'attributes')) as Record<string, string>)
      : {};
  } catch {
    finish(`/products/${id}`, { ok: false, error: 'Variant attributes must be valid JSON.' }, '');
  }
  const result = await adminMutation(
    `/api/v1/products/${encodeURIComponent(id)}/variants`,
    'POST',
    {
      sku: textValue(data, 'sku'),
      name: textValue(data, 'name'),
      priceMinor: textValue(data, 'priceMinor'),
      currency: 'GBP',
      packSize: textValue(data, 'packSize') || null,
      weightGrams: optionalNumber(data, 'weightGrams'),
      abv: textValue(data, 'abv') || null,
      flavour: textValue(data, 'flavour') || null,
      attributes,
      warehouseId: textValue(data, 'warehouseId'),
      stockOnHand: Number(textValue(data, 'stockOnHand') || '0'),
      lowStockThreshold: Number(textValue(data, 'lowStockThreshold') || '5'),
    },
  );
  finish(`/products/${id}`, result, 'Variant created with opening stock.');
}

export async function removeTaxonomy(data: FormData) {
  const kind = textValue(data, 'kind') === 'brand' ? 'brands' : 'categories';
  const result = await adminMutation(`/api/v1/${kind}/${textValue(data, 'id')}`, 'DELETE');
  finish(
    kind === 'brands' ? '/brands' : '/categories',
    result,
    kind === 'brands' ? 'Brand deleted.' : 'Category archived.',
  );
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
  if (!result.ok) finish('/categories', result, '');
  const image = data.get('image');
  const upload =
    image instanceof File && image.size > 0
      ? await uploadTaxonomyImage('categories', textValue(data, 'id'), image)
      : { ok: true };
  finish('/categories', upload, 'Category updated.');
}

export async function updateBrand(data: FormData) {
  const result = await adminMutation(
    `/api/v1/brands/${encodeURIComponent(textValue(data, 'id'))}`,
    'PATCH',
    { name: textValue(data, 'name'), slug: textValue(data, 'slug') },
  );
  if (!result.ok) finish('/brands', result, '');
  const image = data.get('image');
  const upload =
    image instanceof File && image.size > 0
      ? await uploadTaxonomyImage('brands', textValue(data, 'id'), image)
      : { ok: true };
  finish('/brands', upload, 'Brand updated.');
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

export async function createDeliverySlot(data: FormData) {
  const result = await adminMutation('/api/v1/admin/delivery/slots', 'POST', {
    zoneId: textValue(data, 'zoneId'),
    startsAt: new Date(textValue(data, 'startsAt')).toISOString(),
    endsAt: new Date(textValue(data, 'endsAt')).toISOString(),
    capacity: Number(textValue(data, 'capacity')),
    surchargeMinor: Number(textValue(data, 'surchargeMinor') || '0'),
    cutoffMinutes: Number(textValue(data, 'cutoffMinutes') || '120'),
    allowsAgeRestricted: data.get('allowsAgeRestricted') === 'on',
    active: true,
  });
  finish('/delivery', result, 'Delivery slot created.');
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
    couponClass: textValue(data, 'couponClass') || 'SITE_WIDE',
    minimumSpendMinor: textValue(data, 'minimumSpendMinor') || null,
    maximumDiscountMinor: textValue(data, 'maximumDiscountMinor') || null,
    maxUses: optionalNumber(data, 'maxUses'),
    perCustomerLimit: optionalNumber(data, 'perCustomerLimit'),
    firstOrderOnly: data.get('firstOrderOnly') === 'on',
    productIds: data
      .getAll('productIds')
      .filter((value): value is string => typeof value === 'string'),
    categoryIds: data
      .getAll('categoryIds')
      .filter((value): value is string => typeof value === 'string'),
    influencerId: textValue(data, 'influencerId') || null,
    lockedUserId: textValue(data, 'lockedUserId') || null,
    attributionWindowDays: Number(textValue(data, 'attributionWindowDays') || '30'),
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

export async function createPickList(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const result = await adminMutation(`/api/v1/admin/orders/${orderId}/pick-list`, 'POST');
  finish(`/orders/${orderId}`, result, 'Pick list opened.');
}

export async function recordPick(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const itemId = textValue(data, 'itemId');
  const outcome = textValue(data, 'outcome');
  const result = await adminMutation(
    `/api/v1/admin/orders/${orderId}/pick-list/items/${itemId}`,
    'PATCH',
    {
      outcome,
      picked: Number(textValue(data, 'picked')),
      ...(textValue(data, 'actualWeightGrams')
        ? { actualWeightGrams: Number(textValue(data, 'actualWeightGrams')) }
        : {}),
      ...(outcome === 'SUBSTITUTED'
        ? { substituteProductId: textValue(data, 'substituteProductId') }
        : {}),
    },
  );
  finish(`/orders/${orderId}`, result, 'Pick line recorded.');
}

export async function completePickList(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const result = await adminMutation(`/api/v1/admin/orders/${orderId}/pick-list/complete`, 'POST');
  finish(`/orders/${orderId}`, result, 'Picking completed and totals recalculated.');
}

export async function captureAgeCheck(data: FormData) {
  const orderId = textValue(data, 'orderId');
  const outcome = textValue(data, 'outcome');
  const result = await adminMutation('/api/v1/delivery-age-check', 'POST', {
    orderId,
    outcome,
    challengeAge: 25,
    recipientPresent: data.get('recipientPresent') === 'on',
    ...(outcome === 'PASSED' ? { idType: textValue(data, 'idType') } : {}),
    ...(textValue(data, 'refusalReason')
      ? { refusalReason: textValue(data, 'refusalReason') }
      : {}),
    ...(textValue(data, 'note') ? { note: textValue(data, 'note') } : {}),
  });
  finish(`/orders/${orderId}`, result, 'Challenge 25 outcome recorded.');
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
  const result = await adminMutation(
    `/api/v1/inventory/${encodeURIComponent(id)}/adjustments`,
    'POST',
    {
      quantity: Number(textValue(data, 'quantity')),
      reason: textValue(data, 'reason'),
      reference: textValue(data, 'reference') || undefined,
    },
  );
  const productId = textValue(data, 'productId');
  finish(
    productId ? `/products/${encodeURIComponent(productId)}` : '/inventory',
    result,
    'Inventory adjusted.',
  );
}

export async function createProductInventory(data: FormData) {
  const productId = textValue(data, 'productId');
  const result = await adminMutation('/api/v1/inventory', 'POST', {
    productId,
    warehouseId: textValue(data, 'warehouseId'),
    onHand: Number(textValue(data, 'stockOnHand') || '0'),
    lowStockThreshold: Number(textValue(data, 'lowStockThreshold') || '5'),
  });
  finish(`/products/${encodeURIComponent(productId)}`, result, 'Stock location added.');
}

export async function updateProductInventory(data: FormData) {
  const productId = textValue(data, 'productId');
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/inventory/${encodeURIComponent(id)}`, 'PATCH', {
    lowStockThreshold: Number(textValue(data, 'lowStockThreshold') || '0'),
  });
  finish(`/products/${encodeURIComponent(productId)}`, result, 'Stock settings updated.');
}

export async function deleteProductInventory(data: FormData) {
  const productId = textValue(data, 'productId');
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/inventory/${encodeURIComponent(id)}`, 'DELETE');
  finish(`/products/${encodeURIComponent(productId)}`, result, 'Empty stock location deleted.');
}

export async function toggleCustomer(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/admin/customers/${encodeURIComponent(id)}`, 'PATCH', {
    active: textValue(data, 'active') !== 'true',
  });
  finish('/customers', result, 'Customer status updated.');
}

export async function moderateReview(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(
    `/api/v1/admin/reviews/${encodeURIComponent(id)}/moderation`,
    'PATCH',
    { status: textValue(data, 'status'), reason: textValue(data, 'reason') || null },
  );
  finish('/reviews', result, 'Review moderation saved.');
}

export async function togglePromotion(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(`/api/v1/promotions/${encodeURIComponent(id)}`, 'PATCH', {
    active: textValue(data, 'active') !== 'true',
  });
  finish('/promotions', result, 'Promotion updated.');
}

export async function createPromotion(data: FormData) {
  const type = textValue(data, 'type');
  const minimumSpendMinor = optionalNumber(data, 'minimumSpendMinor');
  const conditions: Record<string, unknown> = {
    ...(minimumSpendMinor === null ? {} : { minimumSpendMinor }),
  };
  let effect: Record<string, unknown> = {};
  if (type === 'PERCENTAGE') effect = { valueBps: Number(textValue(data, 'value') || '0') };
  if (type === 'FIXED') effect = { valueMinor: textValue(data, 'value') || '0' };
  if (type === 'MULTIBUY') {
    conditions.buyQuantity = Number(textValue(data, 'buyQuantity') || '3');
    effect = { payQuantity: Number(textValue(data, 'payQuantity') || '2') };
  }
  const result = await adminMutation('/api/v1/promotions', 'POST', {
    name: textValue(data, 'name'),
    type,
    startsAt: new Date(textValue(data, 'startsAt')).toISOString(),
    endsAt: new Date(textValue(data, 'endsAt')).toISOString(),
    productIds: data
      .getAll('productIds')
      .filter((value): value is string => typeof value === 'string'),
    conditions,
    effect,
  });
  finish('/promotions', result, 'Promotion created.');
}

export async function saveRolePermissions(data: FormData) {
  const id = textValue(data, 'id');
  const permissionKeys = data
    .getAll('permissionKeys')
    .filter((value): value is string => typeof value === 'string');
  const result = await adminMutation(
    `/api/v1/admin/rbac/roles/${encodeURIComponent(id)}`,
    'PATCH',
    { permissionKeys },
  );
  finish('/access', result, 'Role permissions updated.');
}

export async function saveUserRoles(data: FormData) {
  const id = textValue(data, 'id');
  const roleKeys = data
    .getAll('roleKeys')
    .filter((value): value is string => typeof value === 'string');
  const result = await adminMutation(
    `/api/v1/admin/rbac/users/${encodeURIComponent(id)}`,
    'PATCH',
    { roleKeys },
  );
  finish('/access', result, 'Staff role assignments updated.');
}

export async function saveSettings(data: FormData) {
  try {
    const settings = JSON.parse(textValue(data, 'settings')) as Record<string, unknown>;
    const result = await adminMutation('/api/v1/admin/settings', 'PATCH', { settings });
    finish('/settings', result, 'Settings updated.');
  } catch {
    finish('/settings', { ok: false, error: 'Settings must be valid JSON.' }, '');
  }
}

export async function saveIntegrations(data: FormData) {
  const result = await adminMutation('/api/v1/admin/settings', 'PATCH', {
    integrations: {
      email: {
        provider: textValue(data, 'emailProvider'),
        fromName: textValue(data, 'fromName'),
        fromEmail: textValue(data, 'fromEmail'),
        replyTo: textValue(data, 'replyTo') || null,
        resendApiKey: textValue(data, 'resendApiKey'),
        smtpHost: textValue(data, 'smtpHost'),
        smtpPort: Number(textValue(data, 'smtpPort') || '587'),
        smtpSecure: data.get('smtpSecure') === 'on',
        smtpUsername: textValue(data, 'smtpUsername'),
        smtpPassword: textValue(data, 'smtpPassword'),
      },
      socialLogin: {
        googleEnabled: data.get('googleEnabled') === 'on',
        googleClientId: textValue(data, 'googleClientId'),
        googleClientSecret: textValue(data, 'googleClientSecret'),
        appleEnabled: data.get('appleEnabled') === 'on',
        appleClientId: textValue(data, 'appleClientId'),
        appleTeamId: textValue(data, 'appleTeamId'),
        appleKeyId: textValue(data, 'appleKeyId'),
        applePrivateKey: textValue(data, 'applePrivateKey'),
      },
    },
  });
  finish('/settings', result, 'Communication and sign-in settings updated.');
}

export async function updateNotificationTemplate(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(
    `/api/v1/admin/notification-templates/${encodeURIComponent(id)}`,
    'PATCH',
    {
      event: textValue(data, 'event'),
      channel: textValue(data, 'channel'),
      locale: textValue(data, 'locale'),
      subject: textValue(data, 'subject') || null,
      body: textValue(data, 'body'),
    },
  );
  finish('/notifications', result, 'A new template version was created.');
}

function jsonValue(data: FormData, key: string) {
  const raw = textValue(data, key);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export async function createNotificationTemplate(data: FormData) {
  const result = await adminMutation('/api/v1/admin/notification-templates', 'POST', {
    event: textValue(data, 'event'),
    channel: textValue(data, 'channel'),
    locale: textValue(data, 'locale') || 'en-GB',
    subject: textValue(data, 'subject') || null,
    body: textValue(data, 'body'),
  });
  finish('/notifications', result, 'Notification template created.');
}

export async function testNotification(data: FormData) {
  const id = textValue(data, 'id');
  try {
    const result = await adminMutation(
      `/api/v1/admin/notification-templates/${encodeURIComponent(id)}/test-send`,
      'POST',
      { recipient: textValue(data, 'recipient'), data: jsonValue(data, 'data') },
    );
    finish('/notifications', result, 'Test notification queued.');
  } catch {
    finish('/notifications', { ok: false, error: 'Test data must be valid JSON.' }, '');
  }
}

export async function processNotifications() {
  const result = await adminMutation('/api/v1/admin/notifications/process', 'POST');
  finish('/notifications', result, 'Queued notifications processed.');
}

export async function createBanner(data: FormData) {
  const result = await adminMutation('/api/v1/admin/content/banners', 'POST', {
    title: textValue(data, 'title'),
    subtitle: textValue(data, 'subtitle') || null,
    imageUrl: textValue(data, 'imageUrl'),
    mobileImageUrl: textValue(data, 'mobileImageUrl') || null,
    linkUrl: textValue(data, 'linkUrl') || null,
    position: Number(textValue(data, 'position') || '0'),
    startsAt: textValue(data, 'startsAt') || null,
    endsAt: textValue(data, 'endsAt') || null,
    active: true,
  });
  finish('/content', result, 'Banner created.');
}

export async function toggleBanner(data: FormData) {
  const result = await adminMutation(
    `/api/v1/admin/content/banners/${encodeURIComponent(textValue(data, 'id'))}`,
    'PATCH',
    { active: textValue(data, 'active') !== 'true' },
  );
  finish('/content', result, 'Banner status updated.');
}

export async function createContentBlock(data: FormData) {
  try {
    const result = await adminMutation('/api/v1/admin/content/blocks', 'POST', {
      type: textValue(data, 'type'),
      title: textValue(data, 'title') || null,
      content: jsonValue(data, 'content'),
      position: Number(textValue(data, 'position') || '0'),
      active: true,
    });
    finish('/content', result, 'Homepage block created.');
  } catch {
    finish('/content', { ok: false, error: 'Block content must be valid JSON.' }, '');
  }
}

export async function saveCmsPage(data: FormData) {
  const result = await adminMutation('/api/v1/admin/content/pages', 'POST', {
    type: textValue(data, 'type'),
    locale: textValue(data, 'locale') || 'en-GB',
    title: textValue(data, 'title'),
    content: textValue(data, 'content'),
    published: data.get('published') === 'on',
  });
  finish('/content', result, 'CMS page saved.');
}

export async function reviewPrivacyRequest(data: FormData) {
  const id = textValue(data, 'id');
  const result = await adminMutation(
    `/api/v1/admin/privacy/requests/${encodeURIComponent(id)}`,
    'PATCH',
    { status: textValue(data, 'status'), adminNote: textValue(data, 'adminNote') || null },
  );
  finish('/privacy', result, 'Privacy request updated.');
}
