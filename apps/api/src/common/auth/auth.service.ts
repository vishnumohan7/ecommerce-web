import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify, argon2id } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/app-config.service';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

export interface TokenPair { accessToken: string; refreshToken: string; accessExpiresInSeconds: number; }
const passwordOptions = { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly db: TenantScopedPrismaService, private readonly root: PrismaService, private readonly jwt: JwtService, private readonly config: AppConfigService) {}
  async register(input: { email: string; password: string; firstName: string; lastName: string }): Promise<{ userId: string; verificationToken: string }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.db.client.user.findFirst({ where: { email } }); if (existing) throw new ConflictException('Email is already registered');
    const tenantId = TenantContext.requireTenantId();
    const user = await this.db.client.user.create({ data: { tenantId, email, passwordHash: await argonHash(input.password, passwordOptions), firstName: input.firstName, lastName: input.lastName, role: 'CUSTOMER', active: false } });
    const raw = randomBytes(32).toString('base64url'); await this.db.client.authToken.create({ data: { tenantId, userId: user.id, kind: 'EMAIL_VERIFICATION', tokenHash: digest(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    return { userId: user.id, verificationToken: raw };
  }
  async verifyEmail(token: string): Promise<void> { const record = await this.consumeSingleUseToken(token, 'EMAIL_VERIFICATION'); await this.db.client.user.update({ where: { id: record.userId }, data: { active: true } }); }
  async login(email: string, password: string): Promise<TokenPair> { const user = await this.db.client.user.findFirst({ where: { email: email.trim().toLowerCase(), active: true } }); if (!user || !(await argonVerify(user.passwordHash, password))) throw new UnauthorizedException('Invalid credentials'); return this.issuePair(user.id, randomUUID()); }
  async rotate(refreshToken: string): Promise<TokenPair> {
    const tokenHash = digest(refreshToken); const record = await this.db.client.refreshToken.findFirst({ where: { tokenHash } });
    if (!record || record.expiresAt <= new Date() || record.revokedAt) throw new UnauthorizedException('Refresh token is invalid');
    if (record.usedAt) { await this.revokeFamily(record.familyId, record.userId, 'AUTH_REFRESH_REUSE'); throw new UnauthorizedException('Refresh token reuse detected'); }
    await this.db.client.refreshToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }); return this.issuePair(record.userId, record.familyId, record.id);
  }
  async revoke(refreshToken: string): Promise<void> { const record = await this.db.client.refreshToken.findFirst({ where: { tokenHash: digest(refreshToken) } }); if (record) await this.revokeFamily(record.familyId, record.userId, 'AUTH_LOGOUT'); }
  async createPasswordReset(email: string): Promise<string | undefined> { const tenantId = TenantContext.requireTenantId(); const user = await this.db.client.user.findFirst({ where: { email: email.trim().toLowerCase() } }); if (!user) return undefined; const raw = randomBytes(32).toString('base64url'); await this.db.client.authToken.create({ data: { tenantId, userId: user.id, kind: 'PASSWORD_RESET', tokenHash: digest(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }); return raw; }
  async resetPassword(token: string, password: string): Promise<void> { const record = await this.consumeSingleUseToken(token, 'PASSWORD_RESET'); await this.db.client.user.update({ where: { id: record.userId }, data: { passwordHash: await argonHash(password, passwordOptions) } }); await this.db.client.refreshToken.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } }); }
  async requestOtp(phone: string): Promise<{ challengeId: string; developmentCode?: string }> { const code = String(100000 + randomBytes(4).readUInt32BE() % 900000); const challenge = await this.db.client.otpChallenge.create({ data: { tenantId: TenantContext.requireTenantId(), phone, codeHash: digest(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } }); return process.env.NODE_ENV === 'production' ? { challengeId: challenge.id } : { challengeId: challenge.id, developmentCode: code }; }
  async verifyOtp(challengeId: string, code: string): Promise<void> { const challenge = await this.db.client.otpChallenge.findFirst({ where: { id: challengeId } }); if (!challenge || challenge.expiresAt <= new Date() || challenge.lockedAt || challenge.verifiedAt) throw new UnauthorizedException('OTP challenge is invalid'); if (challenge.codeHash !== digest(code)) { const attempts = challenge.attempts + 1; await this.db.client.otpChallenge.update({ where: { id: challenge.id }, data: { attempts, lockedAt: attempts >= 5 ? new Date() : null } }); throw new UnauthorizedException('OTP code is invalid'); } await this.db.client.otpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } }); }
  private async issuePair(userId: string, familyId: string, parentId?: string): Promise<TokenPair> { const tenantId = TenantContext.requireTenantId(); const permissions = await this.permissionsFor(userId); const accessToken = await this.jwt.signAsync({ sub: userId, tenantId, permissions, type: 'access' }, { secret: this.config.values.JWT_ACCESS_SECRET, issuer: this.config.values.JWT_ISSUER, expiresIn: '15m' }); const refreshToken = randomBytes(48).toString('base64url'); await this.db.client.refreshToken.create({ data: { tenantId, userId, familyId, ...(parentId ? { parentId } : {}), tokenHash: digest(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }); return { accessToken, refreshToken, accessExpiresInSeconds: 900 }; }
  private async permissionsFor(userId: string): Promise<string[]> { const assignments = await this.db.client.userRoleAssignment.findMany({ where: { userId } }); const mappings = await this.db.client.rolePermission.findMany({ where: { roleId: { in: assignments.map((item) => item.roleId) } } }); const permissions = await this.root.permission.findMany({ where: { id: { in: mappings.map((item) => item.permissionId) } } }); return permissions.map((permission) => permission.key); }
  private async consumeSingleUseToken(raw: string, kind: string) { const record = await this.db.client.authToken.findFirst({ where: { tokenHash: digest(raw), kind } }); if (!record || record.usedAt || record.expiresAt <= new Date()) throw new BadRequestException('Token is invalid or expired'); await this.db.client.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }); return record; }
  private async revokeFamily(familyId: string, userId: string, action: string): Promise<void> { await this.db.transaction(async (tx, tenantId) => { await tx.refreshToken.updateMany({ where: { familyId, tenantId }, data: { revokedAt: new Date() } }); await tx.auditLog.create({ data: { tenantId, actorId: userId, actorType: 'USER', action, entity: 'RefreshTokenFamily', entityId: familyId, requestId: TenantContext.get()?.requestId ?? randomUUID() } }); }); }
}
