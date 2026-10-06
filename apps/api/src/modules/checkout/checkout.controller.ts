import { Body, Controller, Delete, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import type { PricingIdentity } from '../pricing/pricing.service';
import { CheckoutService } from './checkout.service';

@ApiTags('Checkout')
@Public()
@Controller('api/v1/checkout')
export class CheckoutController {
  constructor(
    @Inject(CheckoutService) private readonly checkout: CheckoutService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Post('validate')
  @ApiOperation({ summary: 'Return one side-effect-free authoritative checkout summary' })
  validate(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.checkout.validate(this.identity(request, response), body);
  }

  @Post('session')
  @ApiOperation({ summary: 'Snapshot checkout and reserve stock for a short TTL' })
  create(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.checkout.create(this.identity(request, response), body);
  }

  @Get('session/:id')
  @ApiOperation({ summary: 'Read and revalidate an owned checkout snapshot' })
  get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
  ) {
    return this.checkout.get(this.identity(request, response), id);
  }

  @Delete('session/:id')
  @ApiOperation({ summary: 'Cancel checkout and release reserved stock' })
  cancel(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
  ) {
    return this.checkout.cancel(this.identity(request, response), id);
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
