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
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_schema_1 = require("./schemas/product.schema");
const media_schema_1 = require("../media/schemas/media.schema");
const fs = require("fs");
const path = require("path");
let ProductService = class ProductService {
    constructor(productModel, mediaModel) {
        this.productModel = productModel;
        this.mediaModel = mediaModel;
    }
    async create(createProductDto) {
        if (!createProductDto.estimatedDeliveryDays) {
            createProductDto.estimatedDeliveryDays = 0;
        }
        if (!createProductDto.status) {
            createProductDto.status = 'Hoạt động';
        }
        const createdProduct = new this.productModel(createProductDto);
        return createdProduct.save();
    }
    async findAll(query) {
        const filter = {};
        if (query === null || query === void 0 ? void 0 : query.categoryId) {
            filter['categoryId'] = new mongoose_2.Types.ObjectId(query.categoryId);
        }
        if (query === null || query === void 0 ? void 0 : query.status) {
            filter['status'] = query.status;
        }
        if (query === null || query === void 0 ? void 0 : query.search) {
            filter['name'] = { $regex: query.search, $options: 'i' };
        }
        return this.productModel
            .find(filter)
            .populate('categoryId', 'name code icon color')
            .sort({ createdAt: -1 })
            .exec();
    }
    async findOne(id) {
        const product = await this.productModel
            .findById(id)
            .populate('categoryId', 'name code icon color')
            .exec();
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return product;
    }
    async update(id, updateProductDto) {
        const updatedProduct = await this.productModel
            .findByIdAndUpdate(id, updateProductDto, { new: true })
            .populate('categoryId', 'name code icon color')
            .exec();
        if (!updatedProduct) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return updatedProduct;
    }
    async remove(id) {
        const result = await this.productModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
    }
    async setFanpageVariationImages(productId, fanpageId, images, imagePolicy) {
        const product = await this.productModel.findById(productId).exec();
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${productId} not found`);
        }
        const fpId = new mongoose_2.Types.ObjectId(fanpageId);
        const variations = product.fanpageVariations || [];
        const idx = variations.findIndex((v) => { var _a; return ((_a = v.fanpageId) === null || _a === void 0 ? void 0 : _a.toString()) === fpId.toString(); });
        if (idx === -1) {
            variations.push(Object.assign({ fanpageId: fpId, customImages: images, isActive: true, priority: 0 }, (imagePolicy ? { imagePolicy } : {})));
        }
        else {
            variations[idx] = Object.assign(Object.assign(Object.assign({}, variations[idx]), { customImages: images }), (imagePolicy ? { imagePolicy } : {}));
        }
        await this.productModel.updateOne({ _id: productId }, { fanpageVariations: variations });
        return this.findOne(productId);
    }
    async getByCategory(categoryId) {
        return this.productModel
            .find({ categoryId: new mongoose_2.Types.ObjectId(categoryId) })
            .populate('categoryId', 'name code icon color')
            .sort({ createdAt: -1 })
            .exec();
    }
    async getStats() {
        const total = await this.productModel.countDocuments();
        const active = await this.productModel.countDocuments({ status: 'Hoạt động' });
        const inactive = await this.productModel.countDocuments({ status: 'Tạm dừng' });
        const avgCosts = await this.productModel.aggregate([
            {
                $group: {
                    _id: null,
                    avgImportPrice: { $avg: '$importPrice' },
                    avgShippingCost: { $avg: '$shippingCost' },
                    avgPackagingCost: { $avg: '$packagingCost' },
                    avgTotalCost: { $avg: '$totalCost' },
                    avgDeliveryDays: { $avg: '$estimatedDeliveryDays' }
                }
            }
        ]);
        const averages = avgCosts[0] || {
            avgImportPrice: 0,
            avgShippingCost: 0,
            avgPackagingCost: 0,
            avgTotalCost: 0,
            avgDeliveryDays: 0
        };
        return {
            total,
            active,
            inactive,
            averageImportPrice: Math.round(averages.avgImportPrice || 0),
            averageShippingCost: Math.round(averages.avgShippingCost || 0),
            averagePackagingCost: Math.round(averages.avgPackagingCost || 0),
            averageTotalCost: Math.round(averages.avgTotalCost || 0),
            averageDeliveryDays: Math.round(averages.avgDeliveryDays || 0)
        };
    }
    async seedSampleData() {
        var _a, _b, _c;
        const categoryModel = this.productModel.db.model('ProductCategory');
        const categories = await categoryModel.find().limit(3);
        if (categories.length === 0) {
            throw new Error('No product categories found. Please create categories first.');
        }
        await this.productModel.deleteMany({});
        const sampleData = [
            {
                name: 'iPhone 15 Pro Max',
                categoryId: categories[0]._id,
                importPrice: 25000000,
                shippingCost: 500000,
                packagingCost: 200000,
                estimatedDeliveryDays: 7,
                status: 'Hoạt động',
                notes: 'Flagship iPhone model với chip A17 Pro'
            },
            {
                name: 'Samsung Galaxy S24 Ultra',
                categoryId: categories[0]._id,
                importPrice: 22000000,
                shippingCost: 450000,
                packagingCost: 180000,
                estimatedDeliveryDays: 5,
                status: 'Hoạt động',
                notes: 'Smartphone cao cấp với S Pen'
            },
            {
                name: 'Áo thun nam cotton',
                categoryId: ((_a = categories[1]) === null || _a === void 0 ? void 0 : _a._id) || categories[0]._id,
                importPrice: 150000,
                shippingCost: 25000,
                packagingCost: 15000,
                estimatedDeliveryDays: 3,
                status: 'Hoạt động',
                notes: 'Chất liệu cotton 100% từ Việt Nam'
            },
            {
                name: 'Quần jeans nam',
                categoryId: ((_b = categories[1]) === null || _b === void 0 ? void 0 : _b._id) || categories[0]._id,
                importPrice: 300000,
                shippingCost: 35000,
                packagingCost: 20000,
                estimatedDeliveryDays: 4,
                status: 'Hoạt động',
                notes: 'Denim cao cấp, form slim fit'
            },
            {
                name: 'Nồi cơm điện Panasonic',
                categoryId: ((_c = categories[2]) === null || _c === void 0 ? void 0 : _c._id) || categories[0]._id,
                importPrice: 1200000,
                shippingCost: 100000,
                packagingCost: 50000,
                estimatedDeliveryDays: 2,
                status: 'Tạm dừng',
                notes: 'Tạm hết hàng, chờ nhập thêm'
            }
        ];
        const createdProducts = [];
        for (const data of sampleData) {
            const product = new this.productModel(data);
            createdProducts.push(await product.save());
        }
        return createdProducts;
    }
    async getAIAnalysisStats(fanpageId) {
        const matchStage = {};
        if (fanpageId) {
            matchStage['fanpageVariations.fanpageId'] = new mongoose_2.Types.ObjectId(fanpageId);
        }
        const stats = await this.productModel.aggregate([
            { $match: matchStage },
            {
                $addFields: {
                    hasAIAnalysis: {
                        $gt: [
                            { $size: { $ifNull: ["$images", []] } },
                            0
                        ]
                    },
                    totalKeywords: {
                        $size: {
                            $reduce: {
                                input: "$images",
                                initialValue: [],
                                in: {
                                    $concatArrays: [
                                        "$$value",
                                        { $ifNull: ["$$this.aiAnalysis.keywords", []] }
                                    ]
                                }
                            }
                        }
                    },
                    avgConfidence: {
                        $avg: {
                            $map: {
                                input: "$images",
                                as: "img",
                                in: { $ifNull: ["$$img.aiAnalysis.confidence", 0] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    productsWithAI: {
                        $sum: { $cond: ["$hasAIAnalysis", 1, 0] }
                    },
                    totalImages: {
                        $sum: { $size: { $ifNull: ["$images", []] } }
                    },
                    totalKeywords: { $sum: "$totalKeywords" },
                    avgConfidence: { $avg: "$avgConfidence" },
                    topKeywords: {
                        $push: {
                            $reduce: {
                                input: "$images",
                                initialValue: [],
                                in: {
                                    $concatArrays: [
                                        "$$value",
                                        { $ifNull: ["$$this.aiAnalysis.keywords", []] }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        ]);
        const result = stats[0] || {
            totalProducts: 0,
            productsWithAI: 0,
            totalImages: 0,
            totalKeywords: 0,
            avgConfidence: 0,
            topKeywords: []
        };
        const keywordFreq = {};
        result.topKeywords.flat().forEach(keyword => {
            keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
        });
        const topKeywords = Object.entries(keywordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([keyword, count]) => ({ keyword, count }));
        return {
            totalProducts: result.totalProducts,
            productsWithAI: result.productsWithAI,
            aiCoveragePercentage: result.totalProducts > 0
                ? Math.round((result.productsWithAI / result.totalProducts) * 100)
                : 0,
            totalImages: result.totalImages,
            totalKeywords: result.totalKeywords,
            avgConfidence: Math.round((result.avgConfidence || 0) * 100) / 100,
            topKeywords,
            fanpageId
        };
    }
    async updateWithAIAnalysis(productId, imageIndex, analysis) {
        const product = await this.findOne(productId);
        if (!product.images || !product.images[imageIndex]) {
            throw new common_1.NotFoundException('Ảnh không tồn tại');
        }
        product.images[imageIndex].aiAnalysis = analysis;
        const allKeywords = new Set();
        product.images.forEach(img => {
            var _a;
            if ((_a = img.aiAnalysis) === null || _a === void 0 ? void 0 : _a.keywords) {
                img.aiAnalysis.keywords.forEach(keyword => allKeywords.add(keyword));
            }
        });
        if (analysis.description && analysis.description !== 'Không thể tạo mô tả') {
            product.aiDescription = analysis.description;
        }
        product.searchKeywords = Array.from(allKeywords);
        await this.productModel.updateOne({ _id: productId }, {
            images: product.images,
            aiDescription: product.aiDescription,
            searchKeywords: product.searchKeywords
        });
        return this.findOne(productId);
    }
    async listProductMedia(productId, opts = {}) {
        const page = Math.max(1, Number(opts.page) || 1);
        const limit = Math.min(100, Number(opts.limit) || 50);
        const skip = (page - 1) * limit;
        const filter = { productId: new mongoose_2.Types.ObjectId(productId) };
        if (opts.fanpageId)
            filter.fanpageId = new mongoose_2.Types.ObjectId(opts.fanpageId);
        const [items, total] = await Promise.all([
            this.mediaModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            this.mediaModel.countDocuments(filter)
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async chooseBestImages(params) {
        var _a;
        const { productId } = params;
        const limit = Math.min(10, Math.max(1, params.limit || 4));
        const product = await this.productModel.findById(productId).lean();
        if (!product)
            return [];
        let custom;
        let policy;
        if (params.fanpageId) {
            const fpId = new mongoose_2.Types.ObjectId(params.fanpageId);
            const v = (_a = product.fanpageVariations) === null || _a === void 0 ? void 0 : _a.find((x) => { var _a; return ((_a = x.fanpageId) === null || _a === void 0 ? void 0 : _a.toString()) === fpId.toString() && x.isActive !== false; });
            if (v) {
                custom = v.customImages && v.customImages.length ? v.customImages : undefined;
                policy = v.imagePolicy;
            }
        }
        if (custom && custom.length)
            return custom.slice(0, limit);
        const medias = await this.mediaModel.find({ productId: product._id }).lean();
        if (!medias || !medias.length) {
            const imgs = (product.images || []).map((i) => i.url).filter(Boolean);
            return imgs.slice(0, limit);
        }
        const desiredAspect = (policy === null || policy === void 0 ? void 0 : policy.aspectRatio) && policy.aspectRatio !== 'any' ? policy.aspectRatio : undefined;
        const priorityTags = (policy === null || policy === void 0 ? void 0 : policy.priorityTags) || [];
        const forbiddenTags = (policy === null || policy === void 0 ? void 0 : policy.forbiddenTags) || [];
        const scoreOf = (m) => {
            let s = 0;
            if (m.isMainImage)
                s += 5;
            if (desiredAspect && m.aspectRatio === desiredAspect)
                s += 3;
            const tags = m.tags || [];
            for (const t of priorityTags)
                if (tags.includes(t))
                    s += 2;
            for (const t of forbiddenTags)
                if (tags.includes(t))
                    s -= 100;
            const st = m.sourceType || 'gallery';
            if (st === 'gallery')
                s += 1;
            else if (st === 'feedback')
                s += 0.5;
            const pixels = (m.width || 0) * (m.height || 0);
            s += Math.min(3, Math.floor(pixels / (800 * 800)));
            return s;
        };
        const ranked = medias
            .filter(m => !(m.tags || []).some((t) => forbiddenTags.includes(t)))
            .map(m => ({ url: m.url, score: scoreOf(m) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(x => x.url);
        if (ranked.length)
            return ranked;
        const imgs = (product.images || []).map((i) => i.url).filter(Boolean);
        return imgs.slice(0, limit);
    }
    async chooseBestImagesWithAlts(params) {
        var _a;
        const { productId } = params;
        const limit = Math.min(10, Math.max(1, params.limit || 4));
        const product = await this.productModel.findById(productId).lean();
        if (!product)
            return [];
        let custom;
        let policy;
        if (params.fanpageId) {
            const fpId = new mongoose_2.Types.ObjectId(params.fanpageId);
            const v = (_a = product.fanpageVariations) === null || _a === void 0 ? void 0 : _a.find((x) => { var _a; return ((_a = x.fanpageId) === null || _a === void 0 ? void 0 : _a.toString()) === fpId.toString() && x.isActive !== false; });
            if (v) {
                custom = v.customImages && v.customImages.length ? v.customImages : undefined;
                policy = v.imagePolicy;
            }
        }
        if (custom && custom.length) {
            const list = custom.slice(0, limit);
            const mediaDocs = await this.mediaModel.find({ url: { $in: list } }).select('url alt').lean();
            const altMap = new Map(mediaDocs.map((m) => [m.url, m.alt]));
            return list.map((url) => ({ url, alt: altMap.get(url) }));
        }
        const medias = await this.mediaModel.find({ productId: product._id }).lean();
        if (!medias || !medias.length) {
            const imgs = (product.images || []).map((i) => i.url).filter(Boolean).slice(0, limit);
            return imgs.map((url) => ({ url }));
        }
        const desiredAspect = (policy === null || policy === void 0 ? void 0 : policy.aspectRatio) && policy.aspectRatio !== 'any' ? policy.aspectRatio : undefined;
        const priorityTags = (policy === null || policy === void 0 ? void 0 : policy.priorityTags) || [];
        const forbiddenTags = (policy === null || policy === void 0 ? void 0 : policy.forbiddenTags) || [];
        const scoreOf = (m) => {
            let s = 0;
            if (m.isMainImage)
                s += 5;
            if (desiredAspect && m.aspectRatio === desiredAspect)
                s += 3;
            const tags = m.tags || [];
            for (const t of priorityTags)
                if (tags.includes(t))
                    s += 2;
            for (const t of forbiddenTags)
                if (tags.includes(t))
                    s -= 100;
            const st = m.sourceType || 'gallery';
            if (st === 'gallery')
                s += 1;
            else if (st === 'feedback')
                s += 0.5;
            const pixels = (m.width || 0) * (m.height || 0);
            s += Math.min(3, Math.floor(pixels / (800 * 800)));
            return s;
        };
        const ranked = medias
            .filter(m => !(m.tags || []).some((t) => forbiddenTags.includes(t)))
            .map(m => ({ url: m.url, alt: m.alt, score: scoreOf(m) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(x => ({ url: x.url, alt: x.alt }));
        return ranked;
    }
    async getVariationImagesReport(params) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Number(params.limit) || 20);
        const skip = (page - 1) * limit;
        const matchStage = {};
        if (params.search) {
            matchStage.name = { $regex: params.search, $options: 'i' };
        }
        const fanpageMatch = {};
        if (params.fanpageId) {
            fanpageMatch['fanpageVariations.fanpageId'] = new mongoose_2.Types.ObjectId(params.fanpageId);
        }
        const pipeline = [
            { $match: matchStage },
            { $unwind: { path: '$fanpageVariations', preserveNullAndEmptyArrays: false } },
            { $match: fanpageMatch },
            {
                $addFields: {
                    customImagesCount: { $size: { $ifNull: ['$fanpageVariations.customImages', []] } }
                }
            },
            { $match: { customImagesCount: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'fanpages',
                    localField: 'fanpageVariations.fanpageId',
                    foreignField: '_id',
                    as: 'fanpage'
                }
            },
            { $unwind: { path: '$fanpage', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    fanpageId: '$fanpageVariations.fanpageId',
                    fanpageName: '$fanpage.name',
                    customImages: '$fanpageVariations.customImages',
                    customImagesCount: 1,
                }
            },
            { $sort: { name: 1 } },
            {
                $facet: {
                    items: [{ $skip: skip }, { $limit: limit }],
                    totalCount: [{ $count: 'count' }]
                }
            },
            {
                $project: {
                    items: 1,
                    total: { $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0] },
                    page: { $literal: page },
                    limit: { $literal: limit },
                    totalPages: { $cond: [{ $gt: [{ $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0] }, 0] }, { $ceil: { $divide: [{ $arrayElemAt: ['$totalCount.count', 0] }, limit] } }, 0] }
                }
            }
        ];
        const res = await this.productModel.aggregate(pipeline).exec();
        return res[0] || { items: [], total: 0, page, limit, totalPages: 0 };
    }
    async cleanupAndValidateImages() {
        const results = {
            totalProducts: 0,
            mainImagesChecked: 0,
            fanpageVariationsChecked: 0,
            invalidImagesRemoved: 0,
            productsUpdated: 0,
            orphanedFilesFound: 0,
            errors: []
        };
        try {
            const products = await this.productModel.find({}).exec();
            results.totalProducts = products.length;
            for (const product of products) {
                let hasChanges = false;
                if (product.images && product.images.length > 0) {
                    results.mainImagesChecked += product.images.length;
                    const validImages = [];
                    for (const imageObj of product.images) {
                        if (this.isValidImageUrl(imageObj.url)) {
                            validImages.push(imageObj);
                        }
                        else {
                            results.invalidImagesRemoved++;
                            hasChanges = true;
                        }
                    }
                    if (validImages.length !== product.images.length) {
                        product.images = validImages;
                    }
                }
                if (product.fanpageVariations && product.fanpageVariations.length > 0) {
                    for (const variation of product.fanpageVariations) {
                        const imgs = variation.customImages;
                        if (!imgs)
                            continue;
                        if (typeof imgs === 'string') {
                            results.fanpageVariationsChecked += 1;
                            if (!this.isValidImageUrl(imgs)) {
                                variation.customImages = [];
                                results.invalidImagesRemoved++;
                                hasChanges = true;
                            }
                            continue;
                        }
                        if (Array.isArray(imgs) && imgs.length > 0) {
                            results.fanpageVariationsChecked += imgs.length;
                            const validCustomImages = [];
                            for (const imageUrl of imgs) {
                                if (this.isValidImageUrl(imageUrl)) {
                                    validCustomImages.push(imageUrl);
                                }
                                else {
                                    results.invalidImagesRemoved++;
                                    hasChanges = true;
                                }
                            }
                            if (validCustomImages.length !== imgs.length) {
                                variation.customImages = validCustomImages;
                            }
                        }
                    }
                }
                if (hasChanges) {
                    await product.save();
                    results.productsUpdated++;
                }
            }
        }
        catch (error) {
            results.errors.push(`Cleanup failed: ${error.message}`);
        }
        return results;
    }
    async resetFanpageImages(fanpageId, removeInvalidOnly = true) {
        const results = {
            affectedProducts: 0,
            totalImagesRemoved: 0,
            variationsUpdated: 0,
            errors: []
        };
        try {
            const query = {};
            if (fanpageId) {
                query['fanpageVariations.fanpageId'] = new mongoose_2.Types.ObjectId(fanpageId);
            }
            const products = await this.productModel.find(query).exec();
            results.affectedProducts = products.length;
            for (const product of products) {
                let hasChanges = false;
                if (product.fanpageVariations && product.fanpageVariations.length > 0) {
                    for (const variation of product.fanpageVariations) {
                        if (fanpageId && variation.fanpageId.toString() !== fanpageId) {
                            continue;
                        }
                        if (variation.customImages && variation.customImages.length > 0) {
                            const originalCount = variation.customImages.length;
                            if (removeInvalidOnly) {
                                const validImages = [];
                                for (const imageUrl of variation.customImages) {
                                    if (this.isValidImageUrl(imageUrl)) {
                                        validImages.push(imageUrl);
                                    }
                                }
                                variation.customImages = validImages;
                            }
                            else {
                                variation.customImages = [];
                            }
                            const removedCount = originalCount - variation.customImages.length;
                            if (removedCount > 0) {
                                results.totalImagesRemoved += removedCount;
                                results.variationsUpdated++;
                                hasChanges = true;
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
            results.errors.push(`Reset failed: ${error.message}`);
        }
        return results;
    }
    async generateImageValidationReport(fanpageId) {
        const report = {
            totalProducts: 0,
            productsWithImages: 0,
            productsWithFanpageImages: 0,
            validMainImages: 0,
            invalidMainImages: 0,
            validFanpageImages: 0,
            invalidFanpageImages: 0,
            fanpageBreakdown: {},
            invalidImagesList: []
        };
        try {
            const products = await this.productModel.find({}).limit(100).exec();
            report.totalProducts = products.length;
            for (const product of products) {
                let hasMainImages = false;
                let hasFanpageImages = false;
                if (product.images && product.images.length > 0) {
                    hasMainImages = true;
                    for (const imageObj of product.images) {
                        const isValid = this.isValidImageUrl(imageObj.url);
                        if (isValid) {
                            report.validMainImages++;
                        }
                        else {
                            report.invalidMainImages++;
                            report.invalidImagesList.push({
                                productId: product._id.toString(),
                                productName: product.name,
                                imageUrl: imageObj.url,
                                imageType: 'main'
                            });
                        }
                    }
                }
                if (product.fanpageVariations && product.fanpageVariations.length > 0) {
                    for (const variation of product.fanpageVariations) {
                        if (fanpageId && variation.fanpageId.toString() !== fanpageId) {
                            continue;
                        }
                        if (variation.customImages && variation.customImages.length > 0) {
                            hasFanpageImages = true;
                            const fanpageName = variation.fanpageId.toString();
                            if (!report.fanpageBreakdown[fanpageName]) {
                                report.fanpageBreakdown[fanpageName] = { valid: 0, invalid: 0, total: 0 };
                            }
                            for (const imageUrl of variation.customImages) {
                                report.fanpageBreakdown[fanpageName].total++;
                                const isValid = this.isValidImageUrl(imageUrl);
                                if (isValid) {
                                    report.validFanpageImages++;
                                    report.fanpageBreakdown[fanpageName].valid++;
                                }
                                else {
                                    report.invalidFanpageImages++;
                                    report.fanpageBreakdown[fanpageName].invalid++;
                                    report.invalidImagesList.push({
                                        productId: product._id.toString(),
                                        productName: product.name,
                                        imageUrl: imageUrl,
                                        imageType: 'fanpage'
                                    });
                                }
                            }
                        }
                    }
                }
                if (hasMainImages)
                    report.productsWithImages++;
                if (hasFanpageImages)
                    report.productsWithFanpageImages++;
            }
        }
        catch (error) {
            console.error('Image validation report failed:', error);
            throw error;
        }
        return report;
    }
    isValidImageUrl(imageUrl) {
        if (!imageUrl)
            return false;
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return !imageUrl.includes('/media/');
        }
        if (imageUrl.startsWith('/media/')) {
            try {
                const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
                const filePath = path.join(MEDIA_DIR, imageUrl.replace('/media/', ''));
                return fs.existsSync(filePath);
            }
            catch (error) {
                return false;
            }
        }
        return true;
    }
};
exports.ProductService = ProductService;
exports.ProductService = ProductService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(1, (0, mongoose_1.InjectModel)(media_schema_1.Media.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ProductService);
//# sourceMappingURL=product.service.js.map