import { Module } from '@nestjs/common';
import { PaymentModule } from '../payments/payment.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';

@Module({
  imports: [PaymentModule, PricingModule],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnModule {}
