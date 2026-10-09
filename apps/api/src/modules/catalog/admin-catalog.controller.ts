import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('Admin catalog')
@ApiBearerAuth()
@Controller('api/v1/admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

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
}

function positiveInteger(value: string | undefined, fallback: number, maximum = 100_000) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}
