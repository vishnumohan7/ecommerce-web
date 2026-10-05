import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantScopedPrismaService } from './tenant-scoped.service';
@Global()
@Module({ providers: [PrismaService, TenantScopedPrismaService], exports: [TenantScopedPrismaService] })
export class DatabaseModule {}
