import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import {
  EmailProvider,
  NOTIFICATION_PROVIDERS,
  PushProvider,
  SmsProvider,
  WhatsAppProvider,
} from './notification.providers';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailProvider,
    SmsProvider,
    PushProvider,
    WhatsAppProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      inject: [EmailProvider, SmsProvider, PushProvider, WhatsAppProvider],
      useFactory: (...providers: [EmailProvider, SmsProvider, PushProvider, WhatsAppProvider]) =>
        providers,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
