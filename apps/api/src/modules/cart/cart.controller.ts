import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { CartIdentity, CartService } from './cart.service';
import { GuestCartTokenService } from './guest-cart-token.service';

@ApiTags('Cart')
@Controller('api/v1/cart')
export class CartController {
  constructor(
    @Inject(CartService) private readonly carts: CartService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the revalidated combined grocery and alcohol cart' })
  get(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.carts.read(this.identity(request, response));
  }
  @Public()
  @Post('items')
  @ApiOperation({ summary: 'Add a product using server-derived snapshots' })
  add(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.carts.add(this.identity(request, response), body);
  }
  @Public() @Patch('items/:id') @ApiOperation({ summary: 'Change cart item quantity' }) update(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.carts.update(this.identity(request, response), id, body);
  }
  @Public() @Delete('items/:id') @ApiOperation({ summary: 'Remove a cart item' }) remove(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
  ) {
    return this.carts.remove(this.identity(request, response), id);
  }
  @Public()
  @Post('items/:id/substitution-preference')
  @ApiOperation({ summary: 'Set substitution preference' })
  substitution(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.carts.substitution(this.identity(request, response), id, body);
  }
  @Public()
  @Post('coupon')
  @ApiOperation({ summary: 'Attach a coupon for authoritative pricing evaluation' })
  coupon(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ) {
    return this.carts.applyCoupon(this.identity(request, response), body);
  }
  @Public() @Delete('coupon') @ApiOperation({ summary: 'Remove the attached coupon' }) removeCoupon(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.carts.removeCoupon(this.identity(request, response));
  }
  @Post('merge')
  @RequirePermissions('catalog.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge the signed guest cart into the authenticated cart' })
  merge(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const userId = TenantContext.get()?.userId;
    if (!userId) throw new Error('Authenticated user context is unavailable');
    const guest = this.guestTokens.verify(request.cookies?.guest_cart as string | undefined);
    response.clearCookie('guest_cart', { path: '/' });
    return this.carts.merge(userId, guest?.sessionId);
  }

  private identity(request: Request, response: Response): CartIdentity {
    const userId = TenantContext.get()?.userId;
    if (userId) return { userId };
    const existing = this.guestTokens.verify(request.cookies?.guest_cart as string | undefined);
    if (existing) return { guestSessionId: existing.sessionId, expiresAt: existing.expiresAt };
    const issued = this.guestTokens.issue();
    response.cookie('guest_cart', issued.token, {
      httpOnly: true,
      secure: this.config.values.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { guestSessionId: issued.sessionId, expiresAt: issued.expiresAt };
  }
}
