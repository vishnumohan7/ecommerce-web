import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { TenantContext } from '../tenancy/tenant-context';
import { PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from './auth.decorators';

export interface AuthClaims { sub: string; tenantId: string; permissions: string[]; type: 'access'; }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService, private readonly config: AppConfigService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) throw new UnauthorizedException('Route permission metadata is missing');
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthClaims }>();
    const value = request.header('authorization');
    if (!value?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token is required');
    const claims = await this.jwt.verifyAsync<AuthClaims>(value.slice(7), { secret: this.config.values.JWT_ACCESS_SECRET, issuer: this.config.values.JWT_ISSUER });
    if (claims.type !== 'access' || claims.tenantId !== TenantContext.requireTenantId() || !required.every((permission) => claims.permissions.includes(permission))) throw new UnauthorizedException('Access denied');
    request.auth = claims; TenantContext.setUserId(claims.sub); return true;
  }
}
