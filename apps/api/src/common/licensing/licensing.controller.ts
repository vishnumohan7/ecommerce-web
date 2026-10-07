import { Body, Controller, Get, Post } from '@nestjs/common'; import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; import { RequirePermissions } from '../auth/auth.decorators'; import { FeatureService } from './feature.service'; import { LicenseService } from './license.service';
@ApiTags('Licensing') @ApiBearerAuth() @Controller('api/v1/admin/license')
export class LicensingController { constructor(private readonly licenses:LicenseService,private readonly features:FeatureService){}
  @Get() @RequirePermissions('settings.read') async state(){return {license:await this.licenses.state(),featureFlags:await this.features.registry()}}
  @Post('validate') @RequirePermissions('settings.write') validate(@Body() body:{token:string}){return this.licenses.validate(body.token)}
}
