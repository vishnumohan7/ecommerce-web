import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PromotionType } from '@prisma/client';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { PromotionsService } from './promotions.service';
@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('api/v1/promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}
  @Get() @RequirePermissions('catalog.read') @ApiOperation({ summary: 'List promotions' }) list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.promotions.list({ ...(page ? { page } : {}), ...(pageSize ? { pageSize } : {}) }); }
  @Post() @RequirePermissions('catalog.write') @ApiOperation({ summary: 'Create an HFSS-aware promotion' }) create(@Body() body: { name: string; type: PromotionType; startsAt: string; endsAt: string; productIds: string[]; conditions: Record<string, unknown>; effect: Record<string, unknown> }) { return this.promotions.create({ ...body, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt) }); }
  @Patch(':id') @RequirePermissions('catalog.write') @ApiOperation({ summary: 'Update promotion schedule or status' }) update(@Param('id') id: string, @Body() body: { active?: boolean; priority?: number; startsAt?: string; endsAt?: string }) { return this.promotions.update(id, body); }
}
