import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { ReturnService } from './return.service';

@ApiTags('Returns and refunds')
@ApiBearerAuth()
@Controller('api/v1')
export class ReturnController {
  constructor(private readonly returns: ReturnService) {}

  @Post('returns')
  @RequirePermissions('orders.read')
  createReturn(@Body() body: unknown) {
    return this.returns.createReturn(body);
  }

  @Post('orders/:orderId/returns')
  @RequirePermissions('orders.read')
  createOrderReturn(@Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.returns.createReturn({ ...body, orderId });
  }

  @Get('returns')
  @RequirePermissions('orders.read')
  listReturns() {
    return this.returns.listReturns();
  }

  @Get('returns/:id')
  @RequirePermissions('orders.read')
  returnDetail(@Param('id') id: string) {
    return this.returns.returnDetailForCustomer(id);
  }

  @Get('admin/returns')
  @RequirePermissions('orders.read')
  adminListReturns(@Query() query: unknown) {
    return this.returns.adminListReturns(query);
  }

  @Patch('admin/returns/:id')
  @RequirePermissions('orders.write')
  @ApiOperation({ summary: 'Approve or reject a requested return' })
  updateReturn(@Param('id') id: string, @Body() body: unknown) {
    return this.returns.updateReturn(id, body);
  }

  @Post('admin/refunds')
  @RequirePermissions('orders.write')
  createRefund(@Body() body: unknown) {
    return this.returns.createRefund(body);
  }

  @Post('admin/orders/:orderId/refunds')
  @RequirePermissions('orders.write')
  createOrderRefund(@Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.returns.createRefund({ ...body, orderId });
  }

  @Get('admin/refunds/:id')
  @RequirePermissions('orders.read')
  refundDetail(@Param('id') id: string) {
    return this.returns.refundDetail(id);
  }
}
