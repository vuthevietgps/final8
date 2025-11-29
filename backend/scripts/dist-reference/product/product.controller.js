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
exports.ProductController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const product_service_1 = require("./product.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const vision_ai_service_1 = require("./vision-ai.service");
const file_upload_service_1 = require("./file-upload.service");
let ProductController = class ProductController {
    constructor(productService, visionAIService, fileUploadService) {
        this.productService = productService;
        this.visionAIService = visionAIService;
        this.fileUploadService = fileUploadService;
    }
    create(createProductDto) {
        return this.productService.create(createProductDto);
    }
    findAll(query) {
        return this.productService.findAll(query);
    }
    getStats() {
        return this.productService.getStats();
    }
    getByCategory(categoryId) {
        return this.productService.getByCategory(categoryId);
    }
    seedSampleData() {
        return this.productService.seedSampleData();
    }
    async variationImagesReport(fanpageId, search, page, limit) {
        const data = await this.productService.getVariationImagesReport({ fanpageId, search, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
        return { success: true, data };
    }
    findOne(id) {
        return this.productService.findOne(id);
    }
    async listProductMedia(productId, fanpageId, page, limit) {
        var _a, _b;
        const p = Math.max(1, Number(page) || 1);
        const l = Math.min(100, Number(limit) || 50);
        const data = await ((_b = (_a = this.productService).listProductMedia) === null || _b === void 0 ? void 0 : _b.call(_a, productId, { page: p, limit: l, fanpageId }));
        if (data)
            return { success: true, data };
        const svc = this.productService;
        if (svc.mediaModel) {
            const filter = { productId };
            const skip = (p - 1) * l;
            const [items, total] = await Promise.all([
                svc.mediaModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
                svc.mediaModel.countDocuments(filter),
            ]);
            return { success: true, data: { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) } };
        }
        return { success: true, data: { items: [], total: 0, page: p, limit: l, totalPages: 0 } };
    }
    update(id, updateProductDto) {
        return this.productService.update(id, updateProductDto);
    }
    remove(id) {
        return this.productService.remove(id);
    }
    async updateFanpageVariationImages(productId, fanpageId, images, imagePolicy) {
        if (!fanpageId) {
            throw new common_1.BadRequestException('Thiếu fanpageId');
        }
        if (!Array.isArray(images)) {
            throw new common_1.BadRequestException('images phải là mảng string URL');
        }
        const updated = await this.productService.setFanpageVariationImages(productId, fanpageId, images, imagePolicy);
        return { success: true, data: updated };
    }
    async bestImages(productId, fanpageId, limit) {
        const urls = await this.productService.chooseBestImages({ productId, fanpageId, limit: limit ? Number(limit) : undefined });
        return { success: true, data: urls };
    }
    async uploadProductImages(files, fanpageId, configId) {
        try {
            this.fileUploadService.validateFiles(files);
            const uploadedFiles = await this.fileUploadService.processUploadedFiles(files);
            const analyzedImages = [];
            for (const file of uploadedFiles) {
                const analysis = await this.visionAIService.analyzeProductImage(file.url, configId);
                analyzedImages.push(Object.assign(Object.assign({}, file), { aiAnalysis: analysis }));
            }
            return {
                success: true,
                message: `Đã tải lên và phân tích ${analyzedImages.length} ảnh`,
                data: {
                    images: analyzedImages,
                    totalAnalyzed: analyzedImages.length,
                    totalKeywords: analyzedImages.reduce((sum, img) => { var _a, _b; return sum + (((_b = (_a = img.aiAnalysis) === null || _a === void 0 ? void 0 : _a.keywords) === null || _b === void 0 ? void 0 : _b.length) || 0); }, 0)
                }
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi tải ảnh: ${error.message}`);
        }
    }
    async findSimilarProducts(query, fanpageId, limit = 5) {
        if (!query || !fanpageId) {
            throw new common_1.BadRequestException('Thiếu thông tin query hoặc fanpageId');
        }
        const recommendations = await this.visionAIService.findSimilarProducts(query, fanpageId, limit);
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
    async analyzeImageUrl(imageUrl, configId) {
        if (!imageUrl) {
            throw new common_1.BadRequestException('Thiếu URL ảnh');
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
    async createFanpageVariant(productId, fanpageId, imageIndex = 0, customization) {
        if (!fanpageId) {
            throw new common_1.BadRequestException('Thiếu fanpageId');
        }
        const product = await this.productService.findOne(productId);
        if (!product || !product.images || product.images.length === 0) {
            throw new common_1.BadRequestException('Sản phẩm không có ảnh');
        }
        if (imageIndex >= product.images.length) {
            throw new common_1.BadRequestException('Index ảnh không hợp lệ');
        }
        const originalImage = product.images[imageIndex];
        const uploadedFileFormat = {
            originalName: `product_${productId}_${imageIndex}`,
            filename: originalImage.url.split('/').pop() || 'image',
            path: '',
            url: originalImage.url,
            size: 0,
            mimetype: 'image/jpeg'
        };
        const variantUrl = await this.fileUploadService.generateFanpageVariants(uploadedFileFormat, fanpageId, customization);
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
    async getAIStats(fanpageId) {
        const stats = await this.productService.getAIAnalysisStats(fanpageId);
        return {
            success: true,
            data: stats
        };
    }
    async cleanupProductImages() {
        const results = await this.productService.cleanupAndValidateImages();
        return {
            success: true,
            message: 'Đã thực hiện làm sạch và đồng bộ hóa ảnh sản phẩm',
            data: results
        };
    }
    async resetFanpageImages(fanpageId, removeInvalidOnly) {
        const results = await this.productService.resetFanpageImages(fanpageId, removeInvalidOnly);
        return {
            success: true,
            message: 'Đã reset ảnh fanpage thành công',
            data: results
        };
    }
    async validateImagesReport(fanpageId) {
        const report = await this.productService.generateImageValidationReport(fanpageId);
        return {
            success: true,
            data: report
        };
    }
};
exports.ProductController = ProductController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('category/:categoryId'),
    __param(0, (0, common_1.Param)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "getByCategory", null);
__decorate([
    (0, common_1.Post)('seed'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "seedSampleData", null);
__decorate([
    (0, common_1.Get)('variation-images-report'),
    __param(0, (0, common_1.Query)('fanpageId')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "variationImagesReport", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/media'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('fanpageId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "listProductMedia", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)(':id/fanpage-variation-images'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('fanpageId')),
    __param(2, (0, common_1.Body)('images')),
    __param(3, (0, common_1.Body)('imagePolicy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Array, Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "updateFanpageVariationImages", null);
__decorate([
    (0, common_1.Get)(':id/best-images'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('fanpageId')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "bestImages", null);
__decorate([
    (0, common_1.Post)('upload-images'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('images', 10, {})),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('fanpageId')),
    __param(2, (0, common_1.Body)('configId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "uploadProductImages", null);
__decorate([
    (0, common_1.Post)('find-similar'),
    __param(0, (0, common_1.Body)('query')),
    __param(1, (0, common_1.Body)('fanpageId')),
    __param(2, (0, common_1.Body)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "findSimilarProducts", null);
__decorate([
    (0, common_1.Post)('analyze-image'),
    __param(0, (0, common_1.Body)('imageUrl')),
    __param(1, (0, common_1.Body)('configId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "analyzeImageUrl", null);
__decorate([
    (0, common_1.Post)(':id/create-fanpage-variant'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('fanpageId')),
    __param(2, (0, common_1.Body)('imageIndex')),
    __param(3, (0, common_1.Body)('customization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number, Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "createFanpageVariant", null);
__decorate([
    (0, common_1.Get)('ai-stats'),
    __param(0, (0, common_1.Query)('fanpageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "getAIStats", null);
__decorate([
    (0, common_1.Post)('cleanup-images'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "cleanupProductImages", null);
__decorate([
    (0, common_1.Post)('reset-fanpage-images'),
    __param(0, (0, common_1.Body)('fanpageId')),
    __param(1, (0, common_1.Body)('removeInvalidOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "resetFanpageImages", null);
__decorate([
    (0, common_1.Get)('validate-images-report'),
    __param(0, (0, common_1.Query)('fanpageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "validateImagesReport", null);
exports.ProductController = ProductController = __decorate([
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [product_service_1.ProductService,
        vision_ai_service_1.VisionAIService,
        file_upload_service_1.FileUploadService])
], ProductController);
//# sourceMappingURL=product.controller.js.map