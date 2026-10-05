import { Controller, Get, Inject, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { CatalogImportService } from './catalog-import.service';
import type { DuplicatePolicy } from './catalog-import.service';
@ApiTags('Catalog import')
@ApiBearerAuth()
@RequirePermissions('catalog.write')
@Controller('api/v1/catalog/imports')
export class CatalogImportController {
  constructor(@Inject(CatalogImportService) private readonly imports: CatalogImportService) {}
  @Post() @ApiConsumes('multipart/form-data') @ApiOperation({ summary: 'Validate or import a CSV/XLSX catalogue atomically' }) @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } })) run(@UploadedFile() file: Express.Multer.File, @Query('duplicatePolicy') duplicatePolicy: DuplicatePolicy = 'fail', @Query('dryRun') dryRun = 'true') { if (!file) throw new Error('Import file is required'); const userId = TenantContext.get()?.userId; if (!userId) throw new Error('Authenticated user context is required'); return this.imports.execute(file.buffer, file.originalname, duplicatePolicy, dryRun === 'true', userId); }
  @Get(':id/errors.csv') @ApiOperation({ summary: 'Download a row-keyed import error report' }) async report(@Param('id') id: string, @Res() response: Response) { response.type('text/csv').send(await this.imports.errorReport(id)); }
}
