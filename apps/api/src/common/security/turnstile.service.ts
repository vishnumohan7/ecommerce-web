import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
@Injectable()
export class TurnstileService {
  constructor(private readonly config: AppConfigService) {}
  get enabled(): boolean { return Boolean(this.config.values.TURNSTILE_SECRET); }
  async verify(token: string, remoteIp?: string): Promise<void> { const secret = this.config.values.TURNSTILE_SECRET; if (!secret && this.config.values.NODE_ENV !== 'production') return; if (!secret) throw new BadRequestException('Turnstile is not configured'); const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }) }); const result = await response.json() as { success?: boolean }; if (result.success !== true) throw new BadRequestException('Abuse-protection challenge failed'); }
}
