import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { CatalogImportController } from '../../src/modules/import/catalog-import.controller';
import { CatalogImportService } from '../../src/modules/import/catalog-import.service';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
let app: INestApplication;
let adminId = '';
let jobId = '';

describe('catalog import HTTP E2E', () => {
  beforeAll(async () => {
    adminId = (await prisma.user.findFirstOrThrow({ where: { tenantId, email: 'admin@example.test' } })).id;
    const imports = new CatalogImportService(new TenantScopedPrismaService(prisma));
    const moduleRef = await Test.createTestingModule({ controllers: [CatalogImportController], providers: [{ provide: CatalogImportService, useValue: imports }] }).compile();
    app = moduleRef.createNestApplication();
    app.use((_request: Request, _response: Response, next: NextFunction) => TenantContext.run({ tenantId, userId: adminId, requestId: 'import-e2e' }, next));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (jobId) {
      await prisma.importError.deleteMany({ where: { importJobId: jobId } });
      await prisma.importJob.deleteMany({ where: { id: jobId } });
    }
    if (app) await app.close();
    await prisma.$disconnect();
  }, 30_000);

  it('accepts multipart CSV, validates it, and returns a dry-run diff', async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId, active: true } });
    const suffix = Date.now().toString(36);
    const csv = [
      'sku,slug,name,description,categorySlug,priceMinor,vatRateBps,restrictionReason,ageRestriction,abv',
      `E2E-${suffix},e2e-${suffix},E2E Product,Import E2E product,${category.slug},299,0,NONE,0,`,
    ].join('\n');
    const httpServer = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .post('/api/v1/catalog/imports?duplicatePolicy=fail&dryRun=true')
      .attach('file', Buffer.from(csv), { filename: 'catalog.csv', contentType: 'text/csv' })
      .expect(201);
    const body = response.body as unknown as { jobId: string; applied: number; changes: Array<{ sku: string; operation: string }> };
    jobId = body.jobId;
    expect(body.applied).toBe(0);
    expect(body.changes).toEqual([{ sku: `E2E-${suffix}`, operation: 'create' }]);
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('READY');
    expect(job.dryRun).toBe(true);
  }, 30_000);
});
