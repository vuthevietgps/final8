"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const media_schema_1 = require("./schemas/media.schema");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const node_fetch_1 = require("node-fetch");
const sharp_1 = require("sharp");
const PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || '/media';
function resolveMediaDir() {
    const envDir = process.env.MEDIA_DIR;
    const candidates = [
        envDir,
        path.join(process.cwd(), '..', 'media'),
        path.join(process.cwd(), '..', 'uploads', 'media'),
        path.join(process.cwd(), 'uploads', 'media'),
    ].filter(Boolean);
    for (const dir of candidates) {
        try {
            if (fs.existsSync(dir))
                return dir;
        }
        catch (_a) { }
    }
    const fallback = path.join(process.cwd(), 'uploads', 'media');
    try {
        fs.mkdirSync(fallback, { recursive: true });
    }
    catch (_b) { }
    return fallback;
}
const MEDIA_DIR = resolveMediaDir();
let MediaService = class MediaService {
    constructor(model) {
        this.model = model;
    }
    ensureDir(dir) {
        fs.mkdirSync(dir, { recursive: true });
    }
    makeDest(ext) {
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
    async deleteById(id) {
        const media = await this.model.findById(id);
        if (!media) {
            throw new common_1.NotFoundException('Media not found');
        }
        try {
            const filePath = path.join(MEDIA_DIR, media.url.replace(PUBLIC_BASE, '').replace(/^[\/\\]/, ''));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.warn('Could not delete physical file:', error);
        }
        await this.model.findByIdAndDelete(id);
        return { success: true, message: 'Media deleted successfully' };
    }
    async cleanupOrphanedFiles() {
        const results = {
            scannedFiles: 0,
            orphanedFiles: 0,
            deletedFiles: 0,
            errors: []
        };
        try {
            const allMedia = await this.model.find({}, 'url').exec();
            const dbUrls = new Set(allMedia.map(m => m.url));
            const scanDir = (dir, basePath = '') => {
                if (!fs.existsSync(dir))
                    return;
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    const stat = fs.statSync(itemPath);
                    if (stat.isDirectory()) {
                        scanDir(itemPath, path.join(basePath, item).replace(/\\/g, '/'));
                    }
                    else {
                        results.scannedFiles++;
                        const fileUrl = `${PUBLIC_BASE}/${path.join(basePath, item).replace(/\\/g, '/')}`;
                        if (!dbUrls.has(fileUrl)) {
                            results.orphanedFiles++;
                            try {
                                fs.unlinkSync(itemPath);
                                results.deletedFiles++;
                            }
                            catch (error) {
                                results.errors.push(`Failed to delete ${itemPath}: ${error.message}`);
                            }
                        }
                    }
                }
            };
            scanDir(MEDIA_DIR);
        }
        catch (error) {
            results.errors.push(`Cleanup failed: ${error.message}`);
        }
        return results;
    }
    async validateProductImages() {
        const results = {
            totalProducts: 0,
            invalidImages: 0,
            cleanedProducts: 0,
            errors: []
        };
        try {
            const mongoose = require('mongoose');
            const Product = mongoose.model('Product');
            const products = await Product.find({});
            results.totalProducts = products.length;
            for (const product of products) {
                let hasChanges = false;
                if (product.images && product.images.length > 0) {
                    const validImages = [];
                    for (const imageUrl of product.images) {
                        if (await this.validateImageUrl(imageUrl)) {
                            validImages.push(imageUrl);
                        }
                        else {
                            results.invalidImages++;
                            hasChanges = true;
                        }
                    }
                    if (validImages.length !== product.images.length) {
                        product.images = validImages;
                    }
                }
                if (product.fanpageVariations && product.fanpageVariations.length > 0) {
                    for (const variation of product.fanpageVariations) {
                        if (variation.customImages && variation.customImages.length > 0) {
                            const validCustomImages = [];
                            for (const imageUrl of variation.customImages) {
                                if (await this.validateImageUrl(imageUrl)) {
                                    validCustomImages.push(imageUrl);
                                }
                                else {
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
        }
        catch (error) {
            results.errors.push(`Validation failed: ${error.message}`);
        }
        return results;
    }
    async validateImageUrl(imageUrl) {
        if (!imageUrl || !imageUrl.startsWith(PUBLIC_BASE)) {
            return false;
        }
        try {
            const filePath = path.join(MEDIA_DIR, imageUrl.replace(PUBLIC_BASE, '').replace(/^[\/\\]/, ''));
            return fs.existsSync(filePath);
        }
        catch (_a) {
            return false;
        }
    }
    async saveBuffer(buf, opts) {
        const ext = (opts.ext || '').replace(/^\./, '').toLowerCase();
        const dest = this.makeDest(ext);
        fs.writeFileSync(dest.abs, buf);
        let width;
        let height;
        let aspectRatio;
        try {
            const meta = await (0, sharp_1.default)(buf).metadata();
            width = meta.width || undefined;
            height = meta.height || undefined;
            if (width && height) {
                const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
                const g = gcd(width, height);
                aspectRatio = `${Math.round(width / g)}:${Math.round(height / g)}`;
            }
        }
        catch (_a) { }
        const doc = await this.model.create({
            url: dest.url,
            path: dest.abs,
            filename: dest.filename,
            mimeType: opts.mime,
            ext,
            size: buf.length,
            productId: opts.productId ? new mongoose_2.Types.ObjectId(opts.productId) : undefined,
            fanpageId: opts.fanpageId ? new mongoose_2.Types.ObjectId(opts.fanpageId) : undefined,
            tags: opts.tags || [],
            alt: opts.alt,
            isMainImage: opts.isMainImage || false,
            sourceType: opts.sourceType || 'gallery',
            width, height, aspectRatio,
        });
        return doc.toObject();
    }
    async importFromUrl(imageUrl, opts) {
        const res = await (0, node_fetch_1.default)(imageUrl);
        if (!res.ok)
            throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        const mime = res.headers.get('content-type') || undefined;
        let ext = '';
        if (mime === null || mime === void 0 ? void 0 : mime.includes('jpeg'))
            ext = 'jpg';
        else if (mime === null || mime === void 0 ? void 0 : mime.includes('png'))
            ext = 'png';
        else if (mime === null || mime === void 0 ? void 0 : mime.includes('webp'))
            ext = 'webp';
        else if (mime === null || mime === void 0 ? void 0 : mime.includes('gif'))
            ext = 'gif';
        return this.saveBuffer(Buffer.from(arrayBuf), Object.assign({ mime, ext }, opts));
    }
    async list(query = {}) {
        const filter = {};
        if (query.productId)
            filter.productId = query.productId;
        if (query.fanpageId)
            filter.fanpageId = query.fanpageId;
        if (query.tag)
            filter.tags = query.tag;
        const page = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, parseInt(query.limit) || 30);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            this.model.countDocuments(filter)
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async remove(id) {
        const doc = await this.model.findById(id);
        if (!doc)
            throw new common_1.NotFoundException('Media not found');
        try {
            if (fs.existsSync(doc.path))
                fs.unlinkSync(doc.path);
        }
        catch (_a) { }
        await doc.deleteOne();
        return { deleted: true };
    }
    async syncFilesWithDatabase() {
        const mediaDir = MEDIA_DIR;
        if (!fs.existsSync(mediaDir)) {
            return { message: 'Thư mục media không tồn tại', filesInDir: 0, filesInDb: 0 };
        }
        const getAllFiles = (dir, basePath = '') => {
            const files = [];
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    files.push(...getAllFiles(fullPath, path.join(basePath, item)));
                }
                else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(item)) {
                    files.push(path.join(basePath, item).replace(/\\/g, '/'));
                }
            }
            return files;
        };
        const filesInDir = getAllFiles(mediaDir);
        const filesInDb = await this.model.find({}).select('url filename');
        const dbUrls = filesInDb.map(f => { var _a; return ((_a = f.url) === null || _a === void 0 ? void 0 : _a.replace(PUBLIC_BASE + '/', '')) || f.filename; });
        const missingInDb = filesInDir.filter(file => !dbUrls.includes(file));
        const missingInDir = dbUrls.filter(url => url && !filesInDir.includes(url));
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
    getMimeType(filename) {
        var _a;
        const ext = (_a = filename.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(media_schema_1.Media.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], MediaService);
//# sourceMappingURL=media.service.js.map