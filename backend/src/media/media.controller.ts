import { Controller, Get, Post, Delete, Query, Body, Param, UploadedFile, UseInterceptors, Res, Req, Inject, forwardRef, UseGuards, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import { MediaService } from './media.service';
import { SyncMediaService } from './sync-media.service';
import { ProductService } from '../product/product.service';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('media')
@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly syncMediaService: SyncMediaService,
    @Inject(forwardRef(() => ProductService)) private readonly productService: ProductService,
    @InjectModel(Media.name) private model: Model<MediaDocument>
  ) {}
  private readonly logger = new Logger(MediaController.name);

  // Build absolute URL if needed for reporting/download links
  private ensureAbsolute(url: string) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
    if (!origin) return url;
    return (origin.replace(/\/$/, '') + url).replace(/\s/g, '');
  }

  @Get()
  @RequirePermissions('media')
  async list(@Query() q: any) {
    return this.mediaService.list(q);
  }

  @Post('master-sync')
  @RequirePermissions('media')
  async masterSync() {
    const result = await this.syncMediaService.masterSync();
    return { 
      success: true, 
      message: 'Đồng bộ hoàn chỉnh 3 lớp dữ liệu thành công',
      data: result 
    };
  }

  @Post('auto-sync')
  @RequirePermissions('media')
  async autoSync() {
    // Use ProductService which has proper model access
    const cleanupResult = await this.productService.cleanupAndValidateImages();
    
    return {
      success: true,
      message: 'Đã làm sạch tự động các tham chiếu ảnh không hợp lệ',
      data: cleanupResult
    };
  }

  @Post('bulk-delete')
  @RequirePermissions('media')
  async bulkDelete(@Body('ids') ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, message: 'Danh sách ids rỗng', data: { deleted: 0, failed: 0, errors: ['No ids provided'] } };
    }

    const results = { deleted: 0, failed: 0, errors: [] as string[] };
    for (const id of ids) {
      try {
        await this.mediaService.deleteById(id);
        results.deleted++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Failed ${id}: ${e?.message || 'unknown error'}`);
      }
    }

    // Cleanup product references after bulk deletion
    try {
      await this.productService.cleanupAndValidateImages();
    } catch (e: any) {
      results.errors.push('Cleanup error: ' + (e?.message || e));
    }

    return { success: true, message: 'Đã xóa hàng loạt media', data: results };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermissions('media')
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('productId') productId?: string,
    @Body('alt') alt?: string,
    @Body('tags') tags?: string,
    @Body('isMainImage') isMainImage?: string,
    @Body('sourceType') sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing',
  ) {
    if (!alt || !alt.trim()) {
      return { success: false, message: 'Thiếu mô tả (alt). Vui lòng nhập mô tả ảnh trước khi tải lên.' };
    }
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const buf = (file as any).buffer || (file.path ? fs.readFileSync((file as any).path) : null);
    if (!buf) throw new Error('File buffer not available');
    return this.mediaService.saveBuffer(buf, {
      mime: file.mimetype,
      ext: (file.originalname.split('.').pop()||'').toLowerCase(),
      productId,
      alt,
      tags: tagList,
      isMainImage: isMainImage === 'true',
      sourceType
    });
  }

  @Delete(':id')
  @RequirePermissions('media')
  async deleteMedia(@Param('id') id: string) {
    const result = await this.mediaService.deleteById(id);
    
    // Auto-cleanup product references after deleting media
    try {
      await this.productService.cleanupAndValidateImages();
    } catch (error) {
      console.warn('Auto-cleanup product references failed:', error.message);
    }
    
    return result;
  }

  @Post('cleanup-orphaned')
  @RequirePermissions('media')
  async cleanupOrphanedMedia() {
    return this.mediaService.cleanupOrphanedFiles();
  }

  @Post('validate-product-images')
  @RequirePermissions('media')
  async validateProductImages() {
    // Delegate to ProductService to ensure correct schema/model usage
    return this.productService.cleanupAndValidateImages();
  }

  @Post('import-by-url')
  @RequirePermissions('media')
  async importByUrl(
    @Body('url') url: string,
    @Body('productId') productId?: string,
    @Body('alt') alt?: string,
    @Body('tags') tags?: string,
    @Body('isMainImage') isMainImage?: boolean,
    @Body('sourceType') sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing',
  ) {
    if (!alt || !alt.trim()) {
      return { success: false, message: 'Thiếu mô tả (alt). Vui lòng nhập mô tả ảnh trước khi import.' };
    }
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    return this.mediaService.importFromUrl(url, { productId, alt, tags: tagList, isMainImage, sourceType });
  }

  // Báo cáo nhanh ảnh theo sản phẩm với link đầy đủ (absolute URL)
  @Get('product-report/:productId')
  @RequirePermissions('media')
  async productImageReport(@Param('productId') productId: string) {
    const product = await this.productService.findOne(productId);
    if (!product) return { productId, images: [], total: 0 };
    const images: any[] = [];
    const push = (url: string, meta: any) => {
      if (!url) return;
      images.push({ url, absoluteUrl: this.ensureAbsolute(url), ...meta });
    };
    // 1) Ảnh chung của sản phẩm
    (product as any).images?.forEach((img: any) => {
      const url = img?.url || img;
      push(url, { source: 'product', description: img?.description, isMainImage: img?.isMainImage === true });
    });
    // 2) Ảnh custom theo fanpage (nếu có)
    (product as any).fanpageVariations?.forEach((v: any) => {
      (v?.customImages || []).forEach((url: string) => {
        push(url, { source: 'fanpageVariation', fanpageId: v?.fanpageId, variationPriority: v?.priority ?? 0 });
      });
    });
    return {
      productId,
      productName: (product as any).name,
      total: images.length,
      images,
    };
  }

  // Note: removed duplicate DELETE(':id') route; use deleteMedia above

  @Public()
  @Get('serve/:year/:month/:filename')
  async serveYMFViaServe(@Param('year') year: string, @Param('month') month: string, @Param('filename') filename: string, @Res() res: any) {
    const pathParam = `${year}/${month}/${filename}`;
    return this.serveFile(pathParam, res);
  }

  @Public()
  @Get('serve/*path')
  async serveFile(@Param('path') wildcard: string, @Res() res: any) {
    try {
      if (!wildcard) {
        return res.status(400).json({ error: 'File path is required' });
      }

      // Normalize and sanitize path
      const filePath = decodeURIComponent(wildcard).replace(/^\/+/, '');
      
      // Construct full path to media file
      const mediaDir = ((): string => {
        const envDir = process.env.MEDIA_DIR;
        const candidates = [
          envDir,
          path.join(process.cwd(), '..', 'media'),
          path.join(process.cwd(), '..', 'uploads', 'media'),
          path.join(process.cwd(), 'uploads', 'media'),
        ].filter(Boolean) as string[];
        for (const d of candidates) { try { if (fs.existsSync(d)) return d; } catch {} }
        const fallback = path.join(process.cwd(), 'uploads', 'media');
        try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
        return fallback;
      })();
  const fullPath = path.join(mediaDir, filePath);
  this.logger.debug(`[MEDIA] request "+${filePath}+" → base="${mediaDir}" → full="${fullPath}"`);
      
      // Security check - ensure path is within media directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedMediaDir = path.resolve(mediaDir);
      if (!resolvedPath.startsWith(resolvedMediaDir)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Check if file exists; if not, try DB lookup to get absolute path
      if (!fs.existsSync(fullPath)) {
        try {
          const base = process.env.MEDIA_PUBLIC_BASE || '/media';
          const url = `${base}/${filePath}`.replace(/\\/g, '/').replace(/\/+/, '/');
          const rec = await this.model.findOne({ url }).lean();
          if (rec?.path && fs.existsSync(rec.path)) {
            this.logger.debug(`[MEDIA] fallback DB path: ${rec.path}`);
            return res.sendFile(rec.path);
          }
        } catch (e: any) {
          this.logger.warn(`[MEDIA] DB fallback failed: ${e?.message || e}`);
        }
        this.logger.warn(`[MEDIA] 404 not found (fs): ${fullPath}`);
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
      
      // Send file
      return res.sendFile(fullPath);
    } catch (error) {
      this.logger.error(`[MEDIA] serve error: ${error?.message || error}`);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Explicit matcher for common pattern /media/YYYY/MM/filename.ext
  @Public()
  @Get(':year/:month/:filename')
  async serveYMF(@Param('year') year: string, @Param('month') month: string, @Param('filename') filename: string, @Res() res: any) {
    const pathParam = `${year}/${month}/${filename}`;
    return this.serveFile(pathParam, res);
  }

  // Legacy compatibility: allow direct /media/yyyy/mm/file path without "serve" segment
  @Public()
  @Get('*path')
  async legacyServe(@Param('path') wildcard: string, @Res() res: any) {
    return this.serveFile(wildcard, res);
  }
}
