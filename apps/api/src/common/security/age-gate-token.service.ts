import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service';

interface GatePayload {
  sessionId: string;
  expiresAt: number;
}

@Injectable()
export class AgeGateTokenService {
  private readonly secret: string;
  constructor(config: AppConfigService) {
    this.secret = config.values.AGE_GATE_SECRET ?? config.values.JWT_ACCESS_SECRET;
  }

  issue(sessionId: string, ttlSeconds = 30 * 24 * 60 * 60): string {
    const payload = Buffer.from(
      JSON.stringify({
        sessionId,
        expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
      } satisfies GatePayload),
    ).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string | undefined, sessionId: string | undefined): boolean {
    if (!token || !sessionId) return false;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = this.sign(payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return false;
    try {
      const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GatePayload;
      return (
        value.sessionId === sessionId &&
        Number.isInteger(value.expiresAt) &&
        value.expiresAt > Math.floor(Date.now() / 1000)
      );
    } catch {
      return false;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
