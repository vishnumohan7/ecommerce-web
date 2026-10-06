import 'dotenv/config';
import { argon2id, hash } from 'argon2';
import {
  AlcoholType,
  BasketType,
  FulfilmentStatus,
  HfssStatus,
  PaymentStatus,
  PricingMode,
  PrismaClient,
  PromotionType,
  RefundStatus,
  RestrictionReason,
  ReturnPolicy,
  TaxCategory,
  UserRole,
} from '@prisma/client';
import { DEFAULT_TENANT_ID, seedMinimal } from './seed-minimal.js';

const prisma = new PrismaClient();
const groceryCategories = [
  'Fresh Produce',
  'Bakery',
  'Dairy and Eggs',
  'Meat and Fish',
  'Frozen',
  'Cupboard',
  'Breakfast',
  'Snacks',
  'Soft Drinks',
  'Household',
  'Baby',
  'Pet Care',
];
const alcoholCategories = ['Beer', 'Wine', 'Spirits', 'Cider'];
const groceryNames = [
  'British Apples',
  'Semi-Skimmed Milk',
  'Wholemeal Bread',
  'Free Range Eggs',
  'Mature Cheddar',
  'Tomato Soup',
  'Penne Pasta',
  'Basmati Rice',
  'Garden Peas',
  'Orange Juice',
  'Porridge Oats',
  'Chicken Breast',
  'Salmon Fillets',
  'Potatoes',
  'Bananas',
];
const alcoholNames = [
  'English Pale Ale',
  'Scottish Lager',
  'London Dry Gin',
  'Blended Whisky',
  'Italian Red Wine',
  'French White Wine',
  'Somerset Cider',
  'Premium Vodka',
];

async function seedDemo(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force'))
    throw new Error('Demo seed is disabled in production unless --force is supplied.');
  await seedMinimal(prisma);
  await prisma.category.createMany({
    data: [...groceryCategories, ...alcoholCategories].map((name, index) => {
      const slug = name.toLowerCase().replaceAll(' ', '-').replaceAll('&', 'and');
      return { tenantId: DEFAULT_TENANT_ID, slug, name, path: `/${slug}`, position: index };
    }),
    skipDuplicates: true,
  });
  await prisma.brand.createMany({
    data: Array.from({ length: 16 }, (_, index) => ({
      tenantId: DEFAULT_TENANT_ID,
      slug: `demo-brand-${index + 1}`,
      name: `Demo Brand ${index + 1}`,
    })),
    skipDuplicates: true,
  });
  const categories = await prisma.category.findMany({
    where: { tenantId: DEFAULT_TENANT_ID },
    orderBy: { position: 'asc' },
  });
  const brands = await prisma.brand.findMany({
    where: { tenantId: DEFAULT_TENANT_ID },
    orderBy: { slug: 'asc' },
  });
  const groceryData = Array.from({ length: 270 }, (_, index) => {
    const variable = index < 18;
    return {
      tenantId: DEFAULT_TENANT_ID,
      categoryId: categories[index % groceryCategories.length]!.id,
      brandId: brands[index % brands.length]!.id,
      sku: `DEMO-G-${String(index + 1).padStart(4, '0')}`,
      slug: `demo-grocery-${index + 1}`,
      name: `Demo ${groceryNames[index % groceryNames.length]} ${index + 1}`,
      description: 'Fictional demonstration grocery product for evaluation environments.',
      status: 'ACTIVE' as const,
      priceMinor: BigInt(75 + (index % 40) * 25),
      currency: 'GBP',
      vatRateBps: index % 3 === 0 ? 2000 : 0,
      taxCategory: index % 3 === 0 ? TaxCategory.STANDARD_20 : TaxCategory.ZERO,
      pricingMode: variable ? PricingMode.WEIGHT_ESTIMATED : PricingMode.UNIT,
      pricePerKgMinor: variable ? BigInt(350 + index * 5) : null,
      estimatedWeightGrams: variable ? 500 + index * 20 : null,
      weightToleranceBps: variable ? 1000 : null,
      isAlcohol: false,
      ageRestriction: 0,
      restrictionReason: RestrictionReason.NONE,
      returnPolicy: index % 5 === 0 ? ReturnPolicy.PERISHABLE_EXEMPT : ReturnPolicy.STANDARD_14_DAY,
      unitPriceDisplay: variable ? 'per kg' : 'each',
      hfssStatus: index % 9 === 0 ? HfssStatus.IN_SCOPE : HfssStatus.NOT_IN_SCOPE,
      hfssCategory: index % 9 === 0 ? 'CONFECTIONERY' : null,
      dietaryTags: index % 4 === 0 ? ['VEGETARIAN'] : [],
      allergens: index % 7 === 0 ? ['MILK'] : [],
      countryOfOrigin: 'GB',
      storageType: index % 8 === 0 ? ('CHILLED' as const) : ('AMBIENT' as const),
      shelfLifeDays: index % 8 === 0 ? 7 : 90,
    };
  });
  const alcoholData = Array.from({ length: 90 }, (_, index) => ({
    tenantId: DEFAULT_TENANT_ID,
    categoryId: categories[groceryCategories.length + (index % alcoholCategories.length)]!.id,
    brandId: brands[index % brands.length]!.id,
    sku: `DEMO-A-${String(index + 1).padStart(4, '0')}`,
    slug: `demo-alcohol-${index + 1}`,
    name: `Demo ${alcoholNames[index % alcoholNames.length]} ${index + 1}`,
    description: 'Fictional demonstration alcohol product for evaluation environments.',
    status: 'ACTIVE' as const,
    priceMinor: BigInt(250 + (index % 30) * 55),
    currency: 'GBP',
    vatRateBps: 2000,
    taxCategory: TaxCategory.STANDARD_20,
    pricingMode: PricingMode.UNIT,
    isAlcohol: true,
    abv: `${String(4 + (index % 36))}.00`,
    alcoholType: [AlcoholType.BEER, AlcoholType.WINE, AlcoholType.SPIRITS, AlcoholType.CIDER][
      index % 4
    ]!,
    ageRestriction: 18,
    restrictionReason: RestrictionReason.ALCOHOL,
    returnPolicy: ReturnPolicy.AGE_RESTRICTED_RESTRICTED,
    unitPriceDisplay: index % 4 === 0 ? 'per litre' : 'per 75cl',
    hfssStatus: HfssStatus.NOT_IN_SCOPE,
    dietaryTags: [],
    allergens: [],
    countryOfOrigin: index % 2 === 0 ? 'GB' : 'FR',
    storageType: 'AMBIENT' as const,
    shelfLifeDays: 730,
  }));
  await prisma.product.createMany({ data: [...groceryData, ...alcoholData], skipDuplicates: true });
  for (const [categoryName, alcoholType] of [
    ['Beer', AlcoholType.BEER],
    ['Wine', AlcoholType.WINE],
    ['Spirits', AlcoholType.SPIRITS],
    ['Cider', AlcoholType.CIDER],
  ] as const) {
    const category = categories.find((entry) => entry.name === categoryName);
    if (category)
      await prisma.product.updateMany({
        where: { tenantId: DEFAULT_TENANT_ID, categoryId: category.id, isAlcohol: true },
        data: { alcoholType },
      });
  }
  const products = await prisma.product.findMany({
    where: { tenantId: DEFAULT_TENANT_ID },
    orderBy: { sku: 'asc' },
  });
  await prisma.productImage.createMany({
    data: products.map((product) => ({
      tenantId: DEFAULT_TENANT_ID,
      productId: product.id,
      url: product.isAlcohol ? '/fixtures/product-alcohol.svg' : '/fixtures/product-grocery.svg',
      altText: product.name,
      position: 0,
    })),
    skipDuplicates: true,
  });
  const warehouse = await prisma.warehouse.upsert({
    where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: 'DEMO-LON' } },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      code: 'DEMO-LON',
      name: 'Demo London Store',
      address: { line1: '1 Demo Way', city: 'London', postcode: 'SE1 1AA' },
    },
  });
  await prisma.inventory.createMany({
    data: products.map((product, index) => ({
      tenantId: DEFAULT_TENANT_ID,
      productId: product.id,
      warehouseId: warehouse.id,
      onHand: 20 + (index % 80),
    })),
    skipDuplicates: true,
  });
  const passwordHash = await hash('Demo-Password-2026!', {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.user.createMany({
    data: Array.from({ length: 6 }, (_, index) => ({
      tenantId: DEFAULT_TENANT_ID,
      email: `customer${index + 1}@example.test`,
      passwordHash,
      firstName: 'Demo',
      lastName: `Customer ${index + 1}`,
      role: UserRole.CUSTOMER,
    })),
    skipDuplicates: true,
  });
  await prisma.user.updateMany({
    where: {
      tenantId: DEFAULT_TENANT_ID,
      email: { in: Array.from({ length: 6 }, (_, index) => `customer${index + 1}@example.test`) },
    },
    data: { passwordHash, active: true },
  });
  const customers = await prisma.user.findMany({
    where: { tenantId: DEFAULT_TENANT_ID, role: UserRole.CUSTOMER },
    orderBy: { email: 'asc' },
  });
  const zoneSeeds = [
    { code: 'LONDON', name: 'Demo London', patterns: ['SW*', 'SE*'], alcohol: true },
    { code: 'EDINBURGH', name: 'Demo Edinburgh', patterns: ['EH*'], alcohol: true },
    { code: 'BELFAST', name: 'Demo Belfast', patterns: ['BT*'], alcohol: false },
  ];
  for (const seed of zoneSeeds)
    await prisma.deliveryZone.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: seed.code } },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        code: seed.code,
        name: seed.name,
        postcodePatterns: seed.patterns,
        deliveryFeeMinor: 399n,
        groceryFeeMinor: 399n,
        alcoholFeeMinor: 399n,
        currency: 'GBP',
        alcoholDeliveryAllowed: seed.alcohol,
      },
    });
  const zones = await prisma.deliveryZone.findMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  const now = new Date();
  await prisma.deliverySlot.createMany({
    data: zones.flatMap((zone) =>
      Array.from({ length: 14 }, (_, day) => {
        const startsAt = new Date(now);
        startsAt.setUTCDate(startsAt.getUTCDate() + day + 1);
        startsAt.setUTCHours(10, 0, 0, 0);
        return {
          tenantId: DEFAULT_TENANT_ID,
          zoneId: zone.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
          capacity: 30,
        };
      }),
    ),
    skipDuplicates: true,
  });
  const couponNow = new Date();
  const couponEnd = new Date(couponNow.getTime() + 90 * 24 * 60 * 60 * 1000);
  await prisma.coupon.createMany({
    data: [
      {
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEMO10',
        type: PromotionType.PERCENTAGE,
        valueBps: 1000,
        currency: 'GBP',
        startsAt: couponNow,
        endsAt: couponEnd,
      },
      {
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEMO5GBP',
        type: PromotionType.FIXED,
        valueMinor: 500n,
        currency: 'GBP',
        startsAt: couponNow,
        endsAt: couponEnd,
      },
      {
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEMO-DELIVERY',
        type: PromotionType.FREE_DELIVERY,
        currency: 'GBP',
        startsAt: couponNow,
        endsAt: couponEnd,
      },
    ],
    skipDuplicates: true,
  });
  await prisma.influencer.createMany({
    data: [
      {
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEMO-ALPHA',
        displayName: 'Demo Creator Alpha',
        commissionBps: 500,
      },
      {
        tenantId: DEFAULT_TENANT_ID,
        code: 'DEMO-BETA',
        displayName: 'Demo Creator Beta',
        commissionBps: 750,
      },
    ],
    skipDuplicates: true,
  });
  for (let index = 0; index < 40; index += 1) {
    const basketType = [BasketType.GROCERY, BasketType.ALCOHOL, BasketType.MIXED][index % 3]!;
    const totalMinor = BigInt(1500 + index * 75);
    const order = await prisma.order.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: DEFAULT_TENANT_ID,
          idempotencyKey: `demo-order-${index + 1}`,
        },
      },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        userId: customers[index % customers.length]!.id,
        orderNumber: BigInt(index + 1),
        idempotencyKey: `demo-order-${index + 1}`,
        basketType,
        subtotalMinor: totalMinor - 399n,
        discountMinor: 0n,
        taxMinor: 0n,
        deliveryFeeMinor: 399n,
        totalMinor,
        paymentStatus: index % 7 === 0 ? PaymentStatus.REFUNDED : PaymentStatus.CAPTURED,
        fulfilmentStatus:
          Object.values(FulfilmentStatus)[index % Object.values(FulfilmentStatus).length]!,
        refundStatus: index % 7 === 0 ? RefundStatus.FULL : RefundStatus.NONE,
        deliveryAddress: { line1: `${index + 1} Demo Street`, city: 'London', postcode: 'SE1 1AA' },
        customerSnapshot: {
          name: `Demo Customer ${(index % 6) + 1}`,
          email: `customer${(index % 6) + 1}@example.test`,
        },
      },
    });
    const product =
      products.find((entry) =>
        basketType === BasketType.ALCOHOL ? entry.isAlcohol : !entry.isAlcohol,
      ) ?? products[0]!;
    await prisma.orderItem.createMany({
      data: [
        {
          tenantId: DEFAULT_TENANT_ID,
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPriceMinor: totalMinor - 399n,
          currency: 'GBP',
          vatRateBps: product.vatRateBps,
          vatAmountMinor: 0n,
          discountMinor: 0n,
          lineTotalMinor: totalMinor - 399n,
          orderCategory: product.isAlcohol ? 'ALCOHOL' : 'GROCERY',
          isAlcohol: product.isAlcohol,
          ageRestriction: product.ageRestriction,
          abv: product.abv,
          pricingMode: product.pricingMode,
          estimatedWeightGrams: product.estimatedWeightGrams,
          unitPriceDisplay: product.unitPriceDisplay,
          hfssStatus: product.hfssStatus,
          returnPolicy: product.returnPolicy,
          substitutionPreference: 'SIMILAR',
        },
      ],
    });
  }
  console.log(`Demo seed complete: ${products.length} products, 6 customers, 40 orders.`);
}

seedDemo()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
