import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';
import { TenantContext } from '../tenancy/tenant-context';

const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEArzHpQnpER+0vEjEyNrGTdvvY/CMp2Hjsdemqi/u6O5E=
-----END PUBLIC KEY-----`;
const payloadSchema = z.object({ licenseId: z.string().min(1), tenantId: z.string().uuid(), edition: z.enum(['STANDARD', 'PRO']), seats: z.number().int().positive(), expiresAt: z.string().datetime(), features: z.array(z.string()) });
export type LicenseClaims = z.infer<typeof payloadSchema>;

@Injectable()
export class LicenseService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  async validate(token: string): Promise<LicenseClaims> { const parts = token.split('.'); if (parts.length !== 3) throw new UnauthorizedException('Licence token is malformed'); const [header, payload, signature] = parts as [string, string, string]; const headerValue = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string }; if (headerValue.alg !== 'EdDSA') throw new UnauthorizedException('Licence algorithm is invalid'); const valid = verify(null, Buffer.from(`${header}.${payload}`), createPublicKey(LICENSE_PUBLIC_KEY_PEM), Buffer.from(signature, 'base64url')); if (!valid) throw new UnauthorizedException('Licence signature is invalid'); const claims = payloadSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))); if (claims.tenantId !== TenantContext.requireTenantId()) throw new UnauthorizedException('Licence tenant is invalid'); const tokenHash = createHash('sha256').update(token).digest('hex'); await this.db.client.licenseRecord.upsert({ where: { tenantId: claims.tenantId }, update: { licenseId: claims.licenseId, edition: claims.edition, seats: claims.seats, expiresAt: new Date(claims.expiresAt), features: claims.features, tokenHash, validatedAt: new Date() }, create: { tenantId: claims.tenantId, licenseId: claims.licenseId, edition: claims.edition, seats: claims.seats, expiresAt: new Date(claims.expiresAt), features: claims.features, tokenHash, validatedAt: new Date() } }); return claims; }
  async state(): Promise<{ valid: boolean; readOnlyAdmin: boolean; features: string[] }> { const record = await this.db.client.licenseRecord.findFirst(); const valid = Boolean(record && record.expiresAt > new Date()); return { valid, readOnlyAdmin: !valid, features: record?.features ?? [] }; }
}
