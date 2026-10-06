import { Injectable } from '@nestjs/common';
import type { AgeVerificationProvider, AgeVerificationResult } from '@app/ports';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ManualReviewAgeVerificationProvider implements AgeVerificationProvider {
  readonly name = 'MANUAL_REVIEW';

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({ ok: true });
  }

  initiate(): Promise<AgeVerificationResult> {
    return Promise.resolve({
      sessionId: randomUUID(),
      outcome: 'PENDING',
      method: 'MANUAL_REVIEW',
    });
  }

  getResult(sessionId: string): Promise<AgeVerificationResult> {
    return Promise.resolve({ sessionId, outcome: 'PENDING', method: 'MANUAL_REVIEW' });
  }

  handleWebhook(payload: Uint8Array): Promise<AgeVerificationResult> {
    const value = JSON.parse(Buffer.from(payload).toString('utf8')) as {
      sessionId: string;
      outcome: 'PASSED' | 'FAILED';
      verifiedAgeOver?: number;
      reviewerRef?: string;
    };
    return Promise.resolve({
      sessionId: value.sessionId,
      outcome: value.outcome,
      ...(value.verifiedAgeOver === undefined ? {} : { verifiedAgeOver: value.verifiedAgeOver }),
      method: 'MANUAL_REVIEW',
      ...(value.reviewerRef ? { providerRef: value.reviewerRef } : {}),
    });
  }
}
