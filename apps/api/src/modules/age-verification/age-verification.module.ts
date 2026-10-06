import { Module } from '@nestjs/common';
import { AgeGateTokenService } from '../../common/security/age-gate-token.service';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { AgeVerificationController } from './age-verification.controller';
import { AgeVerificationService } from './age-verification.service';
import { CheckoutAgeGuardService } from './checkout-age-guard.service';
import { JurisdictionRuleService, PostcodeJurisdictionResolver } from './jurisdiction-rule.service';
import { ManualReviewAgeVerificationProvider } from './providers/manual-review-age-verification.provider';
import { StubAgeVerificationProvider } from './providers/stub-age-verification.provider';
import { YotiAgeVerificationProvider } from './providers/yoti-age-verification.provider';

@Module({
  controllers: [AgeVerificationController],
  providers: [
    AgeGateTokenService,
    GuestCartTokenService,
    AgeVerificationService,
    CheckoutAgeGuardService,
    PostcodeJurisdictionResolver,
    JurisdictionRuleService,
    StubAgeVerificationProvider,
    YotiAgeVerificationProvider,
    ManualReviewAgeVerificationProvider,
  ],
  exports: [AgeVerificationService, CheckoutAgeGuardService, JurisdictionRuleService],
})
export class AgeVerificationModule {}
