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
exports.SyncMediaService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const media_schema_1 = require("./schemas/media.schema");
const fs = require("fs");
const path = require("path");
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
const PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE || '/media';
let SyncMediaService = class SyncMediaService {
    constructor(mediaModel) {
        this.mediaModel = mediaModel;
    }
    async masterSync() {
        const results = {
            phase1: await this.syncFilesToDatabase(),
            phase2: { mediaRecords: 0, validReferences: 0, invalidReferencesRemoved: 0, errors: ['Phase 2 delegated to ProductService via /products/cleanup-images'] },
            phase3: await this.cleanOrphanedFiles(),
            summary: {
                totalFiles: 0,
                totalMediaRecords: 0,
                totalProductReferences: 0,
                syncedSuccessfully: true
            }
        };
        results.summary.totalFiles = results.phase1.filesFound;
        results.summary.totalMediaRecords = results.phase2.mediaRecords || 0;
        results.summary.totalProductReferences = results.phase2.validReferences || 0;
        return results;
    }
    async syncFilesToDatabase() {
        const results = {
            filesFound: 0,
            mediaRecordsCreated: 0,
            mediaRecordsUpdated: 0,
            errors: []
        };
        try {
            const allFiles = this.scanAllFiles(MEDIA_DIR);
            results.filesFound = allFiles.length;
            for (const filePath of allFiles) {
                const relativePath = path.relative(MEDIA_DIR, filePath).replace(/\\/g, '/');
                const url = `${PUBLIC_BASE}/${relativePath}`;
                const existingMedia = await this.mediaModel.findOne({ url });
                if (!existingMedia) {
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
        }
        catch (error) {
            results.errors.push(`Sync files to DB failed: ${error.message}`);
        }
        return results;
    }
    async syncDatabaseToProducts() {
        const results = {
            mediaRecords: 0,
            validReferences: 0,
            invalidReferencesRemoved: 0,
            errors: []
        };
        try {
            const mongoose = require('mongoose');
            const Product = mongoose.model('Product');
            const validMediaUrls = new Set();
            const mediaRecords = await this.mediaModel.find({}).select('url');
            results.mediaRecords = mediaRecords.length;
            mediaRecords.forEach(media => validMediaUrls.add(media.url));
            const products = await Product.find({});
            for (const product of products) {
                let hasChanges = false;
                if (product.images && product.images.length > 0) {
                    const validImages = product.images.filter(imgObj => {
                        if (validMediaUrls.has(imgObj.url)) {
                            results.validReferences++;
                            return true;
                        }
                        else {
                            results.invalidReferencesRemoved++;
                            return false;
                        }
                    });
                    if (validImages.length !== product.images.length) {
                        product.images = validImages;
                        hasChanges = true;
                    }
                }
                if (product.fanpageVariations && product.fanpageVariations.length > 0) {
                    for (const variation of product.fanpageVariations) {
                        if (variation.customImages) {
                            if (typeof variation.customImages === 'string') {
                                if (variation.customImages && !validMediaUrls.has(variation.customImages)) {
                                    variation.customImages = '';
                                    results.invalidReferencesRemoved++;
                                    hasChanges = true;
                                }
                                else if (variation.customImages) {
                                    results.validReferences++;
                                }
                            }
                            else if (Array.isArray(variation.customImages) && variation.customImages.length > 0) {
                                const validCustomImages = variation.customImages.filter(url => {
                                    if (validMediaUrls.has(url)) {
                                        results.validReferences++;
                                        return true;
                                    }
                                    else {
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
        }
        catch (error) {
            results.errors.push(`Sync DB to products failed: ${error.message}`);
        }
        return results;
    }
    async cleanOrphanedFiles() {
        const results = {
            orphanedFilesRemoved: 0,
            orphanedRecordsRemoved: 0,
            errors: []
        };
        try {
            const mediaRecords = await this.mediaModel.find({});
            for (const record of mediaRecords) {
                if (!fs.existsSync(record.path)) {
                    await this.mediaModel.findByIdAndDelete(record._id);
                    results.orphanedRecordsRemoved++;
                }
            }
            const validPaths = new Set();
            const currentMediaRecords = await this.mediaModel.find({}).select('path');
            currentMediaRecords.forEach(record => validPaths.add(record.path));
            const allFiles = this.scanAllFiles(MEDIA_DIR);
            for (const filePath of allFiles) {
                if (!validPaths.has(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                        results.orphanedFilesRemoved++;
                    }
                    catch (error) {
                        results.errors.push(`Failed to delete ${filePath}: ${error.message}`);
                    }
                }
            }
        }
        catch (error) {
            results.errors.push(`Clean orphaned failed: ${error.message}`);
        }
        return results;
    }
    scanAllFiles(dir) {
        const files = [];
        if (!fs.existsSync(dir))
            return files;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                files.push(...this.scanAllFiles(itemPath));
            }
            else if (stat.isFile()) {
                files.push(itemPath);
            }
        }
        return files;
    }
    getMimeType(filePath) {
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
};
exports.SyncMediaService = SyncMediaService;
exports.SyncMediaService = SyncMediaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(media_schema_1.Media.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SyncMediaService);
//# sourceMappingURL=sync-media.service.js.map