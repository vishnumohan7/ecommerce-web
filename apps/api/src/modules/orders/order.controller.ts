import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { OrderService } from './order.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('api/v1')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get('orders')
  @RequirePermissions('orders.read')
  list() {
    return this.orders.customerList();
  }

  @Get('orders/:id')
  @RequirePermissions('orders.read')
  detail(@Param('id') id: string) {
    return this.orders.customerDetail(id);
  }

  @Get('orders/:id/tracking')
  @RequirePermissions('orders.read')
  tracking(@Param('id') id: string) {
    return this.orders.tracking(id);
  }

  @Get('orders/:id/invoice')
  @RequirePermissions('orders.read')
  @ApiProduces('application/pdf')
  async invoice(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.orders.invoice(id);
    response.type('application/pdf').attachment(invoice.filename).send(invoice.pdf);
  }

  @Post('orders/:id/reorder')
  @RequirePermissions('orders.read')
  reorder(@Param('id') id: string) {
    return this.orders.reorder(id);
  }

  @Get('admin/orders')
  @RequirePermissions('orders.read')
  adminList(@Query() query: Record<string, string | undefined>) {
    return this.orders.adminList(query);
  }

  @Get('admin/orders/:id')
  @RequirePermissions('orders.read')
  adminDetail(@Param('id') id: string) {
    return this.orders.adminDetail(id);
  }

  @Get('admin/orders/:id/invoice')
  @RequirePermissions('orders.read')
  @ApiProduces('application/pdf')
  async adminInvoice(@Param('id') id: string, @Res() response: Response) {
    const invoice = await this.orders.invoice(id, true);
    response.type('application/pdf').attachment(invoice.filename).send(invoice.pdf);
  }

  @Patch('admin/orders/:id/fulfilment-groups/:groupId')
  @RequirePermissions('orders.write')
  @ApiOperation({ summary: 'Apply one guarded per-category fulfilment transition' })
  transition(@Param('id') id: string, @Param('groupId') groupId: string, @Body() body: unknown) {
    return this.orders.transition(id, groupId, body);
  }

  @Post('admin/orders/:id/pick-list')
  @RequirePermissions('orders.write')
  createPickList(@Param('id') id: string) {
    return this.orders.createPickList(id);
  }

  @Get('admin/orders/:id/pick-list')
  @RequirePermissions('orders.read')
  pickList(@Param('id') id: string) {
    return this.orders.pickList(id);
  }

  @Patch('admin/orders/:id/pick-list/items/:itemId')
  @RequirePermissions('orders.write')
  recordPick(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: unknown) {
    return this.orders.recordPick(id, itemId, body);
  }

  @Post('admin/orders/:id/pick-list/complete')
  @RequirePermissions('orders.write')
  completePick(@Param('id') id: string) {
    return this.orders.completePick(id);
  }

  @Get('admin/compliance/alcohol-day-book')
  @RequirePermissions('orders.read')
  async dayBook(
    @Query('date') date: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('A valid date is required');
    if (format === 'csv') {
      response.type('text/csv').attachment(`alcohol-day-book-${date}.csv`);
      return this.orders.dayBookCsv(parsed);
    }
    if (format === 'pdf') {
      response.type('application/pdf').attachment(`alcohol-day-book-${date}.pdf`);
      return this.orders.dayBookPdf(parsed);
    }
    return this.orders.dayBook(parsed);
  }

  @Post('delivery-age-check')
  @RequirePermissions('delivery.write')
  @ApiOperation({ summary: 'Capture delivery Challenge 25 proof without storing an ID number' })
  deliveryAgeCheck(@Body() body: unknown) {
    return this.orders.deliveryAgeCheck(body);
  }
}
