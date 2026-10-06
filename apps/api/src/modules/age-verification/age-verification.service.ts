import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AgeVerificationProvider, AgeVerificationResult } from '@app/ports';
import type { AgeVerificationMethod, AgeVerificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { dobDeclarationSchema, providerSessionSchema } from './age-verification.schemas';
import { ManualReviewAgeVerificationProvider } from './providers/manual-review-age-verification.provider';
import { StubAgeVerificationProvider } from './providers/stub-age-verification.provider';
import { YotiAgeVerificationProvider } from './providers/yoti-age-verification.provider';

export type AgeIdentity = { userId: string } | { guestSessionId: string };

@Injectable()
export class AgeVerificationService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly config: AppConfigService,
    private readonly stub: StubAgeVerificationProvider,
    private readonly yoti: YotiAgeVerificationProvider,
    private readonly manual: ManualReviewAgeVerificationProvider,
  ) {}

  async current(identity: AgeIdentity) {
    const record = await this.db.client.ageVerification.findFirst({
      where: this.owner(identity),
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return { status: 'NOT_REQUIRED', isOver18: false };
    const status =
      record.status === 'PASSED' && (!record.expiresAt || record.expiresAt <= new Date())
        ? 'EXPIRED'
        : record.status;
    return this.publicResult({ ...record, status });
  }

  async declareDob(identity: AgeIdentity, raw: unknown) {
    const { dateOfBirth } = dobDeclarationSchema.parse(raw);
    const dob = parseDob(dateOfBirth);
    const age = ageOn(dob, new Date());
    if (age < 0 || age > 130)
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'Date of birth is invalid',
      });
    const passed = age >= 18;
    const record = await this.db.transaction(async (tx, tenantId) => {
      const created = await tx.ageVerification.create({
        data: {
          tenantId,
          ...this.owner(identity),
          provider: 'DIRECT',
          providerSessionId: randomUUID(),
          status: passed ? 'PASSED' : 'FAILED',
          verifiedAgeOver: age,
          method: 'DOB_DECLARATION',
          verifiedAt: passed ? new Date() : null,
          expiresAt: passed ? this.expiry() : null,
          declaredDateOfBirth: dob,
        },
      });
      await this.audit(tx, created.id, passed ? 'PASSED' : 'FAILED', identity, {
        method: 'DOB_DECLARATION',
        isOver18: passed,
      });
      return created;
    });
    return this.publicResult(record);
  }

  async initiate(identity: AgeIdentity, raw: unknown) {
    const input = providerSessionSchema.parse(raw);
    if (input.provider === 'YOTI' && !(await this.digitalProofEnabled()))
      throw new ForbiddenException({
        code: 'DIGITAL_PROOF_OF_AGE_DISABLED',
        message:
          'Digital proof of age is disabled until the merchant confirms its registered provider',
      });
    const provider = this.provider(input.provider);
    const result = await provider.initiate(this.subject(identity), {
      requiredAge: 18,
      ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
      ...(input.postcode ? { postcode: input.postcode } : {}),
      ...(input.testDateOfBirth ? { dateOfBirth: input.testDateOfBirth } : {}),
    });
    const record = await this.persistProviderResult(identity, provider.name, result);
    return {
      ...this.publicResult(record),
      ...(result.redirectUrl ? { redirectUrl: result.redirectUrl } : {}),
    };
  }

  async providerResult(identity: AgeIdentity, providerName: string, sessionId: string) {
    const provider = this.provider(providerName);
    const result = await provider.getResult(sessionId);
    const record = await this.updateProviderResult(identity, provider.name, result);
    return this.publicResult(record);
  }

  async webhook(providerName: string, payload: Uint8Array, signature: string) {
    const provider = this.provider(providerName);
    const result = await provider.handleWebhook(payload, signature);
    const existing = await this.db.client.ageVerification.findFirst({
      where: { provider: provider.name, providerSessionId: result.sessionId },
    });
    if (!existing) throw new NotFoundException('Age verification session was not found');
    const identity: AgeIdentity = existing.userId
      ? { userId: existing.userId }
      : { guestSessionId: existing.guestToken as string };
    const record = await this.updateProviderResult(identity, provider.name, result);
    return this.publicResult(record);
  }

  private async persistProviderResult(
    identity: AgeIdentity,
    provider: string,
    result: AgeVerificationResult,
  ) {
    return this.db.transaction(async (tx, tenantId) => {
      const status = statusOf(result.outcome);
      const created = await tx.ageVerification.create({
        data: {
          tenantId,
          ...this.owner(identity),
          provider,
          providerSessionId: result.sessionId,
          status,
          verifiedAgeOver: result.verifiedAgeOver ?? null,
          method: result.method,
          providerRef: result.providerRef ?? null,
          verifiedAt: status === 'PASSED' ? new Date() : null,
          expiresAt: status === 'PASSED' ? this.expiry() : null,
        },
      });
      await this.audit(tx, created.id, status, identity, {
        method: result.method,
        provider,
        verifiedAgeOver: result.verifiedAgeOver ?? null,
      });
      return created;
    });
  }

  private async updateProviderResult(
    identity: AgeIdentity,
    provider: string,
    result: AgeVerificationResult,
  ) {
    return this.db.transaction(async (tx, tenantId) => {
      const current = await tx.ageVerification.findFirst({
        where: {
          tenantId,
          provider,
          providerSessionId: result.sessionId,
          ...this.owner(identity),
        },
      });
      if (!current) throw new NotFoundException('Age verification session was not found');
      const status = statusOf(result.outcome);
      const updated = await tx.ageVerification.update({
        where: { id: current.id },
        data: {
          status,
          verifiedAgeOver: result.verifiedAgeOver ?? current.verifiedAgeOver,
          providerRef: result.providerRef ?? current.providerRef,
          verifiedAt: status === 'PASSED' ? new Date() : null,
          expiresAt: status === 'PASSED' ? this.expiry() : null,
        },
      });
      await this.audit(tx, current.id, status, identity, {
        method: result.method,
        provider,
        verifiedAgeOver: result.verifiedAgeOver ?? null,
      });
      return updated;
    });
  }

  private provider(name: string): AgeVerificationProvider {
    if (name === 'STUB') return this.stub;
    if (name === 'YOTI') return this.yoti;
    if (name === 'MANUAL_REVIEW') return this.manual;
    throw new UnprocessableEntityException({
      code: 'AGE_PROVIDER_UNSUPPORTED',
      message: 'Age verification provider is unsupported',
    });
  }

  private owner(identity: AgeIdentity) {
    return 'userId' in identity
      ? { userId: identity.userId, guestToken: null }
      : { userId: null, guestToken: identity.guestSessionId };
  }

  private subject(identity: AgeIdentity): string {
    return 'userId' in identity ? identity.userId : identity.guestSessionId;
  }

  private expiry(): Date {
    return new Date(Date.now() + this.config.values.AGE_VERIFICATION_TTL_DAYS * 86_400_000);
  }

  private async digitalProofEnabled(): Promise<boolean> {
    const settings = await this.db.client.tenantSettings.findFirst();
    const value = settings?.settings as
      { alcohol?: { acceptDigitalProofOfAge?: unknown } } | undefined;
    return value?.alcohol?.acceptDigitalProofOfAge === true;
  }

  private publicResult(record: {
    status: AgeVerificationStatus;
    method: AgeVerificationMethod;
    provider: string;
    verifiedAgeOver: number | null;
    verifiedAt: Date | null;
    expiresAt: Date | null;
  }) {
    return {
      status: record.status,
      method: record.method,
      provider: record.provider,
      isOver18: (record.verifiedAgeOver ?? 0) >= 18 && record.status === 'PASSED',
      verifiedAt: record.verifiedAt,
      expiresAt: record.expiresAt,
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    entityId: string,
    status: AgeVerificationStatus,
    identity: AgeIdentity,
    after: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        actorId: 'userId' in identity ? identity.userId : null,
        actorType: 'userId' in identity ? 'USER' : 'GUEST',
        action: `AGE_VERIFICATION_${status}`,
        entity: 'AgeVerification',
        entityId,
        after,
        requestId: TenantContext.get()?.requestId ?? randomUUID(),
      },
    });
  }
}

function parseDob(input: string): Date {
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input)
    throw new UnprocessableEntityException({
      code: 'INVALID_DATE_OF_BIRTH',
      message: 'Date of birth is invalid',
    });
  return date;
}

function ageOn(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())
  )
    age -= 1;
  return age;
}

function statusOf(outcome: AgeVerificationResult['outcome']): AgeVerificationStatus {
  return outcome === 'CANCELLED' ? 'FAILED' : outcome;
}
