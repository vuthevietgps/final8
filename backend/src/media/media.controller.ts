import { Controller, Get, Post, Delete, Query, Body, Param, UploadedFile, UseInterceptors, Res, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import { MediaService } from './media.service';
import * as fs from 'fs';
import * as path from 'path';

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

  @Get('serve/*')
  async serveFile(@Req() req: any, @Res() res: any) {
    try {
      // Extract file path from URL after /serve/
      const urlPath = req.url || req.path || '';
      const match = urlPath.match(/\/api\/media\/serve\/(.+)$/);
      if (!match || !match[1]) {
        console.log('No file path found in URL:', urlPath);
        return res.status(400).json({ error: 'File path is required' });
      }
      
      const filePath = decodeURIComponent(match[1]);
      console.log('Serving file:', filePath);
      
      // Construct full path to media file
      const mediaDir = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
      const fullPath = path.join(mediaDir, filePath);
      
      console.log('Full path:', fullPath);
      
      // Security check - ensure path is within media directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedMediaDir = path.resolve(mediaDir);
      if (!resolvedPath.startsWith(resolvedMediaDir)) {
        console.log('Access denied - path outside media dir');
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.log('File not found:', fullPath);
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set appropriate content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      console.log('Sending file with content-type:', contentType);
      
      // Send file
      return res.sendFile(fullPath);
    } catch (error) {
      console.error('Error serving media file:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
