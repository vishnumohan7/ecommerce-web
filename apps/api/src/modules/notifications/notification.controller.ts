import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/v1')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get('notification-preferences')
  @RequirePermissions('orders.read')
  preferences() {
    return this.notifications.preferences();
  }

  @Patch('notification-preferences')
  @RequirePermissions('orders.read')
  updatePreferences(@Body() body: unknown) {
    return this.notifications.updatePreferences(body);
  }

  @Get('notification-devices')
  @RequirePermissions('orders.read')
  devices() {
    return this.notifications.listDevices();
  }

  @Post('notification-devices')
  @RequirePermissions('orders.read')
  addDevice(@Body() body: unknown) {
    return this.notifications.addDevice(body);
  }

  @Post('devices')
  @RequirePermissions('orders.read')
  addDeviceAlias(@Body() body: unknown) {
    return this.notifications.addDevice(body);
  }

  @Delete('notification-devices/:id')
  @RequirePermissions('orders.read')
  removeDevice(@Param('id') id: string) {
    return this.notifications.removeDevice(id);
  }

  @Delete('devices/:id')
  @RequirePermissions('orders.read')
  removeDeviceAlias(@Param('id') id: string) {
    return this.notifications.removeDevice(id);
  }

  @Get('notifications')
  @RequirePermissions('orders.read')
  notificationsForCustomer() {
    return this.notifications.customerNotifications();
  }

  @Get('admin/notification-templates')
  @RequirePermissions('settings.read')
  templates() {
    return this.notifications.listTemplates();
  }

  @Post('admin/notification-templates')
  @RequirePermissions('settings.write')
  createTemplate(@Body() body: unknown) {
    return this.notifications.createTemplate(body);
  }

  @Patch('admin/notification-templates/:id')
  @RequirePermissions('settings.write')
  replaceTemplate(@Param('id') id: string, @Body() body: unknown) {
    return this.notifications.replaceTemplate(id, body);
  }

  @Post('admin/notification-templates/preview')
  @RequirePermissions('settings.read')
  preview(@Body() body: unknown) {
    return this.notifications.preview(body);
  }

  @Post('admin/notification-templates/:id/test-send')
  @RequirePermissions('settings.write')
  testSend(@Param('id') id: string, @Body() body: unknown) {
    return this.notifications.testSend(id, body);
  }

  @Post('admin/notification-templates/:id/test')
  @RequirePermissions('settings.write')
  testSendAlias(@Param('id') id: string, @Body() body: unknown) {
    return this.notifications.testSend(id, body);
  }

  @Get('admin/notification-deliveries')
  @RequirePermissions('settings.read')
  deliveryLog(@Query('status') status?: string) {
    return this.notifications.deliveryLog(status);
  }

  @Post('admin/notifications/process')
  @RequirePermissions('settings.write')
  process() {
    return this.notifications.process();
  }
}
