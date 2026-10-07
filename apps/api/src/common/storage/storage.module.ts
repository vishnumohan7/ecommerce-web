import { Global, Module } from '@nestjs/common';
import { DatabaseStorageProvider } from './database-storage.provider';
import { MediaController } from './media.controller';
import { STORAGE_PROVIDER } from './storage.provider';
@Global()
@Module({
  controllers: [MediaController],
  providers: [{ provide: STORAGE_PROVIDER, useClass: DatabaseStorageProvider }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
