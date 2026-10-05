import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfigService } from '../config/app-config.service';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';
import { TenantContext } from '../tenancy/tenant-context';
@Injectable()
export class OutboxService implements OnModuleDestroy {
  private readonly queue: Queue;
  constructor(private readonly db: TenantScopedPrismaService, config: AppConfigService) { this.queue = new Queue('outbox', { connection: { url: config.values.REDIS_URL } }); }
  async record(topic: string, payload: Record<string, unknown>): Promise<string> { const message = await this.db.client.outboxMessage.create({ data: { tenantId: TenantContext.requireTenantId(), topic, payload } }); return message.id; }
  async relay(limit = 100): Promise<number> { const messages = await this.db.client.outboxMessage.findMany({ where: { status: 'PENDING', availableAt: { lte: new Date() } }, take: limit, orderBy: { createdAt: 'asc' } }); for (const message of messages) { await this.queue.add(message.topic, { outboxMessageId: message.id }, { jobId: message.id, attempts: 8, backoff: { type: 'exponential', delay: 1000 } }); await this.db.client.outboxMessage.update({ where: { id: message.id }, data: { status: 'PROCESSING' } }); } return messages.length; }
  async onModuleDestroy(): Promise<void> { await this.queue.close(); }
}
