import type { Prisma } from '@prisma/client';

export async function allocateCommerceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number,
  kind: 'ORDER' | 'INVOICE',
): Promise<bigint> {
  if (kind === 'ORDER')
    await tx.$executeRaw`INSERT INTO "CommerceNumberCounter" ("tenantId", "year", "kind", "nextValue", "updatedAt") SELECT ${tenantId}::uuid, ${year}, 'ORDER', COALESCE(MAX("orderNumber"), 0) + 1, CURRENT_TIMESTAMP FROM "Order" WHERE "tenantId" = ${tenantId}::uuid AND "orderNumberYear" = ${year} ON CONFLICT ("tenantId", "year", "kind") DO NOTHING`;
  else
    await tx.$executeRaw`INSERT INTO "CommerceNumberCounter" ("tenantId", "year", "kind", "nextValue", "updatedAt") SELECT ${tenantId}::uuid, ${year}, 'INVOICE', COALESCE(MAX("invoiceNumber"), 0) + 1, CURRENT_TIMESTAMP FROM "Invoice" WHERE "tenantId" = ${tenantId}::uuid AND "invoiceNumberYear" = ${year} ON CONFLICT ("tenantId", "year", "kind") DO NOTHING`;
  const rows = await tx.$queryRaw<
    Array<{ nextValue: bigint }>
  >`SELECT "nextValue" FROM "CommerceNumberCounter" WHERE "tenantId" = ${tenantId}::uuid AND "year" = ${year} AND "kind" = ${kind} FOR UPDATE`;
  const value = rows[0]?.nextValue;
  if (value === undefined) throw new Error('Unable to allocate commerce number');
  await tx.$executeRaw`UPDATE "CommerceNumberCounter" SET "nextValue" = "nextValue" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = ${tenantId}::uuid AND "year" = ${year} AND "kind" = ${kind}`;
  return value;
}
