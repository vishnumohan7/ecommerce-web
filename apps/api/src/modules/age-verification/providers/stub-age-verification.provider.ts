import { Injectable } from '@nestjs/common';
import type {
  AgeVerificationContext,
  AgeVerificationProvider,
  AgeVerificationResult,
} from '@app/ports';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StubAgeVerificationProvider implements AgeVerificationProvider {
  readonly name = 'STUB';
  private readonly results = new Map<string, AgeVerificationResult>();

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }

  initiate(_subjectId: string, context: AgeVerificationContext): Promise<AgeVerificationResult> {
    const sessionId = randomUUID();
    const age = context.dateOfBirth ? ageOn(context.dateOfBirth, new Date()) : undefined;
    const result: AgeVerificationResult = {
      sessionId,
      outcome: age === undefined ? 'PENDING' : age >= context.requiredAge ? 'PASSED' : 'FAILED',
      ...(age === undefined ? {} : { verifiedAgeOver: age }),
      method: 'DVS',
      providerRef: `stub-${sessionId}`,
    };
    this.results.set(sessionId, result);
    return Promise.resolve(result);
  }

  getResult(sessionId: string): Promise<AgeVerificationResult> {
    return Promise.resolve(
      this.results.get(sessionId) ?? {
        sessionId,
        outcome: 'PENDING',
        method: 'DVS',
      },
    );
  }

  handleWebhook(payload: Uint8Array): Promise<AgeVerificationResult> {
    const value = JSON.parse(Buffer.from(payload).toString('utf8')) as {
      sessionId: string;
      outcome: 'PENDING' | 'PASSED' | 'FAILED' | 'CANCELLED';
      verifiedAgeOver?: number;
    };
    const result: AgeVerificationResult = {
      sessionId: value.sessionId,
      outcome: value.outcome,
      ...(value.verifiedAgeOver === undefined ? {} : { verifiedAgeOver: value.verifiedAgeOver }),
      method: 'DVS',
      providerRef: `stub-${value.sessionId}`,
    };
    this.results.set(value.sessionId, result);
    return Promise.resolve(result);
  }
}

function ageOn(dateOfBirth: string, now: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return -1;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day))
    age -= 1;
  return age;
}
