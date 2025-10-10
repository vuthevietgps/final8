import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Media, MediaDocument } from './schemas/media.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';

// Use backend working directory/uploads/media by default
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
const PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || '/media';

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
}
