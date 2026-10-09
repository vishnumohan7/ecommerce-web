import { Body, Controller, Delete, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { ImageService } from './image.service';
@ApiTags('Catalog')
@Controller('api/v1/products')
export class ImageController {
  constructor(private readonly images: ImageService) {}
  @Post(':id/images') @RequirePermissions('catalog.write') @ApiBearerAuth() @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', required: ['file', 'altText'], properties: { file: { type: 'string', format: 'binary' }, altText: { type: 'string' }, featured: { type: 'boolean' } } } }) @ApiOperation({ summary: 'Upload and safely re-encode a product image' }) @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } })) upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body('altText') altText: string, @Body('featured') featured?: string) { if (!file) throw new Error('Image file is required'); return this.images.upload(id, file.buffer, altText, featured === 'true'); }
  @Delete(':id/images/:imageId') @RequirePermissions('catalog.write') @ApiBearerAuth() @ApiOperation({ summary: 'Remove a product image and compact gallery positions' }) remove(@Param('id') id: string, @Param('imageId') imageId: string) { return this.images.remove(id, imageId); }
}
