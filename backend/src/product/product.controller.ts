/**
 * File: product.controller.ts
 * Mục đích: REST API CRUD cho Sản phẩm với tích hợp Vision AI.
 * Lưu ý: Sử dụng DTO để validate input và gọi service thực thi nghiệp vụ.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { VisionAIService } from './vision-ai.service';
import { FileUploadService } from './file-upload.service';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('product')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly visionAIService: VisionAIService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Get()
  findAll(@Query() query?: any) {
    return this.productService.findAll(query);
  }

  @Get('stats')
  getStats() {
    return this.productService.getStats();
  }

  @Get('category/:categoryId')
  getByCategory(@Param('categoryId') categoryId: string) {
    return this.productService.getByCategory(categoryId);
  }

  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  seedSampleData() {
    if (String(process.env.ALLOW_DANGEROUS_SEED || '').toLowerCase() !== 'true') {
      throw new ForbiddenException('Seed endpoint is disabled. Set ALLOW_DANGEROUS_SEED=true to enable.');
    }
    return this.productService.seedSampleData();
  }

  /**
   * Báo cáo: Sản phẩm có customImages theo fanpage
   * Lưu ý: Đặt route tĩnh trước route tham số ':id' để tránh bị bắt nhầm.
   */
  @Get('variation-images-report')
  async variationImagesReport(
    @Query('fanpageId') fanpageId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.productService.getVariationImagesReport({ fanpageId, search, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    return { success: true, data };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  // List media for a product to help UI show selectable images
  @Get(':id/media')
  async listProductMedia(
    @Param('id') productId: string,
    @Query('fanpageId') fanpageId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Number(limit) || 50);
    const data = await (this.productService as any).listProductMedia?.(productId, { page: p, limit: l, fanpageId });
    if (data) return { success: true, data };
    // fallback direct from media model via service
    const svc: any = this.productService as any;
    if (svc.mediaModel) {
      const filter: any = { productId };
      const skip = (p - 1) * l;
      const [items, total] = await Promise.all([
        svc.mediaModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
        svc.mediaModel.countDocuments(filter),
      ]);
      return { success: true, data: { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) } };
    }
    return { success: true, data: { items: [], total: 0, page: p, limit: l, totalPages: 0 } };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  /**
   * Cập nhật danh sách ảnh custom cho fanpage variation của sản phẩm
   */
  @Patch(':id/fanpage-variation-images')
  async updateFanpageVariationImages(
    @Param('id') productId: string,
    @Body('fanpageId') fanpageId: string,
    @Body('images') images: string[],
    @Body('imagePolicy') imagePolicy?: any,
  ) {
    if (!fanpageId) {
      throw new BadRequestException('Thiếu fanpageId');
    }
    if (!Array.isArray(images)) {
      throw new BadRequestException('images phải là mảng string URL');
    }

    const updated = await this.productService.setFanpageVariationImages(productId, fanpageId, images, imagePolicy);
    return { success: true, data: updated };
  }

  // Best images endpoint for AI/UI preview
  @Get(':id/best-images')
  async bestImages(
    @Param('id') productId: string,
    @Query('fanpageId') fanpageId?: string,
    @Query('limit') limit?: string,
  ) {
    const urls = await this.productService.chooseBestImages({ productId, fanpageId, limit: limit ? Number(limit) : undefined });
    return { success: true, data: urls };
  }

  /**
   * Upload và phân tích ảnh sản phẩm với AI
   */
  @Post('upload-images')
  @UseInterceptors(FilesInterceptor('images', 10, {}))
  async uploadProductImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('fanpageId') fanpageId?: string,
    @Body('configId') configId?: string
  ) {
    try {
      // Validate files
      this.fileUploadService.validateFiles(files);

      // Process uploaded files
      const uploadedFiles = await this.fileUploadService.processUploadedFiles(files);

      // Analyze each image with Vision AI
      const analyzedImages = [];
      for (const file of uploadedFiles) {
        const analysis = await this.visionAIService.analyzeProductImage(file.url, configId);
        
        analyzedImages.push({
          ...file,
          aiAnalysis: analysis
        });
      }

      return {
        success: true,
        message: `Đã tải lên và phân tích ${analyzedImages.length} ảnh`,
        data: {
          images: analyzedImages,
          totalAnalyzed: analyzedImages.length,
          totalKeywords: analyzedImages.reduce((sum, img) => 
            sum + (img.aiAnalysis?.keywords?.length || 0), 0
          )
        }
      };

    } catch (error) {
      throw new BadRequestException(`Lỗi tải ảnh: ${error.message}`);
    }
  }

  /**
   * Tìm sản phẩm tương tự dựa trên mô tả
   */
  @Post('find-similar')
  async findSimilarProducts(
    @Body('query') query: string,
    @Body('fanpageId') fanpageId: string,
    @Body('limit') limit: number = 5
  ) {
    if (!query || !fanpageId) {
      throw new BadRequestException('Thiếu thông tin query hoặc fanpageId');
    }

    const recommendations = await this.visionAIService.findSimilarProducts(
      query, 
      fanpageId, 
      limit
    );

    return {
      success: true,
      data: {
        query,
        fanpageId,
        recommendations,
        total: recommendations.length
      }
    };
  }

  /**
   * Phân tích ảnh từ URL
   */
  @Post('analyze-image')
  async analyzeImageUrl(
    @Body('imageUrl') imageUrl: string,
    @Body('configId') configId?: string
  ) {
    if (!imageUrl) {
      throw new BadRequestException('Thiếu URL ảnh');
    }

    const analysis = await this.visionAIService.analyzeProductImage(imageUrl, configId);

    return {
      success: true,
      data: {
        imageUrl,
        analysis
      }
    };
  }

  /**
   * Tạo variant ảnh cho fanpage cụ thể
   */
  @Post(':id/create-fanpage-variant')
  async createFanpageVariant(
    @Param('id') productId: string,
    @Body('fanpageId') fanpageId: string,
    @Body('imageIndex') imageIndex: number = 0,
    @Body('customization') customization?: any
  ) {
    if (!fanpageId) {
      throw new BadRequestException('Thiếu fanpageId');
    }

    const product = await this.productService.findOne(productId);
    if (!product || !product.images || product.images.length === 0) {
      throw new BadRequestException('Sản phẩm không có ảnh');
    }

    if (imageIndex >= product.images.length) {
      throw new BadRequestException('Index ảnh không hợp lệ');
    }

    const originalImage = product.images[imageIndex];
    
    // Convert product image to UploadedFile format for processing
    const uploadedFileFormat = {
      originalName: `product_${productId}_${imageIndex}`,
      filename: originalImage.url.split('/').pop() || 'image',
      path: '', // Not needed for variant generation
      url: originalImage.url,
      size: 0, // Not critical for this operation
      mimetype: 'image/jpeg' // Default assumption
    };
    
    const variantUrl = await this.fileUploadService.generateFanpageVariants(
      uploadedFileFormat,
      fanpageId,
      customization
    );

    return {
      success: true,
      data: {
        productId,
        fanpageId,
        originalImage: originalImage.url,
        variantUrl,
        customization
      }
    };
  }

  /**
   * Lấy thống kê AI analysis
   */
  @Get('ai-stats')
  async getAIStats(@Query('fanpageId') fanpageId?: string) {
    const stats = await this.productService.getAIAnalysisStats(fanpageId);
    
    return {
      success: true,
      data: stats
    };
  }

  /**
   * 🧹 CLEANUP & SYNCHRONIZATION ENDPOINTS
   * Làm sạch và đồng bộ hóa dữ liệu ảnh sản phẩm
   */
  @Post('cleanup-images')
  async cleanupProductImages() {
    const results = await this.productService.cleanupAndValidateImages();
    return {
      success: true,
      message: 'Đã thực hiện làm sạch và đồng bộ hóa ảnh sản phẩm',
      data: results
    };
  }

  @Post('reset-fanpage-images')
  async resetFanpageImages(
    @Body('fanpageId') fanpageId?: string,
    @Body('removeInvalidOnly') removeInvalidOnly?: boolean
  ) {
    const results = await this.productService.resetFanpageImages(fanpageId, removeInvalidOnly);
    return {
      success: true, 
      message: 'Đã reset ảnh fanpage thành công',
      data: results
    };
  }

  @Get('validate-images-report')
  async validateImagesReport(@Query('fanpageId') fanpageId?: string) {
    const report = await this.productService.generateImageValidationReport(fanpageId);
    return {
      success: true,
      data: report
    };
  }

}
