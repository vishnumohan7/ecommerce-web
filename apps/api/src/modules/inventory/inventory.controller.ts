import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InventoryReason } from '@prisma/client';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { InventoryService } from './inventory.service';
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('warehouses')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'List active stock warehouses' })
  warehouses() {
    return this.inventory.warehouses();
  }
  @Get()
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'List inventory with product details' })
  list(@Query('productId') productId?: string) {
    return this.inventory.list(productId);
  }
  @RequirePermissions('inventory.write')
  @Post()
  @ApiOperation({ summary: 'Create stock for a product and warehouse' })
  create(
    @Body()
    body: {
      productId: string;
      warehouseId: string;
      onHand: number;
      lowStockThreshold: number;
    },
  ) {
    return this.inventory.create(body);
  }
  @RequirePermissions('inventory.write')
  @Patch(':id')
  @ApiOperation({ summary: 'Update stock control settings' })
  update(@Param('id') id: string, @Body() body: { lowStockThreshold: number }) {
    return this.inventory.update(id, body);
  }
  @RequirePermissions('inventory.write')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an unused empty stock record' })
  remove(@Param('id') id: string) {
    return this.inventory.remove(id);
  }
  @RequirePermissions('inventory.write')
  @Post(':id/reservations')
  @ApiOperation({ summary: 'Reserve stock atomically' })
  reserve(@Param('id') id: string, @Body() body: { quantity: number; reference?: string }) {
    return this.inventory.reserve(id, body.quantity, body.reference);
  }
  @RequirePermissions('inventory.write')
  @Post(':id/releases')
  @ApiOperation({ summary: 'Release reserved stock atomically' })
  release(@Param('id') id: string, @Body() body: { quantity: number; reference?: string }) {
    return this.inventory.release(id, body.quantity, body.reference);
  }
  @RequirePermissions('inventory.write')
  @Post(':id/adjustments')
  @ApiOperation({ summary: 'Adjust physical stock with a reason ledger' })
  adjust(
    @Param('id') id: string,
    @Body()
    body: {
      quantity: number;
      reason: Exclude<InventoryReason, 'RESERVATION' | 'RELEASE'>;
      reference?: string;
    },
  ) {
    return this.inventory.adjust(id, body.quantity, body.reason, body.reference);
  }
}
