import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('Categories, brands, and attributes')
@Controller('api/v1')
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List active category tree nodes' })
  categories(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.taxonomy.categories(cursor, numberLimit(limit));
  }
  @Public()
  @Get('categories/:id')
  @ApiOperation({ summary: 'Get an active category' })
  category(@Param('id') id: string) {
    return this.taxonomy.category(id);
  }
  @Post('categories')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  createCategory(@Body() body: unknown) {
    return this.taxonomy.createCategory(body);
  }
  @Patch('categories/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  updateCategory(@Param('id') id: string, @Body() body: unknown) {
    return this.taxonomy.updateCategory(id, body);
  }
  @Delete('categories/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  deleteCategory(@Param('id') id: string) {
    return this.taxonomy.deleteCategory(id);
  }

  @Public()
  @Get('brands')
  @ApiOperation({ summary: 'List brands' })
  brands(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.taxonomy.brands(cursor, numberLimit(limit));
  }
  @Public()
  @Get('brands/:id')
  @ApiOperation({ summary: 'Get a brand' })
  brand(@Param('id') id: string) {
    return this.taxonomy.brand(id);
  }
  @Post('brands')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  createBrand(@Body() body: unknown) {
    return this.taxonomy.createBrand(body);
  }
  @Patch('brands/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  updateBrand(@Param('id') id: string, @Body() body: unknown) {
    return this.taxonomy.updateBrand(id, body);
  }
  @Delete('brands/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  deleteBrand(@Param('id') id: string) {
    return this.taxonomy.deleteBrand(id);
  }

  @Get('attribute-sets')
  @RequirePermissions('catalog.read')
  @ApiBearerAuth()
  attributeSets(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.taxonomy.attributeSets(cursor, numberLimit(limit));
  }
  @Get('attribute-sets/:id')
  @RequirePermissions('catalog.read')
  @ApiBearerAuth()
  attributeSet(@Param('id') id: string) {
    return this.taxonomy.attributeSet(id);
  }
  @Post('attribute-sets')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  createAttributeSet(@Body() body: unknown) {
    return this.taxonomy.createAttributeSet(body);
  }
  @Patch('attribute-sets/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  updateAttributeSet(@Param('id') id: string, @Body() body: unknown) {
    return this.taxonomy.updateAttributeSet(id, body);
  }
  @Delete('attribute-sets/:id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  deleteAttributeSet(@Param('id') id: string) {
    return this.taxonomy.deleteAttributeSet(id);
  }
}

function numberLimit(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
