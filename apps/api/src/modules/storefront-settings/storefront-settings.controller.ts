import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/auth.decorators';
import { StorefrontSettingsService } from './storefront-settings.service';

@ApiTags('Storefront settings')
@Controller('api/v1/storefront/settings')
export class StorefrontSettingsController {
  constructor(private readonly settings: StorefrontSettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get public storefront and footer settings' })
  get() {
    return this.settings.get();
  }
}
