import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { allocateCommerceNumber } from '../../src/modules/payments/commerce-number';

const prisma = new PrismaService();
const tenantId = '00000000-0000-4000-8000-000000000001';
const year = randomInt(3000, 9000);

describe('gapless commerce numbering E2E', () => {
  beforeAll(async () => {
    await prisma.commerceNumberCounter.deleteMany({
      where: { tenantId, year: { gte: 3000 } },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.commerceNumberCounter.deleteMany({ where: { tenantId, year } });
    await prisma.$disconnect();
  }, 60_000);

  it('allocates an exact gapless sequence across 200 concurrent transactions and rollback', async () => {
    const values = await Promise.all(
      Array.from({ length: 200 }, () =>
        prisma.$transaction((tx) => allocateCommerceNumber(tx, tenantId, year, 'ORDER'), {
          maxWait: 120_000,
          timeout: 120_000,
        }),
      ),
    );
    expect(values.map(Number).sort((left, right) => left - right)).toEqual(
      Array.from({ length: 200 }, (_, index) => index + 1),
    );

    await expect(
      prisma.$transaction(
        async (tx) => {
          await allocateCommerceNumber(tx, tenantId, year, 'ORDER');
          throw new Error('force rollback');
        },
        { maxWait: 120_000, timeout: 120_000 },
      ),
    ).rejects.toThrow('force rollback');

    const next = await prisma.$transaction(
      (tx) => allocateCommerceNumber(tx, tenantId, year, 'ORDER'),
      { maxWait: 120_000, timeout: 120_000 },
    );
    expect(next).toBe(201n);
  }, 180_000);
});
