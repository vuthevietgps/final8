import { Controller, Get, Post, Delete, Query, Body, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import { MediaService } from './media.service';
import * as fs from 'fs';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    @InjectModel(Media.name) private model: Model<MediaDocument>
  ) {}

  @Get()
  async list(@Query() q: any) {
    return this.mediaService.list(q);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('productId') productId?: string,
    @Body('fanpageId') fanpageId?: string,
    @Body('alt') alt?: string,
    @Body('tags') tags?: string,
    @Body('isMainImage') isMainImage?: string,
    @Body('sourceType') sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing',
  ) {
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const buf = (file as any).buffer || (file.path ? fs.readFileSync((file as any).path) : null);
    if (!buf) throw new Error('File buffer not available');
    return this.mediaService.saveBuffer(buf, {
      mime: file.mimetype,
      ext: (file.originalname.split('.').pop()||'').toLowerCase(),
      productId,
      fanpageId,
      alt,
      tags: tagList,
      isMainImage: isMainImage === 'true',
      sourceType
    });
  }

  @Post('import-by-url')
  async importByUrl(
    @Body('url') url: string,
    @Body('productId') productId?: string,
    @Body('fanpageId') fanpageId?: string,
    @Body('alt') alt?: string,
    @Body('tags') tags?: string,
    @Body('isMainImage') isMainImage?: boolean,
    @Body('sourceType') sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing',
  ) {
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    return this.mediaService.importFromUrl(url, { productId, fanpageId, alt, tags: tagList, isMainImage, sourceType });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
