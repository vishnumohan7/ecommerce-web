import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ABUSE_PROTECTED } from './abuse-protection.decorator';
import { TurnstileService } from './turnstile.service';
@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly turnstile: TurnstileService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> { if (!this.reflector.getAllAndOverride<boolean>(ABUSE_PROTECTED, [context.getHandler(), context.getClass()]) || !this.turnstile.enabled) return true; const request = context.switchToHttp().getRequest<Request>(); const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {}; const token = body.turnstileToken; if (typeof token !== 'string') throw new BadRequestException('Turnstile token is required'); await this.turnstile.verify(token, request.ip); return true; }
}
