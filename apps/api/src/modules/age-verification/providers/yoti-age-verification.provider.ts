import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AgeVerificationContext,
  AgeVerificationProvider,
  AgeVerificationOutcome,
  AgeVerificationResult,
} from '@app/ports';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../../common/config/app-config.service';

interface YotiResponse {
  session_id: string;
  status: string;
  verified_age_over?: number;
  reference?: string;
  client_session_token_ttl?: number;
}

@Injectable()
export class YotiAgeVerificationProvider implements AgeVerificationProvider {
  readonly name = 'YOTI';

  constructor(private readonly config: AppConfigService) {}

  health(): Promise<{ ok: boolean }> {
    return Promise.resolve({
      ok: Boolean(
        this.config.values.YOTI_CLIENT_SDK_ID &&
        this.config.values.YOTI_KEY_FILE_PATH &&
        this.config.values.YOTI_WEBHOOK_SECRET,
      ),
    });
  }

  async initiate(
    subjectId: string,
    context: AgeVerificationContext,
  ): Promise<AgeVerificationResult> {
    const sdkId = this.requireConfiguration();
    const response = await fetch(
      `${this.config.values.YOTI_API_BASE_URL}/v1/age-verification/sessions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${sdkId}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subject_id: subjectId,
          required_age: context.requiredAge,
          return_url: context.returnUrl,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new BadGatewayException('Yoti session creation failed');
    return this.map((await response.json()) as YotiResponse);
  }

  async getResult(sessionId: string): Promise<AgeVerificationResult> {
    const sdkId = this.requireConfiguration();
    const response = await fetch(
      `${this.config.values.YOTI_API_BASE_URL}/v1/age-verification/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { authorization: `Bearer ${sdkId}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new BadGatewayException('Yoti result retrieval failed');
    return this.map((await response.json()) as YotiResponse);
  }

  handleWebhook(payload: Uint8Array, signature: string): Promise<AgeVerificationResult> {
    return Promise.resolve().then(() => {
      const secret = this.config.values.YOTI_WEBHOOK_SECRET;
      if (!secret) throw new ServiceUnavailableException('Yoti webhook secret is not configured');
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      const received = signature.replace(/^sha256=/, '');
      if (
        received.length !== expected.length ||
        !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
      )
        throw new UnauthorizedException('Invalid Yoti webhook signature');
      return this.map(JSON.parse(Buffer.from(payload).toString('utf8')) as YotiResponse);
    });
  }

  private requireConfiguration(): string {
    const sdkId = this.config.values.YOTI_CLIENT_SDK_ID;
    if (!sdkId || !this.config.values.YOTI_KEY_FILE_PATH)
      throw new ServiceUnavailableException('Yoti credentials are not configured');
    return sdkId;
  }

  private map(value: YotiResponse): AgeVerificationResult {
    const outcome = normalize(value.status);
    return {
      sessionId: value.session_id,
      outcome,
      ...(value.verified_age_over === undefined
        ? {}
        : { verifiedAgeOver: value.verified_age_over }),
      method: 'DVS',
      ...(value.reference ? { providerRef: value.reference } : {}),
    };
  }
}

function normalize(status: string): AgeVerificationOutcome {
  if (status === 'PASSED' || status === 'FAILED' || status === 'CANCELLED') return status;
  return 'PENDING';
}
