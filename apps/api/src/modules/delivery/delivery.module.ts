import { Module } from '@nestjs/common';
import { AgeVerificationModule } from '../age-verification/age-verification.module';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [AgeVerificationModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, GuestCartTokenService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
