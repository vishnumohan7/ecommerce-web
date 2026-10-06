import { Module } from '@nestjs/common';
import { AgeVerificationModule } from '../age-verification/age-verification.module';
import { CartModule } from '../cart/cart.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [AgeVerificationModule, CartModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
