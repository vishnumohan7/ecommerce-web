import { Module } from '@nestjs/common';
import { TOKENS } from '@app/ports';
import { AppConfigService } from '../../common/config/app-config.service';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { CheckoutModule } from '../checkout/checkout.module';
import { NotificationModule } from '../notifications/notification.module';
import { PaymentController } from './payment.controller';
import { StripePaymentProvider, StubPaymentProvider } from './payment.providers';
import { PaymentService } from './payment.service';

@Module({
  imports: [CheckoutModule, NotificationModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    GuestCartTokenService,
    StripePaymentProvider,
    StubPaymentProvider,
    {
      provide: TOKENS.Payment,
      inject: [AppConfigService, StripePaymentProvider, StubPaymentProvider],
      useFactory: (
        config: AppConfigService,
        stripe: StripePaymentProvider,
        stub: StubPaymentProvider,
      ) => (config.values.STRIPE_SECRET_KEY ? stripe : stub),
    },
  ],
  exports: [PaymentService, TOKENS.Payment],
})
export class PaymentModule {}
