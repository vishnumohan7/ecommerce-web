export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';

export interface NotificationSend {
  recipient: string;
  subject?: string | null;
  body: string;
  data: Record<string, unknown>;
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
