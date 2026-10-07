import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/auth.decorators'; import { PrivacyService } from './privacy.service';
@ApiTags('Privacy') @ApiBearerAuth() @Controller('api/v1')
export class PrivacyController { constructor(private readonly privacy:PrivacyService){}
  @Get('privacy/consents') @RequirePermissions('orders.read') consents(){return this.privacy.consents()}
  @Patch('privacy/consents') @RequirePermissions('orders.read') updateConsents(@Body() body:unknown){return this.privacy.updateConsents(body)}
  @Get('privacy/requests') @RequirePermissions('orders.read') requests(){return this.privacy.requests()}
  @Post('privacy/export-requests') @RequirePermissions('orders.read') exportRequest(){return this.privacy.createExportRequest()}
  @Get('privacy/export-requests/:id') @RequirePermissions('orders.read') async exportFile(@Param('id') id:string,@Query('format') format:string,@Res() response:Response){const file=await this.privacy.exportFile(id,format==='pdf'?'pdf':'json');response.type(file.contentType).attachment(`data-export-${id}.${file.extension}`).send(file.body)}
  @Post('privacy/deletion-requests') @RequirePermissions('orders.read') erasureRequest(){return this.privacy.createErasureRequest()}
  @Get('admin/privacy/requests') @RequirePermissions('users.read') adminRequests(@Query('status') status?:string){return this.privacy.adminRequests(status)}
  @Patch('admin/privacy/requests/:id') @RequirePermissions('users.write') review(@Param('id') id:string,@Body() body:unknown){return this.privacy.review(id,body)}
}
