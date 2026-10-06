import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { GuestCartTokenService } from '../cart/guest-cart-token.service';
import { reserveSlotSchema } from './delivery.schemas';
import { DeliveryIdentity, DeliveryService } from './delivery.service';

@ApiTags('Delivery')
@Controller('api/v1')
export class DeliveryController {
  constructor(
    @Inject(DeliveryService) private readonly delivery: DeliveryService,
    @Inject(GuestCartTokenService) private readonly guestTokens: GuestCartTokenService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get('delivery/zones/resolve')
  @ApiOperation({ summary: 'Resolve a zone and quote one basket delivery fee' })
  quote(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('postcode') postcode = '',
  ) {
    return this.delivery.quote(this.identity(request, response), postcode);
  }

  @Public()
  @Get('delivery/slots')
  @ApiOperation({ summary: 'List server-filtered slots valid for the current basket' })
  slots(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('postcode') postcode = '',
  ) {
    return this.delivery.availableSlots(this.identity(request, response), postcode);
  }

  @Public()
  @Post('delivery/slots/:id/reserve')
  @ApiOperation({ summary: 'Transactionally reserve delivery-slot capacity' })
  reserve(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = reserveSlotSchema.parse(body);
    return this.delivery.reserve(this.identity(request, response), id, input.postcode);
  }

  @Get('admin/delivery/zones')
  @RequirePermissions('delivery.read')
  @ApiBearerAuth()
  zonesAdmin() {
    return this.delivery.zones();
  }

  @Post('admin/delivery/zones')
  @RequirePermissions('delivery.write')
  @ApiBearerAuth()
  createZone(@Body() body: unknown) {
    return this.delivery.createZone(body);
  }

  @Patch('admin/delivery/zones/:id')
  @RequirePermissions('delivery.write')
  @ApiBearerAuth()
  updateZone(@Param('id') id: string, @Body() body: unknown) {
    return this.delivery.updateZone(id, body);
  }

  @Get('admin/delivery/slots')
  @RequirePermissions('delivery.read')
  @ApiBearerAuth()
  slotsAdmin() {
    return this.delivery.slots();
  }

  @Post('admin/delivery/slots')
  @RequirePermissions('delivery.write')
  @ApiBearerAuth()
  createSlot(@Body() body: unknown) {
    return this.delivery.createSlot(body);
  }

  @Patch('admin/delivery/slots/:id')
  @RequirePermissions('delivery.write')
  @ApiBearerAuth()
  updateSlot(@Param('id') id: string, @Body() body: unknown) {
    return this.delivery.updateSlot(id, body);
  }

  private identity(request: Request, response: Response): DeliveryIdentity {
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
