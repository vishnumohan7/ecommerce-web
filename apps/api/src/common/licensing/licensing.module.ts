import { Global, Module } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { LicenseService } from './license.service';
import { LicensingController } from './licensing.controller';
@Global()
@Module({ controllers: [LicensingController], providers: [LicenseService, FeatureService], exports: [LicenseService, FeatureService] })
export class LicensingModule {}
