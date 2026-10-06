import { Module } from '@nestjs/common';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { DeliveryModule } from '../delivery/delivery.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { TaxRuleService } from './tax-rule.service';

@Module({
  imports: [DeliveryModule],
  controllers: [PricingController],
  providers: [PricingService, TaxRuleService, GuestCartTokenService],
  exports: [PricingService, TaxRuleService],
})
export class PricingModule {}
