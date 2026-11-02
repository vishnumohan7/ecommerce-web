import { Module } from '@nestjs/common';
import { TOKENS } from '@app/ports';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { NotificationModule } from '../notifications/notification.module';
import { PaymentController } from './payment.controller';
import { PaymentConfigurationService } from './payment-configuration.service';
import {
  ConfiguredPaymentProvider,
  StripePaymentProvider,
  StubPaymentProvider,
} from './payment.providers';
import { PaymentService } from './payment.service';

@Module({
  imports: [CheckoutModule, NotificationModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentConfigurationService,
    ConfiguredPaymentProvider,
    GuestCartTokenService,
    StripePaymentProvider,
    StubPaymentProvider,
    {
      provide: TOKENS.Payment,
      inject: [ConfiguredPaymentProvider],
      useFactory: (provider: ConfiguredPaymentProvider) => provider,
    },
  ],
  exports: [PaymentService, PaymentConfigurationService, TOKENS.Payment],
})
export class PaymentModule {}
