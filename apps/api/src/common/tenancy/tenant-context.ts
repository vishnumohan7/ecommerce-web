import { AsyncLocalStorage } from 'node:async_hooks';
export interface RequestContext { tenantId: string; requestId: string; userId?: string; }
const storage = new AsyncLocalStorage<RequestContext>();
export const TenantContext = {
  run<T>(context: RequestContext, callback: () => T): T { return storage.run(context, callback); },
  get(): RequestContext | undefined { return storage.getStore(); },
  requireTenantId(): string { const tenantId = storage.getStore()?.tenantId; if (!tenantId) throw new Error('Tenant context is unavailable'); return tenantId; },
  setUserId(userId: string): void { const context = storage.getStore(); if (context) context.userId = userId; },
};
