/**
 * File: file-upload.service.ts
 * Mục đích: Service xử lý upload và quản lý file ảnh sản phẩm
 * Chức năng: Upload to cloud, generate URLs, optimize images
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import * as sharp from 'sharp';

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
  optimized?: {
    thumbnail: string;
    medium: string;
    large: string;
  };
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadPath = join(process.cwd(), 'uploads', 'products');
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ];

  constructor() {
    this.ensureUploadDirectory();
  }

  /**
   * Get multer configuration (now handled in module)
   * This method kept for reference but not used
   */

  /**
   * Process uploaded files and create optimized versions
   */
  async processUploadedFiles(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    const processedFiles: UploadedFile[] = [];

    for (const file of files) {
      try {
        // Generate base URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const fileUrl = `${baseUrl}/uploads/products/${file.filename}`;

        // Create optimized versions
        const optimized = await this.createOptimizedVersions(file);

        const uploadedFile: UploadedFile = {
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          url: fileUrl,
          size: file.size,
          mimetype: file.mimetype,
          optimized
        };

        processedFiles.push(uploadedFile);

        this.logger.log(`Processed file: ${file.originalname} -> ${file.filename}`);

      } catch (error) {
        this.logger.error(`Failed to process file ${file.originalname}:`, error.message);
        
        // Clean up failed file
        try {
          unlinkSync(file.path);
        } catch (unlinkError) {
          this.logger.error(`Failed to clean up file ${file.path}:`, unlinkError.message);
        }
      }
    }

    return processedFiles;
  }

  /**
   * Create optimized versions of uploaded image
   */
  private async createOptimizedVersions(file: Express.Multer.File): Promise<UploadedFile['optimized']> {
    try {
      const baseFilename = file.filename.replace(extname(file.filename), '');
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

      // Create thumbnail (150x150)
      const thumbnailFilename = `${baseFilename}_thumb.webp`;
      const thumbnailPath = join(this.uploadPath, thumbnailFilename);
      
      await sharp(file.path)
        .resize(150, 150, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);

      // Create medium size (400x400)
      const mediumFilename = `${baseFilename}_medium.webp`;
      const mediumPath = join(this.uploadPath, mediumFilename);
      
      await sharp(file.path)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(mediumPath);

      // Create large size (800x800)
      const largeFilename = `${baseFilename}_large.webp`;
      const largePath = join(this.uploadPath, largeFilename);
      
      await sharp(file.path)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(largePath);

      return {
        thumbnail: `${baseUrl}/uploads/products/${thumbnailFilename}`,
        medium: `${baseUrl}/uploads/products/${mediumFilename}`,
        large: `${baseUrl}/uploads/products/${largeFilename}`
      };

    } catch (error) {
      this.logger.error('Failed to create optimized versions:', error.message);
      return undefined;
    }
  }

  /**
   * Delete uploaded files and their optimized versions
   */
  async deleteFiles(filenames: string[]): Promise<void> {
    for (const filename of filenames) {
      try {
        // Delete original file
        const originalPath = join(this.uploadPath, filename);
        if (existsSync(originalPath)) {
          unlinkSync(originalPath);
        }

        // Delete optimized versions
        const baseFilename = filename.replace(extname(filename), '');
        const optimizedFiles = [
          `${baseFilename}_thumb.webp`,
          `${baseFilename}_medium.webp`,
          `${baseFilename}_large.webp`
        ];

        for (const optimizedFile of optimizedFiles) {
          const optimizedPath = join(this.uploadPath, optimizedFile);
          if (existsSync(optimizedPath)) {
            unlinkSync(optimizedPath);
          }
        }

        this.logger.log(`Deleted file and optimized versions: ${filename}`);

      } catch (error) {
        this.logger.error(`Failed to delete file ${filename}:`, error.message);
      }
    }
  }

  /**
   * Get file information by filename
   */
  getFileInfo(filename: string): UploadedFile | null {
    const filePath = join(this.uploadPath, filename);
    
    if (!existsSync(filePath)) {
      return null;
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const baseFilename = filename.replace(extname(filename), '');

    return {
      originalName: filename,
      filename: filename,
      path: filePath,
      url: `${baseUrl}/uploads/products/${filename}`,
      size: 0, // Would need fs.stat to get actual size
      mimetype: this.getMimeTypeFromExtension(extname(filename)),
      optimized: {
        thumbnail: `${baseUrl}/uploads/products/${baseFilename}_thumb.webp`,
        medium: `${baseUrl}/uploads/products/${baseFilename}_medium.webp`,
        large: `${baseUrl}/uploads/products/${baseFilename}_large.webp`
      }
    };
  }

  /**
   * Validate uploaded files
   */
  validateFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    if (files.length > 10) {
      throw new BadRequestException('Tối đa 10 file mỗi lần tải lên');
    }

    for (const file of files) {
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `File ${file.originalname} có định dạng không được hỗ trợ`
        );
      }

      if (file.size > this.maxFileSize) {
        throw new BadRequestException(
          `File ${file.originalname} vượt quá kích thước cho phép (10MB)`
        );
      }
    }
  }

  /**
   * Generate product image variants for different fanpages
   */
  async generateFanpageVariants(
    originalImage: UploadedFile,
    fanpageId: string,
    customization?: {
      watermark?: string;
      overlay?: string;
      brightness?: number;
      contrast?: number;
    }
  ): Promise<string> {
    try {
      const baseFilename = originalImage.filename.replace(extname(originalImage.filename), '');
      const variantFilename = `${baseFilename}_fp_${fanpageId}.webp`;
      const variantPath = join(this.uploadPath, variantFilename);

      let sharpInstance = sharp(originalImage.path);

      // Apply customizations
      if (customization?.brightness || customization?.contrast) {
        sharpInstance = sharpInstance.modulate({
          brightness: customization.brightness || 1,
          saturation: 1,
          lightness: customization.contrast || 1
        });
      }

      // Save variant
      await sharpInstance
        .webp({ quality: 90 })
        .toFile(variantPath);

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      return `${baseUrl}/uploads/products/${variantFilename}`;

    } catch (error) {
      this.logger.error('Failed to generate fanpage variant:', error.message);
      return originalImage.url; // Return original if variant creation fails
    }
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDirectory(): void {
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadPath}`);
    }
  }

  /**
   * Get mime type from file extension
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };

    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}