import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { SearchModule } from '../search/search.module';
@Module({
  imports: [SearchModule],
  controllers: [CatalogController, ImageController],
  providers: [CatalogService, ImageService],
  exports: [CatalogService],
})
export class CatalogModule {}
