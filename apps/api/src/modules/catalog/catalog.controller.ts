import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, RequirePermissions } from '../../common/auth/auth.decorators';
import { CatalogService } from './catalog.service';
import type { ProductInput } from './catalog.schemas';
import type { Request } from 'express';
import { AgeGateTokenService } from '../../common/security/age-gate-token.service';
@ApiTags('Catalog')
@Controller('api/v1/products')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly ageGate: AgeGateTokenService,
  ) {}
  @Public() @Get() @ApiOperation({ summary: 'List active products' }) list(
    @Req() request: Request,
    @Headers('x-session-id') sessionId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('alcohol') alcohol?: string,
    @Query('cursor') cursor?: string,
  ) {
    const allowAlcohol = this.ageGate.verify(
      (request.cookies?.age_gate as string | undefined) ?? request.header('x-age-gate-token'),
      sessionId,
    );
    return this.catalog.list({
      ...(categoryId ? { categoryId } : {}),
      alcohol: allowAlcohol && alcohol === 'true',
      ...(cursor ? { cursor } : {}),
    });
  }
  @Public() @Get(':id') @ApiOperation({ summary: 'Get product details' }) byId(
    @Param('id') id: string,
  ) {
    return this.catalog.byId(id);
  }
  @Post()
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() input: ProductInput) {
    return this.catalog.create(input);
  }
  @Patch(':id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() input: ProductInput) {
    return this.catalog.update(id, input);
  }
  @Delete(':id')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unused product or remove a referenced product from sale' })
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }
  @Post(':id/variants')
  @RequirePermissions('catalog.write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product variant' })
  variant(@Param('id') id: string, @Body() input: unknown) {
    return this.catalog.addVariant(id, input);
  }
}
