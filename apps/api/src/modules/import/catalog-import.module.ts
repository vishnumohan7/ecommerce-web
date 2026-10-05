import { Module } from '@nestjs/common';
import { CatalogImportController } from './catalog-import.controller';
import { CatalogImportService } from './catalog-import.service';
@Module({ controllers: [CatalogImportController], providers: [CatalogImportService] })
export class CatalogImportModule {}
