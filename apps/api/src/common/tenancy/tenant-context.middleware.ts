import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { TenantContext } from './tenant-context';
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly config: AppConfigService) {}
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = request.header('x-request-id') ?? randomUUID();
    const requestedTenant = request.header('x-tenant-id');
    const tenantId = this.config.tenancyMode === 'single' ? this.config.defaultTenantId : requestedTenant;
    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) { response.status(400).json({ error: { code: 'INVALID_TENANT', message: 'A valid tenant identifier is required', requestId } }); return; }
    response.setHeader('x-request-id', requestId);
    TenantContext.run({ tenantId, requestId }, next);
  }
}
