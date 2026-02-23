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
var MediaController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const media_schema_1 = require("./schemas/media.schema");
const media_service_1 = require("./media.service");
const sync_media_service_1 = require("./sync-media.service");
const product_service_1 = require("../product/product.service");
const fs = require("fs");
const path = require("path");
const auth_guard_1 = require("../auth/guards/auth.guard");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let MediaController = MediaController_1 = class MediaController {
    constructor(mediaService, syncMediaService, productService, model) {
        this.mediaService = mediaService;
        this.syncMediaService = syncMediaService;
        this.productService = productService;
        this.model = model;
        this.logger = new common_1.Logger(MediaController_1.name);
    }
    async list(q) {
        return this.mediaService.list(q);
    }
    async masterSync() {
        const result = await this.syncMediaService.masterSync();
        return {
            success: true,
            message: 'Đồng bộ hoàn chỉnh 3 lớp dữ liệu thành công',
            data: result
        };
    }
    async autoSync() {
        const cleanupResult = await this.productService.cleanupAndValidateImages();
        return {
            success: true,
            message: 'Đã làm sạch tự động các tham chiếu ảnh không hợp lệ',
            data: cleanupResult
        };
    }
    async bulkDelete(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return { success: false, message: 'Danh sách ids rỗng', data: { deleted: 0, failed: 0, errors: ['No ids provided'] } };
        }
        const results = { deleted: 0, failed: 0, errors: [] };
        for (const id of ids) {
            try {
                await this.mediaService.deleteById(id);
                results.deleted++;
            }
            catch (e) {
                results.failed++;
                results.errors.push(`Failed ${id}: ${(e === null || e === void 0 ? void 0 : e.message) || 'unknown error'}`);
            }
        }
        try {
            await this.productService.cleanupAndValidateImages();
        }
        catch (e) {
            results.errors.push('Cleanup error: ' + ((e === null || e === void 0 ? void 0 : e.message) || e));
        }
        return { success: true, message: 'Đã xóa hàng loạt media', data: results };
    }
    async upload(file, productId, fanpageId, alt, tags, isMainImage, sourceType) {
        if (!alt || !alt.trim()) {
            return { success: false, message: 'Thiếu mô tả (alt). Vui lòng nhập mô tả ảnh trước khi tải lên.' };
        }
        const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const buf = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
        if (!buf)
            throw new Error('File buffer not available');
        return this.mediaService.saveBuffer(buf, {
            mime: file.mimetype,
            ext: (file.originalname.split('.').pop() || '').toLowerCase(),
            productId,
            fanpageId,
            alt,
            tags: tagList,
            isMainImage: isMainImage === 'true',
            sourceType
        });
    }
    async deleteMedia(id) {
        const result = await this.mediaService.deleteById(id);
        try {
            await this.productService.cleanupAndValidateImages();
        }
        catch (error) {
            console.warn('Auto-cleanup product references failed:', error.message);
        }
        return result;
    }
    async cleanupOrphanedMedia() {
        return this.mediaService.cleanupOrphanedFiles();
    }
    async validateProductImages() {
        return this.productService.cleanupAndValidateImages();
    }
    async importByUrl(url, productId, fanpageId, alt, tags, isMainImage, sourceType) {
        if (!alt || !alt.trim()) {
            return { success: false, message: 'Thiếu mô tả (alt). Vui lòng nhập mô tả ảnh trước khi import.' };
        }
        const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        return this.mediaService.importFromUrl(url, { productId, fanpageId, alt, tags: tagList, isMainImage, sourceType });
    }
    async serveFile(wildcard, res) {
        try {
            if (!wildcard) {
                return res.status(400).json({ error: 'File path is required' });
            }
            const filePath = decodeURIComponent(wildcard).replace(/^\/+/, '');
            const mediaDir = (() => {
                const envDir = process.env.MEDIA_DIR;
                const candidates = [
                    envDir,
                    path.join(process.cwd(), '..', 'media'),
                    path.join(process.cwd(), '..', 'uploads', 'media'),
                    path.join(process.cwd(), 'uploads', 'media'),
                ].filter(Boolean);
                for (const d of candidates) {
                    try {
                        if (fs.existsSync(d))
                            return d;
                    }
                    catch (_a) { }
                }
                const fallback = path.join(process.cwd(), 'uploads', 'media');
                try {
                    fs.mkdirSync(fallback, { recursive: true });
                }
                catch (_b) { }
                return fallback;
            })();
            const fullPath = path.join(mediaDir, filePath);
            this.logger.debug(`[MEDIA] request "+${filePath}+" → base="${mediaDir}" → full="${fullPath}"`);
            const resolvedPath = path.resolve(fullPath);
            const resolvedMediaDir = path.resolve(mediaDir);
            if (!resolvedPath.startsWith(resolvedMediaDir)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (!fs.existsSync(fullPath)) {
                try {
                    const base = process.env.MEDIA_PUBLIC_BASE || '/media';
                    const url = `${base}/${filePath}`.replace(/\\/g, '/').replace(/\/+/, '/');
                    const rec = await this.model.findOne({ url }).lean();
                    if ((rec === null || rec === void 0 ? void 0 : rec.path) && fs.existsSync(rec.path)) {
                        this.logger.debug(`[MEDIA] fallback DB path: ${rec.path}`);
                        return res.sendFile(rec.path);
                    }
                }
                catch (e) {
                    this.logger.warn(`[MEDIA] DB fallback failed: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
                }
                this.logger.warn(`[MEDIA] 404 not found (fs): ${fullPath}`);
                return res.status(404).json({ error: 'File not found' });
            }
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
            return res.sendFile(fullPath);
        }
        catch (error) {
            this.logger.error(`[MEDIA] serve error: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    async serveYMF(year, month, filename, res) {
        const pathParam = `${year}/${month}/${filename}`;
        return this.serveFile(pathParam, res);
    }
    async legacyServe(wildcard, res) {
        return this.serveFile(wildcard, res);
    }
};
exports.MediaController = MediaController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('master-sync'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "masterSync", null);
__decorate([
    (0, common_1.Post)('auto-sync'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "autoSync", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __param(0, (0, common_1.Body)('ids')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('productId')),
    __param(2, (0, common_1.Body)('fanpageId')),
    __param(3, (0, common_1.Body)('alt')),
    __param(4, (0, common_1.Body)('tags')),
    __param(5, (0, common_1.Body)('isMainImage')),
    __param(6, (0, common_1.Body)('sourceType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "upload", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "deleteMedia", null);
__decorate([
    (0, common_1.Post)('cleanup-orphaned'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "cleanupOrphanedMedia", null);
__decorate([
    (0, common_1.Post)('validate-product-images'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "validateProductImages", null);
__decorate([
    (0, common_1.Post)('import-by-url'),
    (0, auth_decorator_1.RequirePermissions)('media'),
    __param(0, (0, common_1.Body)('url')),
    __param(1, (0, common_1.Body)('productId')),
    __param(2, (0, common_1.Body)('fanpageId')),
    __param(3, (0, common_1.Body)('alt')),
    __param(4, (0, common_1.Body)('tags')),
    __param(5, (0, common_1.Body)('isMainImage')),
    __param(6, (0, common_1.Body)('sourceType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Boolean, String]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "importByUrl", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('serve/*path'),
    __param(0, (0, common_1.Param)('path')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "serveFile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':year/:month/:filename'),
    __param(0, (0, common_1.Param)('year')),
    __param(1, (0, common_1.Param)('month')),
    __param(2, (0, common_1.Param)('filename')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "serveYMF", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('*path'),
    __param(0, (0, common_1.Param)('path')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MediaController.prototype, "legacyServe", null);
exports.MediaController = MediaController = MediaController_1 = __decorate([
    (0, common_1.Controller)('media'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => product_service_1.ProductService))),
    __param(3, (0, mongoose_1.InjectModel)(media_schema_1.Media.name)),
    __metadata("design:paramtypes", [media_service_1.MediaService,
        sync_media_service_1.SyncMediaService,
        product_service_1.ProductService,
        mongoose_2.Model])
], MediaController);
//# sourceMappingURL=media.controller.js.map