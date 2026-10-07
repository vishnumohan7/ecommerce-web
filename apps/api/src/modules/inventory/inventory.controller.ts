import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InventoryReason } from '@prisma/client';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { InventoryService } from './inventory.service';
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get() @RequirePermissions('inventory.read') @ApiOperation({ summary: 'List inventory with product details' }) list() { return this.inventory.list(); }
  @RequirePermissions('inventory.write')
  @Post(':id/reservations') @ApiOperation({ summary: 'Reserve stock atomically' }) reserve(@Param('id') id: string, @Body() body: { quantity: number; reference?: string }) { return this.inventory.reserve(id, body.quantity, body.reference); }
  @RequirePermissions('inventory.write')
  @Post(':id/releases') @ApiOperation({ summary: 'Release reserved stock atomically' }) release(@Param('id') id: string, @Body() body: { quantity: number; reference?: string }) { return this.inventory.release(id, body.quantity, body.reference); }
  @RequirePermissions('inventory.write')
  @Post(':id/adjustments') @ApiOperation({ summary: 'Adjust physical stock with a reason ledger' }) adjust(@Param('id') id: string, @Body() body: { quantity: number; reason: Exclude<InventoryReason, 'RESERVATION' | 'RELEASE'>; reference?: string }) { return this.inventory.adjust(id, body.quantity, body.reason, body.reference); }
}
