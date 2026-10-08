import { Injectable, Optional } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { decryptConfigSecret } from '../../common/security/config-secret';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';

export interface NotificationSend {
  recipient: string;
  subject?: string | null;
  body: string;
  data: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationSend): Promise<{ messageId: string }>;
}

abstract class LoggingProvider implements NotificationProvider {
  abstract readonly channel: NotificationChannel;
  async send(_message: NotificationSend): Promise<{ messageId: string }> {
    return { messageId: `${this.channel.toLowerCase()}-${randomUUID()}` };
  }
}

@Injectable()
export class EmailProvider extends LoggingProvider {
  readonly channel = 'EMAIL' as const;
  constructor(
    @Optional() private readonly db?: TenantScopedPrismaService,
    @Optional() private readonly config?: AppConfigService,
  ) {
    super();
  }

  override async send(message: NotificationSend): Promise<{ messageId: string }> {
    const stored = this.db ? await this.db.client.tenantSettings.findFirst() : null;
    const root = this.record(stored?.settings);
    const integrations = this.record(root.integrations);
    const email = this.record(integrations.email);
    const provider =
      typeof email.provider === 'string'
        ? email.provider
        : process.env.EMAIL_PROVIDER?.toUpperCase();
    if (provider === 'SMTP') return this.sendSmtp(message, email);
    if (provider !== 'RESEND') {
      if (process.env.NODE_ENV === 'production')
        throw new Error('No production email provider is configured');
      return super.send(message);
    }
    const encryptedKey = typeof email.resendApiKey === 'string' ? email.resendApiKey : '';
    const apiKey = encryptedKey
      ? decryptConfigSecret(encryptedKey, this.encryptionKey())
      : process.env.RESEND_API_KEY;
    const from = this.sender(email) || process.env.EMAIL_FROM;
    if (!apiKey || !from)
      throw new Error('Resend email is enabled but RESEND_API_KEY or EMAIL_FROM is missing');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.recipient],
        ...(typeof email.replyTo === 'string' && email.replyTo
          ? { reply_to: email.replyTo }
          : process.env.EMAIL_REPLY_TO
            ? { reply_to: process.env.EMAIL_REPLY_TO }
            : {}),
        subject: message.subject ?? 'Denes Commerce update',
        text: message.body,
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map(({ filename, content }) => ({
                filename,
                content,
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      message?: string;
    } | null;
    if (!response.ok || !payload?.id)
      throw new Error(payload?.message ?? `Email provider returned ${String(response.status)}`);
    return { messageId: payload.id };
  }

  private async sendSmtp(message: NotificationSend, email: Record<string, unknown>) {
    const password =
      typeof email.smtpPassword === 'string' && email.smtpPassword
        ? decryptConfigSecret(email.smtpPassword, this.encryptionKey())
        : '';
    const transporter = nodemailer.createTransport({
      host: String(email.smtpHost ?? ''),
      port: Number(email.smtpPort ?? 587),
      secure: email.smtpSecure === true,
      auth: { user: String(email.smtpUsername ?? ''), pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    const result = await transporter.sendMail({
      from: this.sender(email),
      to: message.recipient,
      replyTo: typeof email.replyTo === 'string' && email.replyTo ? email.replyTo : undefined,
      subject: message.subject ?? 'Denes Commerce update',
      text: message.body,
      attachments: message.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, 'base64'),
        contentType: attachment.contentType,
      })),
    });
    return { messageId: result.messageId };
  }

  private sender(email: Record<string, unknown>) {
    const address = typeof email.fromEmail === 'string' ? email.fromEmail : '';
    const name = typeof email.fromName === 'string' ? email.fromName : '';
    return address ? (name ? `${name} <${address}>` : address) : '';
  }

  private encryptionKey() {
    const key = this.config?.values.JWT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!key) throw new Error('JWT_ACCESS_SECRET is required to decrypt mail credentials');
    return key;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}

export class SmsProvider extends LoggingProvider {
  readonly channel = 'SMS' as const;
}

export class PushProvider extends LoggingProvider {
  readonly channel = 'PUSH' as const;
}

export class WhatsAppProvider extends LoggingProvider {
  readonly channel = 'WHATSAPP' as const;
  override async send(message: NotificationSend): Promise<{ messageId: string }> {
    if (process.env.WHATSAPP_ENABLED !== 'true') return { messageId: 'whatsapp-disabled-noop' };
    return super.send(message);
  }
}

export const NOTIFICATION_PROVIDERS = Symbol('NOTIFICATION_PROVIDERS');
