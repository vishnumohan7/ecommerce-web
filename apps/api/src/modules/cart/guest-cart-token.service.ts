import { Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';

interface GuestPayload {
  sessionId: string;
  expiresAt: number;
}

@Injectable()
export class GuestCartTokenService {
  private readonly secret: string;
  constructor(config: AppConfigService) {
    this.secret = config.values.GUEST_CART_SECRET ?? config.values.JWT_ACCESS_SECRET;
  }

  issue(): { token: string; sessionId: string; expiresAt: Date } {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sessionId,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
      } satisfies GuestPayload),
    ).toString('base64url');
    return { token: `${payload}.${this.sign(payload)}`, sessionId, expiresAt };
  }

  verify(token?: string): { sessionId: string; expiresAt: Date } | undefined {
    if (!token) return undefined;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return undefined;
    const expected = this.sign(payload);
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      return undefined;
    try {
      const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GuestPayload;
      const expiresAt = new Date(value.expiresAt * 1000);
      if (!value.sessionId || expiresAt.getTime() <= Date.now()) return undefined;
      return { sessionId: value.sessionId, expiresAt };
    } catch {
      return undefined;
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}
