import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
@Module({ controllers: [CatalogController, ImageController], providers: [CatalogService, ImageService], exports: [CatalogService] })
export class CatalogModule {}
