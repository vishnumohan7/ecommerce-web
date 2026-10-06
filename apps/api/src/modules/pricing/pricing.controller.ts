import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { PricingService, type PricingIdentity } from './pricing.service';
import { couponRedeemSchema, couponValidateSchema, pricingQuoteSchema } from './pricing.schemas';

@ApiTags('Pricing')
@Controller('api/v1')
export class PricingController {
  constructor(
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('pricing/quote')
  @ApiOperation({ summary: 'Calculate one authoritative, VAT-inclusive basket quote' })
  quote(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.pricing.quote(this.identity(request, response), pricingQuoteSchema.parse(body));
  }

  @Public()
  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate coupon eligibility against the current cart' })
  validate(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const input = couponValidateSchema.parse(body);
    return this.pricing.validateCoupon(this.identity(request, response), input.code);
  }

  @Public()
  @Post('coupons/redeem')
  @ApiOperation({ summary: 'Atomically consume one coupon use during checkout' })
  redeem(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const input = couponRedeemSchema.parse(body);
    return this.pricing.redeem(this.identity(request, response), input.code, input.discountMinor, {
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.orderRevenueMinor !== undefined
        ? { orderRevenueMinor: input.orderRevenueMinor }
        : {}),
      ...(input.orderTaxMinor !== undefined ? { orderTaxMinor: input.orderTaxMinor } : {}),
      ...(input.deliveryFeeMinor !== undefined ? { deliveryFeeMinor: input.deliveryFeeMinor } : {}),
    });
  }

  @Get('admin/coupons') @RequirePermissions('catalog.read') @ApiBearerAuth() coupons() {
    return this.pricing.coupons();
  }
  @Post('admin/coupons') @RequirePermissions('catalog.write') @ApiBearerAuth() createCoupon(
    @Body() body: unknown,
  ) {
    return this.pricing.createCoupon(body);
  }
  @Patch('admin/coupons/:id') @RequirePermissions('catalog.write') @ApiBearerAuth() updateCoupon(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.pricing.updateCoupon(id, body);
  }

  @Get('admin/influencers') @RequirePermissions('catalog.read') @ApiBearerAuth() influencers() {
    return this.pricing.influencers();
  }
  @Post('admin/influencers') @RequirePermissions('catalog.write') @ApiBearerAuth() createInfluencer(
    @Body() body: unknown,
  ) {
    return this.pricing.createInfluencer(body);
  }
  @Get('admin/influencers/:id/report')
  @RequirePermissions('catalog.read')
  @ApiBearerAuth()
  influencerReport(@Param('id') id: string) {
    return this.pricing.influencerReport(id);
  }

  @Get('admin/tax-rules') @RequirePermissions('catalog.read') @ApiBearerAuth() taxRules() {
    return this.pricing.taxRules();
  }
  @Post('admin/tax-rules') @RequirePermissions('catalog.write') @ApiBearerAuth() createTaxRule(
    @Body() body: unknown,
  ) {
    return this.pricing.createTaxRule(body);
  }

  private identity(request: Request, response: Response): PricingIdentity {
    const userId = TenantContext.get()?.userId;
    if (userId) return { userId };
    const existing = this.guestTokens.verify(request.cookies?.guest_cart as string | undefined);
    if (existing) return { guestSessionId: existing.sessionId };
    const issued = this.guestTokens.issue();
    response.cookie('guest_cart', issued.token, {
      httpOnly: true,
      secure: this.config.values.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { guestSessionId: issued.sessionId };
  }
}
