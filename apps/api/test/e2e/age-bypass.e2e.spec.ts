import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../src/common/config/app-config.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { GlobalErrorFilter } from '../../src/common/errors/global-error.filter';
import { AgeGateTokenService } from '../../src/common/security/age-gate-token.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { AgeVerificationController } from '../../src/modules/age-verification/age-verification.controller';
import { AgeVerificationService } from '../../src/modules/age-verification/age-verification.service';
import { CheckoutAgeGuardService } from '../../src/modules/age-verification/checkout-age-guard.service';
import {
  JurisdictionRuleService,
  PostcodeJurisdictionResolver,
} from '../../src/modules/age-verification/jurisdiction-rule.service';
import { ManualReviewAgeVerificationProvider } from '../../src/modules/age-verification/providers/manual-review-age-verification.provider';
import { StubAgeVerificationProvider } from '../../src/modules/age-verification/providers/stub-age-verification.provider';
import { YotiAgeVerificationProvider } from '../../src/modules/age-verification/providers/yoti-age-verification.provider';
import { GuestCartTokenService } from '../../src/modules/cart/guest-cart-token.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const productIds: string[] = [];
const cartIds: string[] = [];
const verificationIds: string[] = [];
let app: INestApplication;
let checkout: CheckoutAgeGuardService;
let jurisdictions: JurisdictionRuleService;
let verificationService: AgeVerificationService;
let guestTokens: GuestCartTokenService;
let gateTokens: AgeGateTokenService;
let alcoholProductId = '';
let lowAbvProductId = '';
let policyProductId = '';

describe('age verification bypass E2E', () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId, active: true } });
    const suffix = Date.now().toString(36);
    const base = {
      tenantId,
      categoryId: category.id,
      description: 'Transient age verification fixture',
      status: 'ACTIVE' as const,
      currency: 'GBP',
      vatRateBps: 0,
      pricingMode: 'UNIT' as const,
      returnPolicy: 'STANDARD_14_DAY' as const,
      unitPriceDisplay: 'each',
      hfssStatus: 'NOT_IN_SCOPE' as const,
      dietaryTags: [] as string[],
      allergens: [] as string[],
      countryOfOrigin: 'GB',
      storageType: 'AMBIENT' as const,
    };
    const [alcohol, lowAbv, policy] = await Promise.all([
      prisma.product.create({
        data: {
          ...base,
          sku: `AGE-A-${suffix}`,
          slug: `age-alcohol-${suffix}`,
          name: 'Age Test Alcohol',
          priceMinor: 1000n,
          isAlcohol: true,
          abv: '12.00',
          ageRestriction: 18,
          restrictionReason: 'ALCOHOL',
          returnPolicy: 'AGE_RESTRICTED_RESTRICTED',
        },
      }),
      prisma.product.create({
        data: {
          ...base,
          sku: `AGE-L-${suffix}`,
          slug: `age-low-abv-${suffix}`,
          name: 'Age Test Low ABV',
          priceMinor: 400n,
          isAlcohol: false,
          abv: '0.40',
          ageRestriction: 0,
          restrictionReason: 'NONE',
        },
      }),
      prisma.product.create({
        data: {
          ...base,
          sku: `AGE-P-${suffix}`,
          slug: `age-policy-${suffix}`,
          name: 'Age Test Policy Product',
          priceMinor: 500n,
          isAlcohol: false,
          abv: '0.00',
          ageRestriction: 18,
          restrictionReason: 'RETAILER_POLICY',
        },
      }),
    ]);
    alcoholProductId = alcohol.id;
    lowAbvProductId = lowAbv.id;
    policyProductId = policy.id;
    productIds.push(alcohol.id, lowAbv.id, policy.id);

    const scoped = new TenantScopedPrismaService(prisma);
    const config = new AppConfigService();
    guestTokens = new GuestCartTokenService(config);
    gateTokens = new AgeGateTokenService(config);
    const resolver = new PostcodeJurisdictionResolver(scoped);
    jurisdictions = new JurisdictionRuleService(resolver);
    checkout = new CheckoutAgeGuardService(scoped, jurisdictions);
    verificationService = new AgeVerificationService(
      scoped,
      config,
      new StubAgeVerificationProvider(),
      new YotiAgeVerificationProvider(config),
      new ManualReviewAgeVerificationProvider(),
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [AgeVerificationController],
      providers: [
        { provide: AgeVerificationService, useValue: verificationService },
        { provide: CheckoutAgeGuardService, useValue: checkout },
        { provide: GuestCartTokenService, useValue: guestTokens },
        { provide: AgeGateTokenService, useValue: gateTokens },
        { provide: AppConfigService, useValue: config },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use((_request: Request, _response: Response, next: NextFunction) =>
      TenantContext.run({ tenantId, requestId: 'age-e2e' }, next),
    );
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await prisma.ageVerification.deleteMany({ where: { tenantId, id: { in: verificationIds } } });
    await prisma.cartItem.deleteMany({ where: { tenantId, cartId: { in: cartIds } } });
    await prisma.cart.deleteMany({ where: { tenantId, id: { in: cartIds } } });
    await prisma.product.deleteMany({ where: { tenantId, id: { in: productIds } } });
    if (app) await app.close();
    await prisma.$disconnect();
  }, 60_000);

  it('forged browsing state cannot grant alcohol purchase eligibility', async () => {
    const fixture = await cartFor(alcoholProductId, true, 18);
    await expect(
      inTenant(() => checkout.validate({ guestSessionId: fixture.sessionId }, 'SW1A 1AA')),
    ).rejects.toMatchObject({ response: { code: 'AGE_VERIFICATION_REQUIRED' } });
  });

  it('valid gate cookie alone grants NO purchase eligibility', async () => {
    const fixture = await cartFor(alcoholProductId, true, 18);
    const gateSession = crypto.randomUUID();
    expect(gateTokens.verify(gateTokens.issue(gateSession), gateSession)).toBe(true);
    await expect(
      inTenant(() => checkout.validate({ guestSessionId: fixture.sessionId }, 'SW1A 1AA')),
    ).rejects.toMatchObject({ response: { code: 'AGE_VERIFICATION_REQUIRED' } });
  });

  it('Scottish postcode + 22:30 Europe/London → 403 OUTSIDE_PERMITTED_SALE_HOURS with reopensAt', async () => {
    const fixture = await cartFor(alcoholProductId, true, 18);
    const verification = await prisma.ageVerification.create({
      data: {
        tenantId,
        guestToken: fixture.sessionId,
        provider: 'DIRECT',
        providerSessionId: crypto.randomUUID(),
        status: 'PASSED',
        verifiedAgeOver: 18,
        method: 'DOB_DECLARATION',
        verifiedAt: new Date(),
        expiresAt: new Date('2027-10-05T00:00:00.000Z'),
        declaredDateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      },
    });
    verificationIds.push(verification.id);
    let rejection: unknown;
    try {
      await inTenant(() =>
        checkout.validate(
          { guestSessionId: fixture.sessionId },
          'EH1 1AA',
          new Date('2026-10-05T21:30:00.000Z'),
        ),
      );
    } catch (error: unknown) {
      rejection = error;
    }
    expect(rejection).toMatchObject({
      response: {
        code: 'OUTSIDE_PERMITTED_SALE_HOURS',
        details: { jurisdiction: 'SCOTLAND' },
      },
    });
    const response = (rejection as { response: { details: { reopensAt: unknown } } }).response;
    expect(typeof response.details.reopensAt).toBe('string');
  });

  it('Scottish postcode + slot at 02:00 → slot unavailable for alcohol basket', async () => {
    await expect(
      inTenant(() =>
        jurisdictions.isDeliveryTimeAllowed('EH1 1AA', new Date('2026-10-05T01:00:00.000Z'), true),
      ),
    ).resolves.toBe(false);
  });

  it('0.4% ABV product with ageRestriction=0 is purchasable without verification', async () => {
    const fixture = await cartFor(lowAbvProductId, false, 0);
    await expect(
      inTenant(() => checkout.validate({ guestSessionId: fixture.sessionId }, 'SW1A 1AA')),
    ).resolves.toMatchObject({ valid: true, requiresAgeVerification: false });
  });

  it('0.0% product manually flagged ageRestriction=18 DOES require verification', async () => {
    const fixture = await cartFor(policyProductId, false, 18);
    await expect(
      inTenant(() => checkout.validate({ guestSessionId: fixture.sessionId }, 'SW1A 1AA')),
    ).rejects.toMatchObject({ response: { code: 'AGE_VERIFICATION_REQUIRED' } });
  });

  it('direct DOB is stored privately and never returned or copied into the audit payload', async () => {
    const guestSessionId = crypto.randomUUID();
    const result = await inTenant(() =>
      verificationService.declareDob({ guestSessionId }, { dateOfBirth: '1990-02-03' }),
    );
    expect(result).toMatchObject({ status: 'PASSED', method: 'DOB_DECLARATION', isOver18: true });
    expect(result).not.toHaveProperty('declaredDateOfBirth');
    const record = await prisma.ageVerification.findFirstOrThrow({
      where: { tenantId, guestToken: guestSessionId },
    });
    verificationIds.push(record.id);
    expect(record.declaredDateOfBirth?.toISOString().slice(0, 10)).toBe('1990-02-03');
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { tenantId, entity: 'AgeVerification', entityId: record.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit.after)).not.toContain('1990-02-03');
  });

  it('database rejects age verifications with zero or multiple owners', async () => {
    const base = {
      tenantId,
      provider: 'DIRECT',
      status: 'FAILED' as const,
      method: 'DOB_DECLARATION' as const,
    };
    await expect(
      prisma.ageVerification.create({
        data: { ...base, providerSessionId: crypto.randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.ageVerification.create({
        data: {
          ...base,
          providerSessionId: crypto.randomUUID(),
          userId: '00000000-0000-4000-8000-000000000001',
          guestToken: crypto.randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });
});

async function cartFor(productId: string, isAlcohol: boolean, ageRestriction: number) {
  const issued = guestTokens.issue();
  const cart = await prisma.cart.create({
    data: { tenantId, guestToken: issued.sessionId, expiresAt: issued.expiresAt },
  });
  cartIds.push(cart.id);
  await prisma.cartItem.create({
    data: {
      tenantId,
      cartId: cart.id,
      productId,
      quantity: 1,
      orderCategory: isAlcohol ? 'ALCOHOL' : 'GROCERY',
      priceSnapshotMinor: 500n,
      snapshotAgeRestriction: ageRestriction,
      snapshotStaleAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  return { sessionId: issued.sessionId, cookie: `guest_cart=${issued.token}` };
}

function inTenant<T>(work: () => T): T {
  return TenantContext.run({ tenantId, requestId: 'age-direct-e2e' }, work);
}
