import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { CatalogService } from './catalog.service';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('Admin catalog')
@ApiBearerAuth()
@Controller('api/v1/admin/catalog')
export class AdminCatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  @Get('products')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'List all products with server-side pagination and filters' })
  products(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') query?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.catalog.adminList({
      page: positiveInteger(page, 1),
      pageSize: positiveInteger(pageSize, 25, 100),
      ...(query?.trim() ? { query: query.trim() } : {}),
      ...(status ? { status } : {}),
      ...(sort ? { sort } : {}),
    });
  }

  @Get('categories')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'List categories with server-side pagination and filters' })
  categories(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') query?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.taxonomy.adminCategories({
      page: positiveInteger(page, 1),
      pageSize: positiveInteger(pageSize, 25, 100),
      ...(query?.trim() ? { query: query.trim() } : {}),
      ...(status ? { status } : {}),
      ...(sort ? { sort } : {}),
    });
  }

  @Get('brands')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'List brands with server-side pagination and filters' })
  brands(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') query?: string,
    @Query('sort') sort?: string,
  ) {
    return this.taxonomy.adminBrands({
      page: positiveInteger(page, 1),
      pageSize: positiveInteger(pageSize, 25, 100),
      ...(query?.trim() ? { query: query.trim() } : {}),
      ...(sort ? { sort } : {}),
    });
  }
}

function positiveInteger(value: string | undefined, fallback: number, maximum = 100_000) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}
