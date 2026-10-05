import { Global, Module } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { LicenseService } from './license.service';
@Global()
@Module({ providers: [LicenseService, FeatureService], exports: [LicenseService, FeatureService] })
export class LicensingModule {}
