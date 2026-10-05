import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { CatalogService } from './catalog.service';
import type { ProductInput } from './catalog.schemas';
@ApiTags('Catalog')
@Controller('api/v1/products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Public() @Get() @ApiOperation({ summary: 'List active products' }) list(@Query('categoryId') categoryId?: string, @Query('alcohol') alcohol?: string, @Query('cursor') cursor?: string) { return this.catalog.list({ ...(categoryId ? { categoryId } : {}), ...(alcohol ? { alcohol: alcohol === 'true' } : {}), ...(cursor ? { cursor } : {}) }); }
  @Public() @Get(':id') @ApiOperation({ summary: 'Get product details' }) byId(@Param('id') id: string) { return this.catalog.byId(id); }
  @Post() @RequirePermissions('catalog.write') @ApiBearerAuth() @ApiOperation({ summary: 'Create a product' }) create(@Body() input: ProductInput) { return this.catalog.create(input); }
  @Patch(':id') @RequirePermissions('catalog.write') @ApiBearerAuth() @ApiOperation({ summary: 'Update a product' }) update(@Param('id') id: string, @Body() input: ProductInput) { return this.catalog.update(id, input); }
  @Post(':id/variants') @RequirePermissions('catalog.write') @ApiBearerAuth() @ApiOperation({ summary: 'Create a product variant' }) variant(@Param('id') id: string, @Body() input: unknown) { return this.catalog.addVariant(id, input); }
}
