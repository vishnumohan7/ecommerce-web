import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';
import { LicenseService } from './license.service';
@Injectable()
export class FeatureService {
  constructor(private readonly licenses: LicenseService, private readonly db: TenantScopedPrismaService) {}
  async enabled(key: string): Promise<boolean> { const license = await this.licenses.state(); if (!license.features.includes(key)) return false; const override = await this.db.client.featureFlagOverride.findFirst({ where: { key } }); const envValue = process.env[`FEATURE_${key.toUpperCase().replaceAll('.', '_')}`]; return license.valid && override?.enabled !== false && envValue !== 'false'; }
  async registry() { const license = await this.licenses.state(); const overrides = await this.db.client.featureFlagOverride.findMany({ orderBy: { key: 'asc' } }); return license.features.map((key) => ({ key, licensed: true, override: overrides.find((item) => item.key === key)?.enabled ?? null })); }
}
