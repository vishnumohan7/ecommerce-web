import 'dotenv/config';
import { createHmac } from 'node:crypto';
import type { AgeVerificationProvider } from '@app/ports';
import { describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../src/common/config/app-config.service';
import { ManualReviewAgeVerificationProvider } from '../src/modules/age-verification/providers/manual-review-age-verification.provider';
import { StubAgeVerificationProvider } from '../src/modules/age-verification/providers/stub-age-verification.provider';
import { YotiAgeVerificationProvider } from '../src/modules/age-verification/providers/yoti-age-verification.provider';

function contract(name: string, provider: () => AgeVerificationProvider) {
  describe(`${name} age-verification contract`, () => {
    it('reports health and creates a provider session', async () => {
      const implementation = provider();
      expect(await implementation.health()).toEqual({ ok: true });
      const result = await implementation.initiate('subject-1', { requiredAge: 18 });
      expect(result.sessionId).toBeTruthy();
      expect(['DOB_DECLARATION', 'DVS', 'MANUAL_REVIEW']).toContain(result.method);
    });
  });
}

contract('stub', () => new StubAgeVerificationProvider());
contract('manual review', () => new ManualReviewAgeVerificationProvider());
contract('Yoti', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session_id: 'yoti-session', status: 'PENDING' }),
    }),
  );
  return new YotiAgeVerificationProvider({
    values: {
      YOTI_CLIENT_SDK_ID: 'configured-sdk-id',
      YOTI_KEY_FILE_PATH: '/external-drive/merchant.pem',
      YOTI_WEBHOOK_SECRET: 'configured-webhook-secret-at-least-32-characters',
      YOTI_API_BASE_URL: 'https://api.yoti.test',
    },
  } as unknown as AppConfigService);
});

describe('provider privacy and signatures', () => {
  it('stub is deterministic from a test DOB without exposing the DOB', async () => {
    const result = await new StubAgeVerificationProvider().initiate('subject', {
      requiredAge: 18,
      dateOfBirth: '1990-01-01',
    });
    expect(result.outcome).toBe('PASSED');
    expect(result.verifiedAgeOver).toBeGreaterThanOrEqual(18);
    expect(JSON.stringify(result)).not.toContain('1990-01-01');
  });

  it('Yoti rejects a forged webhook signature', async () => {
    const provider = new YotiAgeVerificationProvider({
      values: {
        YOTI_WEBHOOK_SECRET: 'configured-webhook-secret-at-least-32-characters',
        YOTI_API_BASE_URL: 'https://api.yoti.test',
      },
    } as unknown as AppConfigService);
    await expect(provider.handleWebhook(Buffer.from('{}'), 'forged')).rejects.toThrow(
      'Invalid Yoti webhook signature',
    );
    const payload = Buffer.from(
      JSON.stringify({ session_id: 'session', status: 'PASSED', verified_age_over: 18 }),
    );
    const signature = createHmac('sha256', 'configured-webhook-secret-at-least-32-characters')
      .update(payload)
      .digest('hex');
    await expect(provider.handleWebhook(payload, signature)).resolves.toMatchObject({
      outcome: 'PASSED',
      verifiedAgeOver: 18,
    });
  });
});
