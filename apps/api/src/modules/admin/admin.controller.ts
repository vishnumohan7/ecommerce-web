import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { AdminService } from './admin.service';

@ApiTags('Admin operations')
@ApiBearerAuth()
@Controller('api/v1/admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard') @RequirePermissions('reports.read') dashboard(@Query('from') from?: string, @Query('to') to?: string) { return this.admin.dashboard({ from, to }); }
  @Get('reports/sales') @RequirePermissions('reports.read') sales(@Query() query: Record<string, string | undefined>) { return this.admin.salesReport(query); }
  @Get('reports/customers') @RequirePermissions('reports.read') customerReport(@Query() query: Record<string, string | undefined>) { return this.admin.customerReport(query); }
  @Get('reports/products') @RequirePermissions('reports.read') productReport(@Query() query: Record<string, string | undefined>) { return this.admin.productReport(query); }
  @Get('reports/coupons') @RequirePermissions('reports.read') couponReport(@Query() query: Record<string, string | undefined>) { return this.admin.couponReport(query); }
  @Get('reports/categories') @RequirePermissions('reports.read') categoryReport(@Query() query: Record<string, string | undefined>) { return this.admin.categoryReport(query); }

  @Get('customers') @RequirePermissions('users.read') customers(@Query() query: Record<string, string | undefined>) { return this.admin.customers(query); }
  @Get('customers/:id') @RequirePermissions('users.read') customer(@Param('id') id: string) { return this.admin.customer(id); }
  @Patch('customers/:id') @RequirePermissions('users.write') updateCustomer(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateCustomer(id, body); }
  @Get('inventory') @RequirePermissions('inventory.read') inventory() { return this.admin.inventory(); }
  @Get('reviews') @RequirePermissions('catalog.read') reviews(@Query() query: Record<string, string | undefined>) { return this.admin.reviews(query); }
  @Get('promotions') @RequirePermissions('catalog.read') promotions() { return this.admin.promotions(); }
  @Get('content') @RequirePermissions('settings.read') content() { return this.admin.content(); }
  @Post('content/banners') @RequirePermissions('settings.write') createBanner(@Body() body: unknown) { return this.admin.createBanner(body); }
  @Patch('content/banners/:id') @RequirePermissions('settings.write') updateBanner(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateBanner(id, body); }
  @Post('content/blocks') @RequirePermissions('settings.write') createBlock(@Body() body: unknown) { return this.admin.createContentBlock(body); }
  @Post('content/pages') @RequirePermissions('settings.write') savePage(@Body() body: unknown) { return this.admin.upsertCmsPage(body); }

  @Get('rbac') @RequirePermissions('users.read') rbac() { return this.admin.rbac(); }
  @Patch('rbac/roles/:id') @RequirePermissions('users.write') updateRole(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateRolePermissions(id, body); }
  @Patch('rbac/users/:id') @RequirePermissions('users.write') updateUserRoles(@Param('id') id: string, @Body() body: unknown) { return this.admin.updateUserRoles(id, body); }

  @Get('settings') @RequirePermissions('settings.read') settings() { return this.admin.settings(); }
  @Patch('settings') @RequirePermissions('settings.write') updateSettings(@Body() body: unknown) { return this.admin.updateSettings(body); }
  @Get('audit-log') @RequirePermissions('audit.read') audit(@Query() query: Record<string, string | undefined>) { return this.admin.auditLog(query); }
}
