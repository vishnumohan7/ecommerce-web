import { Body, Controller, Get, Headers, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import type { PricingIdentity } from '../pricing/pricing.service';
import { PaymentService } from './payment.service';
import { paymentCaptureSchema, paymentIntentSchema } from './payment.schemas';

@ApiTags('Payments')
@Controller('api/v1')
export class PaymentController {
  constructor(
    @Inject(PaymentService) private readonly payments: PaymentService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('checkout/payment-intent')
  @ApiOperation({ summary: 'Create exactly one SCA-ready intent for a checkout snapshot' })
  intent(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const input = paymentIntentSchema.parse(body);
    return this.payments.createIntent(this.identity(request, response), input.checkoutSessionId);
  }

  @Public()
  @Post('payments/intent')
  @ApiOperation({ summary: 'Alias for checkout PaymentIntent creation' })
  intentAlias(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.intent(request, response, body);
  }

  @Public()
  @Get('payments/:id')
  get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
  ) {
    return this.payments.get(this.identity(request, response), id);
  }

  @Public()
  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Signature-verified, idempotent Stripe webhook ingestion' })
  webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature = '',
  ) {
    const payload = request.rawBody ?? Buffer.from(JSON.stringify(request.body));
    return this.payments.webhook(payload, signature);
  }

  @Post('admin/payments/:orderId/capture')
  @RequirePermissions('orders.write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Capture a picked variable-weight order up to its authorisation' })
  capture(@Param('orderId') orderId: string, @Body() body: unknown) {
    const input = paymentCaptureSchema.parse(body);
    return this.payments.captureAtPickCompletion(orderId, input.recomputedAmountMinor);
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
