import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { decryptConfigSecret } from '../../common/security/config-secret';

type PaymentSettings = {
  enabled?: boolean;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
};

@Injectable()
export class PaymentConfigurationService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly config: AppConfigService,
  ) {}

  async publicConfiguration() {
    const settings = await this.settings();
    const publishableKey =
      settings.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const secretKey = await this.stripeSecret();
    const webhookSecret = await this.webhookSecret();
    const enabled =
      settings.enabled !== false && Boolean(publishableKey && secretKey && webhookSecret);
    return {
      enabled,
      provider: 'stripe',
      mode: publishableKey?.startsWith('pk_live_') ? 'live' : 'test',
      publishableKey: enabled ? publishableKey : '',
    };
  }

  async stripeSecret() {
    const settings = await this.settings();
    return this.decrypt(settings.secretKey) || this.config.values.STRIPE_SECRET_KEY || '';
  }

  async webhookSecret() {
    const settings = await this.settings();
    return this.decrypt(settings.webhookSecret) || this.config.values.STRIPE_WEBHOOK_SECRET || '';
  }

  async testConnection() {
    const secret = await this.stripeSecret();
    if (!secret) throw new BadRequestException('Stripe secret key is not configured');
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const account = (await response.json()) as {
      id?: string;
      country?: string;
      charges_enabled?: boolean;
      error?: { message?: string };
    };
    if (!response.ok || !account.id)
      throw new BadRequestException(account.error?.message ?? 'Stripe connection failed');
    return {
      connected: true,
      accountId: account.id,
      country: account.country ?? null,
      chargesEnabled: account.charges_enabled === true,
      mode: secret.startsWith('sk_live_') ? 'live' : 'test',
    };
  }

  private async settings(): Promise<PaymentSettings> {
    const record = await this.db.client.tenantSettings.findFirst();
    const root = this.record(record?.settings);
    const integrations = this.record(root.integrations);
    return this.record(integrations.payment);
  }

  private decrypt(value: string | undefined) {
    return value ? decryptConfigSecret(value, this.config.values.JWT_ACCESS_SECRET) : '';
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
