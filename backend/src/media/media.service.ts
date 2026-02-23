import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';

// Public URL base for media files
const PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || '/media';

// Resolve the actual media directory robustly across dev/prod layouts
function resolveMediaDir(): string {
  const envDir = process.env.MEDIA_DIR;
  const candidates = [
    envDir,
    path.join(process.cwd(), '..', 'media'),                     // <repo>/media (repo root)
    path.join(process.cwd(), '..', 'uploads', 'media'),          // <repo>/uploads/media
    path.join(process.cwd(), 'uploads', 'media'),                // backend/uploads/media
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    try { if (fs.existsSync(dir)) return dir; } catch {}
  }
  // Fallback: ensure default within backend folder
  const fallback = path.join(process.cwd(), 'uploads', 'media');
  try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
  return fallback;
}

const MEDIA_DIR = resolveMediaDir();

@Injectable()
export class MediaService {
  constructor(@InjectModel(Media.name) private model: Model<MediaDocument>) {}

  ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  private makeDest(ext: string) {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const folder = path.join(MEDIA_DIR, y, m);
    this.ensureDir(folder);
    const filename = `${crypto.randomUUID()}${ext ? '.' + ext.replace(/^\./, '') : ''}`;
    const abs = path.join(folder, filename);
    const url = `${PUBLIC_BASE}/${y}/${m}/${filename}`.replace(/\\/g, '/');
    return { abs, url, filename };
  }

  /**
   * Delete media by ID and remove physical file
   */
  async deleteById(id: string) {
    const media = await this.model.findById(id);
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    // Delete physical file
    try {
      const filePath = path.join(MEDIA_DIR, media.url.replace(PUBLIC_BASE, '').replace(/^[\/\\]/, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn('Could not delete physical file:', error);
    }
    // Delete from database
    await this.model.findByIdAndDelete(id);
    return { success: true, message: 'Media deleted successfully' };
  }

  /**
   * Clean up orphaned media files (files without database records)
   */
  async cleanupOrphanedFiles() {
    const results = {
      scannedFiles: 0,
      orphanedFiles: 0,
      deletedFiles: 0,
      errors: [] as string[]
    };

    try {
      // Get all media records from database
      const allMedia = await this.model.find({}, 'url').exec();
      const dbUrls = new Set(allMedia.map(m => m.url));

      // Scan physical files
      const scanDir = (dir: string, basePath = '') => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            scanDir(itemPath, path.join(basePath, item).replace(/\\/g, '/'));
          } else {
            results.scannedFiles++;
            const fileUrl = `${PUBLIC_BASE}/${path.join(basePath, item).replace(/\\/g, '/')}`;
            if (!dbUrls.has(fileUrl)) {
              results.orphanedFiles++;
              try {
                fs.unlinkSync(itemPath);
                results.deletedFiles++;
              } catch (error: any) {
                results.errors.push(`Failed to delete ${itemPath}: ${error.message}`);
              }
            }
          }
        }
      };

      scanDir(MEDIA_DIR);
    } catch (error: any) {
      results.errors.push(`Cleanup failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Validate and clean product images - remove references to non-existent files
   */
  async validateProductImages() {
    const results = {
      totalProducts: 0,
      invalidImages: 0,
      cleanedProducts: 0,
      errors: [] as string[]
    };

    try {
      // Import Product model dynamically to avoid circular dependency
      const mongoose = require('mongoose');
      const Product = mongoose.model('Product');
      
      const products = await Product.find({});
      results.totalProducts = products.length;

      for (const product of products) {
        let hasChanges = false;
        
        // Check main images
        if (product.images && product.images.length > 0) {
          const validImages = [];
          for (const imageUrl of product.images) {
            if (await this.validateImageUrl(imageUrl)) {
              validImages.push(imageUrl);
            } else {
              results.invalidImages++;
              hasChanges = true;
            }
          }
          if (validImages.length !== product.images.length) {
            product.images = validImages;
          }
        }

        // Check fanpage variations
        if (product.fanpageVariations && product.fanpageVariations.length > 0) {
          for (const variation of product.fanpageVariations) {
            if (variation.customImages && variation.customImages.length > 0) {
              const validCustomImages = [];
              for (const imageUrl of variation.customImages) {
                if (await this.validateImageUrl(imageUrl)) {
                  validCustomImages.push(imageUrl);
                } else {
                  results.invalidImages++;
                  hasChanges = true;
                }
              }
              if (validCustomImages.length !== variation.customImages.length) {
                variation.customImages = validCustomImages;
              }
            }
          }
        }

        if (hasChanges) {
          await product.save();
          results.cleanedProducts++;
        }
      }
      
    } catch (error) {
      results.errors.push(`Validation failed: ${error.message}`);
    }

    return results;
  }

  /**
   * Check if image URL points to existing file
   */
  private async validateImageUrl(imageUrl: string): Promise<boolean> {
    if (!imageUrl || !imageUrl.startsWith(PUBLIC_BASE)) {
      return false; // External URLs are considered invalid here
    }
    try {
      const filePath = path.join(MEDIA_DIR, imageUrl.replace(PUBLIC_BASE, '').replace(/^[\/\\]/, ''));
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  async saveBuffer(buf: Buffer, opts: { mime?: string; ext?: string; productId?: string; fanpageId?: string; alt?: string; tags?: string[]; isMainImage?: boolean; sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing'; }) {
    const ext = (opts.ext || '').replace(/^\./, '').toLowerCase();
    const dest = this.makeDest(ext);
    fs.writeFileSync(dest.abs, buf);
    // derive dimensions if possible
    let width: number | undefined;
    let height: number | undefined;
    let aspectRatio: string | undefined;
    try {
      const meta = await sharp(buf).metadata();
      width = meta.width || undefined;
      height = meta.height || undefined;
      if (width && height) {
        const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
        const g = gcd(width, height);
        aspectRatio = `${Math.round(width / g)}:${Math.round(height / g)}`;
      }
    } catch {}
    const doc = await this.model.create({
      url: dest.url,
      path: dest.abs,
      filename: dest.filename,
      mimeType: opts.mime,
      ext,
      size: buf.length,
      productId: opts.productId ? new Types.ObjectId(opts.productId) : undefined,
      fanpageId: opts.fanpageId ? new Types.ObjectId(opts.fanpageId) : undefined,
      tags: opts.tags || [],
      alt: opts.alt,
      isMainImage: opts.isMainImage || false,
      sourceType: opts.sourceType || 'gallery',
      width, height, aspectRatio,
    });
    return doc.toObject();
  }

  async importFromUrl(imageUrl: string, opts: { productId?: string; fanpageId?: string; alt?: string; tags?: string[]; isMainImage?: boolean; sourceType?: 'gallery' | 'feedback' | 'ugc' | 'marketing'; }) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || undefined;
    let ext = '';
    if (mime?.includes('jpeg')) ext = 'jpg';
    else if (mime?.includes('png')) ext = 'png';
    else if (mime?.includes('webp')) ext = 'webp';
    else if (mime?.includes('gif')) ext = 'gif';
    return this.saveBuffer(Buffer.from(arrayBuf), { mime, ext, ...opts });
  }

  async list(query: any = {}) {
    const filter: any = {};
    if (query.productId) filter.productId = query.productId;
    if (query.fanpageId) filter.fanpageId = query.fanpageId;
    if (query.tag) filter.tags = query.tag;
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, parseInt(query.limit) || 30);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.model.countDocuments(filter)
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Media not found');
    try { if (fs.existsSync(doc.path)) fs.unlinkSync(doc.path); } catch {}
    await doc.deleteOne();
    return { deleted: true };
  }

  async syncFilesWithDatabase() {
    // Đường dẫn thư mục media
    const mediaDir = MEDIA_DIR;
    
    if (!fs.existsSync(mediaDir)) {
      return { message: 'Thư mục media không tồn tại', filesInDir: 0, filesInDb: 0 };
    }

    // Lấy danh sách files thực tế trong thư mục (recursive)
    const getAllFiles = (dir: string, basePath = ''): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...getAllFiles(fullPath, path.join(basePath, item)));
        } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(item)) {
          files.push(path.join(basePath, item).replace(/\\/g, '/'));
        }
      }
      return files;
    };

    const filesInDir = getAllFiles(mediaDir);
    
    // Lấy danh sách files trong database
    const filesInDb = await this.model.find({}).select('url filename');
    const dbUrls = filesInDb.map(f => f.url?.replace(PUBLIC_BASE + '/', '') || f.filename);
    
    // Files có trong thư mục nhưng chưa có trong DB
    const missingInDb = filesInDir.filter(file => !dbUrls.includes(file));
    
    // Files có trong DB nhưng không còn trong thư mục
    const missingInDir = dbUrls.filter(url => url && !filesInDir.includes(url));
    
    // Thêm files mới vào DB
    for (const filePath of missingInDb) {
      const filename = path.basename(filePath);
      const fullPath = path.join(mediaDir, filePath);
      const stat = fs.statSync(fullPath);
      
      await this.model.create({
        filename,
        url: `${PUBLIC_BASE}/${filePath}`,
        path: fullPath,
        mimetype: this.getMimeType(filename),
        size: stat.size,
        createdAt: new Date()
      });
    }
    
    // Xóa records của files không còn tồn tại
    if (missingInDir.length > 0) {
      await this.model.deleteMany({ 
        $or: [
          { url: { $in: missingInDir.map(f => `${PUBLIC_BASE}/${f}`) } },
          { filename: { $in: missingInDir.map(f => path.basename(f)) } }
        ]
      });
    }
    
    return {
      message: `Đồng bộ hoàn thành`,
      totalFilesInDir: filesInDir.length,
      totalFilesInDb: (await this.model.countDocuments()),
      addedToDb: missingInDb.length,
      removedFromDb: missingInDir.length,
      addedFiles: missingInDb,
      removedFiles: missingInDir
    };
  }
  
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg', 
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}
