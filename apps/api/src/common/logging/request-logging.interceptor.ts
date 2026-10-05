import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import pino from 'pino';
import { Observable, tap } from 'rxjs';
import { TenantContext } from '../tenancy/tenant-context';
const logger = pino({ redact: { paths: ['password', 'token', 'otp', 'code', 'authorization', 'cookie', 'cardNumber', 'cvc', 'dob', 'dateOfBirth', 'documentNumber', 'client_secret', 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' } });
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> { const started = Date.now(); const request = context.switchToHttp().getRequest<Request>(); const response = context.switchToHttp().getResponse<Response>(); return next.handle().pipe(tap({ finalize: () => { logger.info({ requestId: TenantContext.get()?.requestId, tenantId: TenantContext.get()?.tenantId, userId: TenantContext.get()?.userId, route: request.originalUrl, duration: Date.now() - started, status: response.statusCode }, 'request'); } })); }
}
