import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { AdminService } from './admin.service';

@ApiTags('Admin operations')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard') @RequirePermissions('reports.read') dashboard(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.dashboard({ from, to }); }
  @Get('reports/sales') @RequirePermissions('reports.read') sales(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.salesReport({ from, to }); }
  @Get('reports/customers') @RequirePermissions('reports.read') customerReport(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.customerReport({ from, to }); }
  @Get('reports/products') @RequirePermissions('reports.read') productReport(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.productReport({ from, to }); }
  @Get('reports/coupons') @RequirePermissions('reports.read') couponReport(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.couponReport({ from, to }); }

  @Get('customers') @RequirePermissions('users.read') customers(@Query('q') query?: string) { return this.admin.customers(query); }
  @Get('customers/:id') @RequirePermissions('users.read') customer(@Param('id') id: string) { return this.admin.customer(id); }
  @Patch('customers/:id') @RequirePermissions('users.write') updateCustomer(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateCustomer(id, body); }
  @Get('inventory') @RequirePermissions('inventory.read') inventory() { return this.admin.inventory(); }
  @Get('reviews') @RequirePermissions('catalog.read') reviews(@Query('status') status?: string) { return this.admin.reviews(status); }
  @Get('promotions') @RequirePermissions('catalog.read') promotions() { return this.admin.promotions(); }
  @Get('content') @RequirePermissions('settings.read') content() { return this.admin.content(); }

  @Get('rbac') @RequirePermissions('users.read') rbac() { return this.admin.rbac(); }
  @Patch('rbac/roles/:id') @RequirePermissions('users.write') updateRole(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateRolePermissions(id, body); }
  @Patch('rbac/users/:id') @RequirePermissions('users.write') updateUserRoles(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateUserRoles(id, body); }

  @Get('settings') @RequirePermissions('settings.read') settings() { return this.admin.settings(); }
  @Patch('settings') @RequirePermissions('settings.write') updateSettings(@Body() body: unknown) { return this.admin.updateSettings(body); }
  @Get('audit-log') @RequirePermissions('audit.read') audit(@Query('entity') entity?: string, @Query('action') action?: string, @Query('actorId') actorId?: string) { return this.admin.auditLog({ entity, action, actorId }); }
}
