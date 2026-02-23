/**
 * Media Synchronization Service
 * Đồng bộ hoàn chỉnh giữa filesystem, Media table và Product references
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import * as fs from 'fs';
import * as path from 'path';

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
const PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || '/media';

@Injectable()
export class SyncMediaService {
  constructor(
    @InjectModel(Media.name) private mediaModel: Model<MediaDocument>
  ) {}

  /**
   * 🔄 MASTER SYNC - Đồng bộ hoàn toàn 3 lớp dữ liệu
   */
  async masterSync() {
    const results = {
      phase1: await this.syncFilesToDatabase(),
      // Note: Phase 2 (DB -> Products) is handled by ProductService now to avoid schema injection issues
      phase2: { mediaRecords: 0, validReferences: 0, invalidReferencesRemoved: 0, errors: ['Phase 2 delegated to ProductService via /products/cleanup-images'] }, 
      phase3: await this.cleanOrphanedFiles(),
      summary: {
        totalFiles: 0,
        totalMediaRecords: 0,
        totalProductReferences: 0,
        syncedSuccessfully: true
      }
    };

    // Tính toán summary
    results.summary.totalFiles = results.phase1.filesFound;
  results.summary.totalMediaRecords = (results.phase2 as any).mediaRecords || 0;
  results.summary.totalProductReferences = (results.phase2 as any).validReferences || 0;

    return results;
  }

  /**
   * 📁→🗄️ Phase 1: Sync filesystem TO database
   */
  async syncFilesToDatabase() {
    const results = {
      filesFound: 0,
      mediaRecordsCreated: 0,
      mediaRecordsUpdated: 0,
      errors: [] as string[]
    };

    try {
      // Scan tất cả files trong media directory
      const allFiles = this.scanAllFiles(MEDIA_DIR);
      results.filesFound = allFiles.length;

      for (const filePath of allFiles) {
        const relativePath = path.relative(MEDIA_DIR, filePath).replace(/\\/g, '/');
        const url = `${PUBLIC_BASE}/${relativePath}`;

        // Kiểm tra xem đã có record chưa
        const existingMedia = await this.mediaModel.findOne({ url });

        if (!existingMedia) {
          // Tạo media record mới
          const stats = fs.statSync(filePath);
          await this.mediaModel.create({
            url,
            path: filePath,
            filename: path.basename(filePath),
            size: stats.size,
            mimeType: this.getMimeType(filePath),
            ext: path.extname(filePath),
            createdAt: stats.birthtime
          });
          results.mediaRecordsCreated++;
        }
      }

    } catch (error) {
      results.errors.push(`Sync files to DB failed: ${error.message}`);
    }

    return results;
  }

  /**
   * 🗄️→📦 Phase 2: Sync database TO product references
   */
  async syncDatabaseToProducts() {
    const results = {
      mediaRecords: 0,
      validReferences: 0,
      invalidReferencesRemoved: 0,
      errors: [] as string[]
    };

    try {
      // Import Product model
      const mongoose = require('mongoose');
      const Product = mongoose.model('Product');

      // Lấy tất cả valid media URLs
      const validMediaUrls = new Set();
      const mediaRecords = await this.mediaModel.find({}).select('url');
      results.mediaRecords = mediaRecords.length;
      
      mediaRecords.forEach(media => validMediaUrls.add(media.url));

      // Clean product references
      const products = await Product.find({});
      
      for (const product of products) {
        let hasChanges = false;

        // Clean main images
        if (product.images && product.images.length > 0) {
          const validImages = product.images.filter(imgObj => {
            if (validMediaUrls.has(imgObj.url)) {
              results.validReferences++;
              return true;
            } else {
              results.invalidReferencesRemoved++;
              return false;
            }
          });

          if (validImages.length !== product.images.length) {
            product.images = validImages;
            hasChanges = true;
          }
        }

        // Clean fanpage variation images
        if (product.fanpageVariations && product.fanpageVariations.length > 0) {
          for (const variation of product.fanpageVariations) {
            // customImages can be string or array, handle both cases
            if (variation.customImages) {
              if (typeof variation.customImages === 'string') {
                // Single image URL as string
                if (variation.customImages && !validMediaUrls.has(variation.customImages)) {
                  variation.customImages = '';
                  results.invalidReferencesRemoved++;
                  hasChanges = true;
                } else if (variation.customImages) {
                  results.validReferences++;
                }
              } else if (Array.isArray(variation.customImages) && variation.customImages.length > 0) {
                // Multiple images as array
                const validCustomImages = variation.customImages.filter(url => {
                  if (validMediaUrls.has(url)) {
                    results.validReferences++;
                    return true;
                  } else {
                    results.invalidReferencesRemoved++;
                    return false;
                  }
                });

                if (validCustomImages.length !== variation.customImages.length) {
                  variation.customImages = validCustomImages;
                  hasChanges = true;
                }
              }
            }
          }
        }

        if (hasChanges) {
          await product.save();
        }
      }

    } catch (error) {
      results.errors.push(`Sync DB to products failed: ${error.message}`);
    }

    return results;
  }

  /**
   * 🧹 Phase 3: Clean orphaned files và database records
   */
  async cleanOrphanedFiles() {
    const results = {
      orphanedFilesRemoved: 0,
      orphanedRecordsRemoved: 0,
      errors: [] as string[]
    };

    try {
      // Remove database records for non-existent files
      const mediaRecords = await this.mediaModel.find({});
      
      for (const record of mediaRecords) {
        if (!fs.existsSync(record.path)) {
          await this.mediaModel.findByIdAndDelete(record._id);
          results.orphanedRecordsRemoved++;
        }
      }

      // Remove files not in database
      const validPaths = new Set();
      const currentMediaRecords = await this.mediaModel.find({}).select('path');
      currentMediaRecords.forEach(record => validPaths.add(record.path));

      const allFiles = this.scanAllFiles(MEDIA_DIR);
      for (const filePath of allFiles) {
        if (!validPaths.has(filePath)) {
          try {
            fs.unlinkSync(filePath);
            results.orphanedFilesRemoved++;
          } catch (error) {
            results.errors.push(`Failed to delete ${filePath}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      results.errors.push(`Clean orphaned failed: ${error.message}`);
    }

    return results;
  }

  /**
   * 📋 Utility: Scan tất cả files trong thư mục
   */
  private scanAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) return files;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        files.push(...this.scanAllFiles(itemPath));
      } else if (stat.isFile()) {
        files.push(itemPath);
      }
    }

    return files;
  }

  /**
   * 🔍 Utility: Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}