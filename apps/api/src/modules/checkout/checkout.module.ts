import { Module } from '@nestjs/common';
import { AgeVerificationModule } from '../age-verification/age-verification.module';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { DeliveryModule } from '../delivery/delivery.module';
import { PricingModule } from '../pricing/pricing.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [AgeVerificationModule, DeliveryModule, PricingModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, GuestCartTokenService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
