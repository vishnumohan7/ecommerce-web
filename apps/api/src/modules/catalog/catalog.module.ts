import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { SearchModule } from '../search/search.module';
import { TaxonomyController } from './taxonomy.controller';
import { TaxonomyService } from './taxonomy.service';
import { AdminCatalogController } from './admin-catalog.controller';
@Module({
  imports: [SearchModule],
  controllers: [CatalogController, AdminCatalogController, ImageController, TaxonomyController],
  providers: [CatalogService, ImageService, TaxonomyService],
  exports: [CatalogService, TaxonomyService],
})
export class CatalogModule {}
