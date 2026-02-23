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
var FileUploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadService = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
const sharp = require("sharp");
let FileUploadService = FileUploadService_1 = class FileUploadService {
    constructor() {
        this.logger = new common_1.Logger(FileUploadService_1.name);
        this.uploadPath = (0, path_1.join)(process.cwd(), 'uploads', 'products');
        this.maxFileSize = 10 * 1024 * 1024;
        this.allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif'
        ];
        this.ensureUploadDirectory();
    }
    async processUploadedFiles(files) {
        const processedFiles = [];
        for (const file of files) {
            try {
                const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
                const fileUrl = `${baseUrl}/uploads/products/${file.filename}`;
                const optimized = await this.createOptimizedVersions(file);
                const uploadedFile = {
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
            }
            catch (error) {
                this.logger.error(`Failed to process file ${file.originalname}:`, error.message);
                try {
                    (0, fs_1.unlinkSync)(file.path);
                }
                catch (unlinkError) {
                    this.logger.error(`Failed to clean up file ${file.path}:`, unlinkError.message);
                }
            }
        }
        return processedFiles;
    }
    async createOptimizedVersions(file) {
        try {
            const baseFilename = file.filename.replace((0, path_1.extname)(file.filename), '');
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const thumbnailFilename = `${baseFilename}_thumb.webp`;
            const thumbnailPath = (0, path_1.join)(this.uploadPath, thumbnailFilename);
            await sharp(file.path)
                .resize(150, 150, { fit: 'cover' })
                .webp({ quality: 80 })
                .toFile(thumbnailPath);
            const mediumFilename = `${baseFilename}_medium.webp`;
            const mediumPath = (0, path_1.join)(this.uploadPath, mediumFilename);
            await sharp(file.path)
                .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 85 })
                .toFile(mediumPath);
            const largeFilename = `${baseFilename}_large.webp`;
            const largePath = (0, path_1.join)(this.uploadPath, largeFilename);
            await sharp(file.path)
                .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 90 })
                .toFile(largePath);
            return {
                thumbnail: `${baseUrl}/uploads/products/${thumbnailFilename}`,
                medium: `${baseUrl}/uploads/products/${mediumFilename}`,
                large: `${baseUrl}/uploads/products/${largeFilename}`
            };
        }
        catch (error) {
            this.logger.error('Failed to create optimized versions:', error.message);
            return undefined;
        }
    }
    async deleteFiles(filenames) {
        for (const filename of filenames) {
            try {
                const originalPath = (0, path_1.join)(this.uploadPath, filename);
                if ((0, fs_1.existsSync)(originalPath)) {
                    (0, fs_1.unlinkSync)(originalPath);
                }
                const baseFilename = filename.replace((0, path_1.extname)(filename), '');
                const optimizedFiles = [
                    `${baseFilename}_thumb.webp`,
                    `${baseFilename}_medium.webp`,
                    `${baseFilename}_large.webp`
                ];
                for (const optimizedFile of optimizedFiles) {
                    const optimizedPath = (0, path_1.join)(this.uploadPath, optimizedFile);
                    if ((0, fs_1.existsSync)(optimizedPath)) {
                        (0, fs_1.unlinkSync)(optimizedPath);
                    }
                }
                this.logger.log(`Deleted file and optimized versions: ${filename}`);
            }
            catch (error) {
                this.logger.error(`Failed to delete file ${filename}:`, error.message);
            }
        }
    }
    getFileInfo(filename) {
        const filePath = (0, path_1.join)(this.uploadPath, filename);
        if (!(0, fs_1.existsSync)(filePath)) {
            return null;
        }
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const baseFilename = filename.replace((0, path_1.extname)(filename), '');
        return {
            originalName: filename,
            filename: filename,
            path: filePath,
            url: `${baseUrl}/uploads/products/${filename}`,
            size: 0,
            mimetype: this.getMimeTypeFromExtension((0, path_1.extname)(filename)),
            optimized: {
                thumbnail: `${baseUrl}/uploads/products/${baseFilename}_thumb.webp`,
                medium: `${baseUrl}/uploads/products/${baseFilename}_medium.webp`,
                large: `${baseUrl}/uploads/products/${baseFilename}_large.webp`
            }
        };
    }
    validateFiles(files) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('Không có file nào được tải lên');
        }
        if (files.length > 10) {
            throw new common_1.BadRequestException('Tối đa 10 file mỗi lần tải lên');
        }
        for (const file of files) {
            if (!this.allowedMimeTypes.includes(file.mimetype)) {
                throw new common_1.BadRequestException(`File ${file.originalname} có định dạng không được hỗ trợ`);
            }
            if (file.size > this.maxFileSize) {
                throw new common_1.BadRequestException(`File ${file.originalname} vượt quá kích thước cho phép (10MB)`);
            }
        }
    }
    async generateFanpageVariants(originalImage, fanpageId, customization) {
        try {
            const baseFilename = originalImage.filename.replace((0, path_1.extname)(originalImage.filename), '');
            const variantFilename = `${baseFilename}_fp_${fanpageId}.webp`;
            const variantPath = (0, path_1.join)(this.uploadPath, variantFilename);
            let sharpInstance = sharp(originalImage.path);
            if ((customization === null || customization === void 0 ? void 0 : customization.brightness) || (customization === null || customization === void 0 ? void 0 : customization.contrast)) {
                sharpInstance = sharpInstance.modulate({
                    brightness: customization.brightness || 1,
                    saturation: 1,
                    lightness: customization.contrast || 1
                });
            }
            await sharpInstance
                .webp({ quality: 90 })
                .toFile(variantPath);
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            return `${baseUrl}/uploads/products/${variantFilename}`;
        }
        catch (error) {
            this.logger.error('Failed to generate fanpage variant:', error.message);
            return originalImage.url;
        }
    }
    ensureUploadDirectory() {
        if (!(0, fs_1.existsSync)(this.uploadPath)) {
            (0, fs_1.mkdirSync)(this.uploadPath, { recursive: true });
            this.logger.log(`Created upload directory: ${this.uploadPath}`);
        }
    }
    getMimeTypeFromExtension(ext) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif'
        };
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }
};
exports.FileUploadService = FileUploadService;
exports.FileUploadService = FileUploadService = FileUploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], FileUploadService);
//# sourceMappingURL=file-upload.service.js.map