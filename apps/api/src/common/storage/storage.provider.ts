export const STORAGE_PROVIDER = Symbol.for('port.StorageProvider');
export interface StorageProvider { put(key: string, body: Buffer, contentType: string): Promise<{ key: string; url: string }>; delete(key: string): Promise<void>; }
