import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantContext } from '../tenancy/tenant-context';
import { ErrorCode } from './error-code';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>(); const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const value = exception instanceof HttpException ? exception.getResponse() : undefined;
    const object = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
    const fallback = status === 500 ? 'An unexpected error occurred' : exception instanceof Error ? exception.message : 'Request failed';
    const code = typeof object.code === 'string' ? object.code : status === 400 ? ErrorCode.VALIDATION_ERROR : status === 401 ? ErrorCode.UNAUTHENTICATED : status === 403 ? ErrorCode.FORBIDDEN : status === 404 ? ErrorCode.NOT_FOUND : status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.INTERNAL_ERROR;
    response.status(status).json({ error: { code, message: typeof object.message === 'string' ? object.message : fallback, details: object.details, requestId: TenantContext.get()?.requestId }, path: request.path, timestamp: new Date().toISOString() });
  }
}
