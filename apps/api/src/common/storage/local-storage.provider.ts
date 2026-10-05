import { Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { StorageProvider } from './storage.provider';
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly root = resolve(process.env.STORAGE_LOCAL_PATH ?? 'var/storage');
  async put(key: string, body: Buffer, contentType: string): Promise<{ key: string; url: string }> { if (contentType.length === 0) throw new Error('Storage content type is required'); const path = resolve(this.root, key); if (!path.startsWith(`${this.root}/`)) throw new Error('Invalid storage key'); await mkdir(dirname(path), { recursive: true }); await writeFile(path, body, { flag: 'wx' }).catch((error: unknown) => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }); return { key, url: `${process.env.STORAGE_PUBLIC_BASE_URL ?? '/assets'}/${key}` }; }
  async delete(key: string): Promise<void> { const path = resolve(this.root, key); if (!path.startsWith(`${this.root}/`)) throw new Error('Invalid storage key'); await unlink(path).catch((error: unknown) => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); }
}
