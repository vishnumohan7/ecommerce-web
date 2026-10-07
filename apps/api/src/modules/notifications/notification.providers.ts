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

export class EmailProvider extends LoggingProvider {
  readonly channel = 'EMAIL' as const;
  override async send(message: NotificationSend): Promise<{ messageId: string }> {
    if (process.env.EMAIL_PROVIDER !== 'resend') return super.send(message);
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error('Resend email is enabled but RESEND_API_KEY or EMAIL_FROM is missing');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.recipient],
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        subject: message.subject ?? 'Denes Commerce update',
        text: message.body,
        ...(message.attachments?.length
          ? { attachments: message.attachments.map(({ filename, content }) => ({ filename, content })) }
          : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok || !payload?.id) throw new Error(payload?.message ?? `Email provider returned ${String(response.status)}`);
    return { messageId: payload.id };
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
import { randomUUID } from 'node:crypto';
