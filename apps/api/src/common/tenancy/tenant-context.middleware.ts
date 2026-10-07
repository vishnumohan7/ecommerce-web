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
    const tenantId = this.config.defaultTenantId;
    response.setHeader('x-request-id', requestId);
    TenantContext.run({ tenantId, requestId }, next);
  }
}
