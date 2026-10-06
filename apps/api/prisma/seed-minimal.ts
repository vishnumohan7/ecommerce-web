import 'dotenv/config';
import { argon2id, hash } from 'argon2';
import { CmsPageType, JurisdictionCode, PrismaClient, TaxCategory, UserRole } from '@prisma/client';

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaClient();

export async function seedMinimal(client = prisma): Promise<void> {
  await client.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { active: true },
    create: { id: DEFAULT_TENANT_ID, slug: 'default', name: 'Demo Merchant', active: true },
  });

  await client.tenantSettings.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      settings: {
        locale: 'en-GB',
        currency: 'GBP',
        timezone: 'Europe/London',
        alcohol: {
          acceptDigitalProofOfAge: false,
          digitalProofHelpText:
            'Confirm the selected provider is currently certified and listed on the statutory GOV.UK DVS register before enabling.',
          verificationValidityDays: 365,
        },
        payment: { weightVarianceBufferBps: 1000 },
        fulfilment: { substitutionsEnabled: true },
        delivery: {
          combinationStrategy: 'MAX',
          combinationSurchargeMinor: 0,
          showBreakdown: false,
        },
        pricing: { couponStackingPolicy: 'STACK', pricesIncludeVat: true },
      },
    },
  });

  for (const [taxCategory, rateBps] of [
    [TaxCategory.STANDARD_20, 2000],
    [TaxCategory.REDUCED_5, 500],
    [TaxCategory.ZERO, 0],
    [TaxCategory.EXEMPT, 0],
  ] as const) {
    await client.taxRule.upsert({
      where: {
        tenantId_taxCategory_effectiveFrom: {
          tenantId: DEFAULT_TENANT_ID,
          taxCategory,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
      update: { rateBps, active: true },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        taxCategory,
        rateBps,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }

  await client.brandingProfile.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      brandName: 'Demo Merchant',
      legalEntityName: 'Demo Merchant Limited',
      companyNumber: '00000000',
      registeredAddress: { line1: '1 Example Street', city: 'London', postcode: 'SW1A 1AA' },
      assets: {},
      colours: {
        primary: 'rgb(0 92 82)',
        secondary: 'rgb(26 66 64)',
        accent: 'rgb(238 181 44)',
        success: 'rgb(33 122 72)',
        warning: 'rgb(170 105 0)',
        danger: 'rgb(176 36 36)',
        surface: 'rgb(255 255 255)',
        onSurface: 'rgb(20 24 23)',
      },
      typography: { heading: 'Inter', body: 'Inter' },
      emailBranding: { footer: 'Demo Merchant Limited' },
    },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe-2026!';
  const adminPasswordHash = await hash(adminPassword, {
    type: argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const admin = await client.user.upsert({
    where: {
      tenantId_email: {
        tenantId: DEFAULT_TENANT_ID,
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.test',
      },
    },
    update: { passwordHash: adminPasswordHash, active: true },
    create: {
      tenantId: DEFAULT_TENANT_ID,
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.test',
      passwordHash: adminPasswordHash,
      firstName: 'Store',
      lastName: 'Administrator',
      role: UserRole.TENANT_ADMIN,
    },
  });

  const permissionKeys = [
    'catalog.read',
    'catalog.write',
    'inventory.read',
    'inventory.write',
    'orders.read',
    'orders.write',
    'refunds.create',
    'users.read',
    'users.write',
    'settings.read',
    'settings.write',
    'reports.read',
    'delivery.read',
    'delivery.write',
    'audit.read',
  ] as const;
  for (const key of permissionKeys)
    await client.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key.replace('.', ' ') },
    });
  const rolePermissions: Record<string, readonly string[]> = {
    SUPER_ADMIN: permissionKeys,
    TENANT_ADMIN: permissionKeys,
    STORE_MANAGER: [
      'catalog.read',
      'inventory.read',
      'inventory.write',
      'orders.read',
      'orders.write',
      'refunds.create',
      'users.read',
      'reports.read',
      'delivery.read',
      'delivery.write',
    ],
    CATALOG_MANAGER: ['catalog.read', 'catalog.write', 'inventory.read'],
    FULFILMENT_STAFF: [
      'catalog.read',
      'inventory.read',
      'inventory.write',
      'orders.read',
      'orders.write',
    ],
    CUSTOMER: ['catalog.read', 'orders.read'],
  };
  for (const [key, keys] of Object.entries(rolePermissions)) {
    const role = await client.role.upsert({
      where: { tenantId_key: { tenantId: DEFAULT_TENANT_ID, key } },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        key,
        name: key.replaceAll('_', ' '),
        description: `System role ${key}`,
      },
    });
    const permissions = await client.permission.findMany({ where: { key: { in: [...keys] } } });
    await client.rolePermission.createMany({
      data: permissions.map((permission) => ({
        tenantId: DEFAULT_TENANT_ID,
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
    if (key === 'TENANT_ADMIN')
      await client.userRoleAssignment.createMany({
        data: [{ tenantId: DEFAULT_TENANT_ID, userId: admin.id, roleId: role.id }],
        skipDuplicates: true,
      });
  }

  const jurisdictionSeeds = [
    {
      code: JurisdictionCode.ENGLAND_WALES,
      name: 'England and Wales',
      saleStart: 0,
      saleEnd: 1440,
      challengeAge: 25,
      dayBook: false,
      digital: true,
      postcodeAreas: [] as string[],
    },
    {
      code: JurisdictionCode.SCOTLAND,
      name: 'Scotland',
      saleStart: 600,
      saleEnd: 1320,
      challengeAge: 25,
      dayBook: true,
      digital: false,
      postcodeAreas: [
        'AB',
        'DD',
        'DG',
        'EH',
        'FK',
        'G',
        'HS',
        'IV',
        'KA',
        'KW',
        'KY',
        'ML',
        'PA',
        'PH',
        'TD',
        'ZE',
      ],
    },
    {
      code: JurisdictionCode.NORTHERN_IRELAND,
      name: 'Northern Ireland',
      saleStart: 480,
      saleEnd: 1380,
      challengeAge: 25,
      dayBook: false,
      digital: false,
      postcodeAreas: ['BT'],
    },
  ];
  for (const seed of jurisdictionSeeds) {
    const jurisdiction = await client.jurisdiction.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: seed.code } },
      update: { name: seed.name },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        code: seed.code,
        name: seed.name,
        postcodeAreas: seed.postcodeAreas,
      },
    });
    await client.jurisdictionRuleset.upsert({
      where: {
        tenantId_jurisdictionId: { tenantId: DEFAULT_TENANT_ID, jurisdictionId: jurisdiction.id },
      },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        jurisdictionId: jurisdiction.id,
        permittedSaleStartMinutes: seed.saleStart,
        permittedSaleEndMinutes: seed.saleEnd,
        prohibitedDeliveryStartMinutes: seed.code === JurisdictionCode.SCOTLAND ? 0 : null,
        prohibitedDeliveryEndMinutes: seed.code === JurisdictionCode.SCOTLAND ? 360 : null,
        challengeAge: seed.challengeAge,
        requiresDayBook: seed.dayBook,
        allowsDigitalProofOfAge: seed.digital,
        hfssEnforced: seed.code === JurisdictionCode.ENGLAND_WALES,
      },
    });
  }

  const warning = '[BUYER MUST REPLACE — NOT LEGAL ADVICE]';
  for (const type of Object.values(CmsPageType)) {
    await client.cmsPage.upsert({
      where: { tenantId_type_locale: { tenantId: DEFAULT_TENANT_ID, type, locale: 'en-GB' } },
      update: {},
      create: {
        tenantId: DEFAULT_TENANT_ID,
        type,
        locale: 'en-GB',
        title: type.replaceAll('_', ' '),
        content: `${warning}\n\nMerchant-supplied content is required before launch.`,
        published: false,
      },
    });
  }

  for (const terms of [
    ['aubergine', 'eggplant'],
    ['coriander', 'cilantro'],
  ] as const) {
    const existing = await client.searchSynonym.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, terms: { has: terms[0] } },
    });
    if (!existing)
      await client.searchSynonym.create({
        data: { tenantId: DEFAULT_TENANT_ID, terms: [...terms] },
      });
  }
}

if (process.argv[1]?.endsWith('seed-minimal.ts') === true) {
  seedMinimal()
    .then(() => prisma.$disconnect())
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
