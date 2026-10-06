import { Body, Controller, Get, Headers, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { AgeGateTokenService } from '../../common/security/age-gate-token.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { AgeIdentity, AgeVerificationService } from './age-verification.service';
import { checkoutValidationSchema } from './age-verification.schemas';
import { CheckoutAgeGuardService } from './checkout-age-guard.service';

const monthMilliseconds = 30 * 24 * 60 * 60 * 1000;

@ApiTags('Age gate and verification')
@Controller('api/v1')
export class AgeVerificationController {
  constructor(
    @Inject(AgeVerificationService) private readonly verification: AgeVerificationService,
    @Inject(CheckoutAgeGuardService) private readonly checkout: CheckoutAgeGuardService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AgeGateTokenService) private readonly gateTokens: AgeGateTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Public()
  @Post('age-gate/confirm')
  @ApiOperation({ summary: 'Confirm the browsing-only age category gate' })
  confirmGate(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const sessionId = this.gateSession(request, response);
    response.cookie('age_gate', this.gateTokens.issue(sessionId), this.cookie(monthMilliseconds));
    return { confirmed: true, expiresAt: new Date(Date.now() + monthMilliseconds) };
  }

  @Public()
  @Post('age-gate/decline')
  @ApiOperation({ summary: 'Decline and clear the browsing-only age category gate' })
  declineGate(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('age_gate', { path: '/' });
    return { confirmed: false, redirectTo: '/' };
  }

  @Public()
  @Get('age-verification')
  @ApiOperation({ summary: 'Get reusable purchase age-verification status' })
  current(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.verification.current(this.identity(request, response));
  }

  @Public()
  @Post('age-verification/dob')
  @ApiOperation({ summary: 'Declare date of birth for purchase verification' })
  dob(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.verification.declareDob(this.identity(request, response), body);
  }

  @Public()
  @Post('age-verification/provider-session')
  @ApiOperation({ summary: 'Start digital or manual purchase age verification' })
  providerSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.verification.initiate(this.identity(request, response), body);
  }

  @Public()
  @Get('age-verification/provider-session/:provider/:sessionId')
  @ApiOperation({ summary: 'Refresh provider age-verification status' })
  providerResult(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('provider') provider: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.verification.providerResult(
      this.identity(request, response),
      provider.toUpperCase(),
      sessionId,
    );
  }

  @Public()
  @Post('age-verification/provider-webhook/:provider')
  @ApiOperation({ summary: 'Consume a signature-verified age provider webhook' })
  webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Param('provider') provider: string,
    @Headers('x-yoti-signature') signature = '',
  ) {
    const payload = request.rawBody ?? Buffer.from(JSON.stringify(request.body));
    return this.verification.webhook(provider.toUpperCase(), payload, signature);
  }

  @Public()
  @Post('checkout/validate')
  @ApiOperation({ summary: 'Validate authoritative cart age and jurisdiction eligibility' })
  validateCheckout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    const input = checkoutValidationSchema.parse(body);
    return this.checkout.validate(this.identity(request, response), input.deliveryPostcode);
  }

  private identity(request: Request, response: Response): AgeIdentity {
    const userId = TenantContext.get()?.userId;
    if (userId) return { userId };
    const existing = this.guestTokens.verify(request.cookies?.guest_cart as string | undefined);
    if (existing) return { guestSessionId: existing.sessionId };
    const issued = this.guestTokens.issue();
    response.cookie('guest_cart', issued.token, this.cookie(monthMilliseconds));
    return { guestSessionId: issued.sessionId };
  }

  private gateSession(request: Request, response: Response): string {
    const existing = request.cookies?.age_gate_session as string | undefined;
    const sessionId = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();
    if (!existing) response.cookie('age_gate_session', sessionId, this.cookie(monthMilliseconds));
    return sessionId;
  }

  private cookie(maxAge: number) {
    return {
      httpOnly: true,
      secure: this.config.values.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }
}
