/**
 * File: product.service.ts
 * Mục đích: Nghiệp vụ Sản phẩm và thao tác dữ liệu MongoDB.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Media.name)
    private mediaModel: Model<MediaDocument>
  ) {}

  private normalizeObjectId(value: unknown): Types.ObjectId | undefined {
    if (value instanceof Types.ObjectId) {
      return value;
    }

    const raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw || !Types.ObjectId.isValid(raw)) {
      return undefined;
    }

    return new Types.ObjectId(raw);
  }

  private buildCategoryFilter(categoryId: unknown) {
    const categoryObjectId = this.normalizeObjectId(categoryId);
    const categoryString = categoryObjectId?.toString() ?? String(categoryId ?? '').trim();

    if (!categoryString) {
      return undefined;
    }

    if (!categoryObjectId) {
      return categoryString;
    }

    // Legacy writes may have stored categoryId as string; keep reads compatible.
    return { $in: [categoryObjectId, categoryString] };
  }

  private normalizeAssumedReturnRatePercent(value: unknown, fallback: number = 20): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.min(95, Math.max(0, num));
  }

  private normalizeStatus(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;

    const normalized = String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return undefined;
    if (normalized === 'hoat dong') return 'Hoạt động';
    if (normalized === 'tam dung') return 'Tạm dừng';
    if (normalized === 'ngung ban') return 'Ngừng bán';
    return undefined;
  }

  private async generateNextSku(): Promise<string> {
    const lastProduct = await this.productModel
      .findOne({ sku: /^SP\d+$/ })
      .sort({ sku: -1 })
      .select('sku')
      .lean();

    let nextNumber = lastProduct?.sku
      ? Number(String(lastProduct.sku).replace(/^SP/, '')) + 1
      : 1;

    while (await this.productModel.exists({ sku: `SP${String(nextNumber).padStart(4, '0')}` })) {
      nextNumber += 1;
    }

    return `SP${String(nextNumber).padStart(4, '0')}`;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const payload: any = { ...createProductDto };
    payload.status = this.normalizeStatus(payload.status) || 'Hoạt động';
    payload.color = payload.color || '#3B82F6';
    const categoryObjectId = this.normalizeObjectId(payload.categoryId);
    if (categoryObjectId) {
      payload.categoryId = categoryObjectId;
    }

    // Map supplierIds -> suppliers array (only IDs)
    if (Array.isArray(payload.supplierIds)) {
      payload.suppliers = payload.supplierIds.map((id: any) => ({ supplierId: new Types.ObjectId(id) }));
      delete payload.supplierIds;
    }

    // Ensure numeric defaults
    payload.importPrice = Number(payload.importPrice || 0);
    payload.shippingCost = Number(payload.shippingCost || 0);
    payload.packagingCost = Number(payload.packagingCost || 0);
    payload.minStock = Number(payload.minStock || 0);
    payload.maxStock = Number(payload.maxStock || 0);
    payload.estimatedDeliveryDays = Number(payload.estimatedDeliveryDays || 0);
    payload.usageDurationMonths = Math.max(1, Number(payload.usageDurationMonths || 12));
    payload.assumedReturnRatePercent = this.normalizeAssumedReturnRatePercent(
      payload.assumedReturnRatePercent,
      20,
    );
    payload.totalCost = payload.importPrice + payload.shippingCost + payload.packagingCost;

    for (let attempt = 0; attempt < 5; attempt++) {
      if (!payload.sku) {
        payload.sku = await this.generateNextSku();
      }

      try {
        const createdProduct = new this.productModel(payload);
        return await createdProduct.save();
      } catch (error: any) {
        const isDuplicateSku = error?.code === 11000 && error?.keyPattern?.sku;
        if (!isDuplicateSku) {
          throw error;
        }
        delete payload.sku;
      }
    }

    throw new Error('Unable to allocate a unique SKU for the new product');
  }

  async findAll(query?: any): Promise<Product[]> {
    const filter = {};
    
    // Filter by category
    if (query?.categoryId) {
      filter['categoryId'] = this.buildCategoryFilter(query.categoryId);
    }
    
    // Filter by status
    if (query?.status) {
      filter['status'] = query.status;
    }
    
    // Search by name
    if (query?.search) {
      filter['name'] = { $regex: query.search, $options: 'i' };
    }

    return this.productModel
      .find(filter)
      .populate('categoryId', 'name code icon color')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('categoryId', 'name code icon color')
      .exec();
    
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const payload: any = { ...updateProductDto };
    const categoryObjectId = this.normalizeObjectId(payload.categoryId);
    if (categoryObjectId) {
      payload.categoryId = categoryObjectId;
    }

    if (Array.isArray((payload as any).supplierIds)) {
      payload.suppliers = (payload as any).supplierIds.map((id: any) => ({ supplierId: new Types.ObjectId(id) }));
      delete payload.supplierIds;
    }

    if (payload.usageDurationMonths !== undefined) {
      payload.usageDurationMonths = Math.max(1, Number(payload.usageDurationMonths || 1));
    }

    if (payload.status !== undefined) {
      payload.status = this.normalizeStatus(payload.status) || payload.status;
    }

    if (payload.assumedReturnRatePercent !== undefined) {
      payload.assumedReturnRatePercent = this.normalizeAssumedReturnRatePercent(
        payload.assumedReturnRatePercent,
      );
    }

    // Ensure totalCost stays correct when updating (pre-save hook won't run).
    // Use existing values for fields that are not part of the partial update payload.
    if (payload.importPrice !== undefined || payload.shippingCost !== undefined || payload.packagingCost !== undefined) {
      const existingProduct = await this.productModel.findById(id).select('importPrice shippingCost packagingCost').lean();
      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      const importPrice = Number(payload.importPrice ?? existingProduct.importPrice ?? 0);
      const shippingCost = Number(payload.shippingCost ?? existingProduct.shippingCost ?? 0);
      const packagingCost = Number(payload.packagingCost ?? existingProduct.packagingCost ?? 0);
      payload.totalCost = importPrice + shippingCost + packagingCost;
    }

    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('categoryId', 'name code icon color')
      .exec();
    
    if (!updatedProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return updatedProduct;
  }

  async remove(id: string): Promise<void> {
    const result = await this.productModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  /**
   * Set customImages for a given product's fanpage variation.
   * If the variation doesn't exist, create it; otherwise update images.
   */
  async setFanpageVariationImages(productId: string, fanpageId: string, images: string[], imagePolicy?: any) {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const fpId = new Types.ObjectId(fanpageId);
    const variations = product.fanpageVariations || [] as any[];
    const idx = variations.findIndex((v: any) => v.fanpageId?.toString() === fpId.toString());

    if (idx === -1) {
      variations.push({ fanpageId: fpId, customImages: images, isActive: true, priority: 0, ...(imagePolicy ? { imagePolicy } : {}) });
    } else {
      variations[idx] = { ...variations[idx], customImages: images, ...(imagePolicy ? { imagePolicy } : {}) };
    }

    await this.productModel.updateOne({ _id: productId }, { fanpageVariations: variations });
    return this.findOne(productId);
  }

  // Get products by category
  async getByCategory(categoryId: string): Promise<Product[]> {
    const categoryFilter = this.buildCategoryFilter(categoryId);
    return this.productModel
      .find(categoryFilter ? { categoryId: categoryFilter } : {})
      .populate('categoryId', 'name code icon color')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Get products statistics
  async getStats() {
    // Totals & averages
    const summary = await this.productModel.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: {
            $sum: {
              $ifNull: [
                '$totalCost',
                { $add: ['$importPrice', '$shippingCost', '$packagingCost'] }
              ]
            }
          },
          avgImportPrice: { $avg: '$importPrice' }
        }
      }
    ]);

    const s = summary[0] || { totalProducts: 0, totalValue: 0, avgImportPrice: 0 };

    // Category distribution
    const categoryAgg = await this.productModel.aggregate([
      { $group: { _id: '$categoryId', count: { $sum: 1 } } }
    ]);
    const categoryDistribution: Record<string, number> = {};
    for (const c of categoryAgg) {
      categoryDistribution[c._id?.toString?.() || 'unknown'] = c.count || 0;
    }

    // TODO: Khi có tồn kho thực tế, tính lowStockCount / outOfStockCount. Hiện tại đặt 0 để tránh NaN.
    return {
      totalProducts: s.totalProducts || 0,
      totalValue: s.totalValue || 0,
      averageImportPrice: Math.round(s.avgImportPrice || 0),
      lowStockCount: 0,
      outOfStockCount: 0,
      categoryDistribution
    };
  }

  // Seed sample data
  async seedSampleData(): Promise<Product[]> {
    // Get some categories first
    const categoryModel = this.productModel.db.model('ProductCategory');
    const categories = await categoryModel.find().limit(3);
    
    if (categories.length === 0) {
      throw new Error('No product categories found. Please create categories first.');
    }

    // Clear existing data
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
        categoryId: categories[1]?._id || categories[0]._id,
        importPrice: 150000,
        shippingCost: 25000,
        packagingCost: 15000,
        estimatedDeliveryDays: 3,
        status: 'Hoạt động',
        notes: 'Chất liệu cotton 100% từ Việt Nam'
      },
      {
        name: 'Quần jeans nam',
        categoryId: categories[1]?._id || categories[0]._id,
        importPrice: 300000,
        shippingCost: 35000,
        packagingCost: 20000,
        estimatedDeliveryDays: 4,
        status: 'Hoạt động',
        notes: 'Denim cao cấp, form slim fit'
      },
      {
        name: 'Nồi cơm điện Panasonic',
        categoryId: categories[2]?._id || categories[0]._id,
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

  /**
   * Get AI analysis statistics
   */
  async getAIAnalysisStats(fanpageId?: string): Promise<any> {
    const matchStage: any = {};
    
    if (fanpageId) {
      matchStage['fanpageVariations.fanpageId'] = new Types.ObjectId(fanpageId);
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

    // Calculate keyword frequency
    const keywordFreq = {};
    result.topKeywords.flat().forEach(keyword => {
      keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
    });

    const topKeywords = Object.entries(keywordFreq)
      .sort(([,a], [,b]) => (b as number) - (a as number))
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

  /**
   * Update product with AI analysis results
   */
  async updateWithAIAnalysis(
    productId: string, 
    imageIndex: number, 
    analysis: any
  ): Promise<Product> {
    const product = await this.findOne(productId);
    
    if (!product.images || !product.images[imageIndex]) {
      throw new NotFoundException('Ảnh không tồn tại');
    }

    // Update specific image analysis
    product.images[imageIndex].aiAnalysis = analysis;

    // Update search keywords
    const allKeywords = new Set<string>();
    product.images.forEach(img => {
      if (img.aiAnalysis?.keywords) {
        img.aiAnalysis.keywords.forEach(keyword => allKeywords.add(keyword));
      }
    });

    // Update AI description from available analysis
    if (analysis.description && analysis.description !== 'Không thể tạo mô tả') {
      product.aiDescription = analysis.description;
    }

    product.searchKeywords = Array.from(allKeywords);

    // Use updateOne instead of save for document updates
    await this.productModel.updateOne(
      { _id: productId },
      { 
        images: product.images,
        aiDescription: product.aiDescription,
        searchKeywords: product.searchKeywords
      }
    );

    return this.findOne(productId);
  }

  async listProductMedia(productId: string, opts: { page?: number; limit?: number; fanpageId?: string } = {}) {
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Number(opts.limit) || 50);
    const skip = (page - 1) * limit;
    const filter: any = { productId: new Types.ObjectId(productId) };
    if (opts.fanpageId) filter.fanpageId = new Types.ObjectId(opts.fanpageId);
    const [items, total] = await Promise.all([
      this.mediaModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.mediaModel.countDocuments(filter)
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Choose best images for a product given a fanpage, using policy/tags.
   * - Input: productId, fanpageId, limit
   * - Output: array of URL strings
   * Priority: fanpage.customImages > policy-scored media for product > product.images
   */
  async chooseBestImages(params: { productId: string; fanpageId?: string; limit?: number }): Promise<string[]> {
    const { productId } = params;
    const limit = Math.min(10, Math.max(1, params.limit || 4));
    const product = await this.productModel.findById(productId).lean();
    if (!product) return [];

    let custom: string[] | undefined;
    let policy: any | undefined;
    if (params.fanpageId) {
      const fpId = new Types.ObjectId(params.fanpageId);
      const v = (product as any).fanpageVariations?.find((x: any) => x.fanpageId?.toString() === fpId.toString() && x.isActive !== false);
      if (v) {
        custom = v.customImages && v.customImages.length ? v.customImages : undefined;
        policy = v.imagePolicy;
      }
    }
    if (custom && custom.length) return custom.slice(0, limit);

    const medias = await this.mediaModel.find({ productId: product._id }).lean();
    if (!medias || !medias.length) {
      const imgs = ((product as any).images || []).map((i: any) => i.url).filter(Boolean);
      return imgs.slice(0, limit);
    }

    const desiredAspect = policy?.aspectRatio && policy.aspectRatio !== 'any' ? policy.aspectRatio : undefined;
    const priorityTags: string[] = policy?.priorityTags || [];
    const forbiddenTags: string[] = policy?.forbiddenTags || [];

    const scoreOf = (m: any): number => {
      let s = 0;
      if (m.isMainImage) s += 5;
      if (desiredAspect && m.aspectRatio === desiredAspect) s += 3;
      const tags: string[] = m.tags || [];
      for (const t of priorityTags) if (tags.includes(t)) s += 2;
      for (const t of forbiddenTags) if (tags.includes(t)) s -= 100;
      const st = m.sourceType || 'gallery';
      if (st === 'gallery') s += 1; else if (st === 'feedback') s += 0.5;
      const pixels = (m.width || 0) * (m.height || 0);
      s += Math.min(3, Math.floor(pixels / (800 * 800)));
      return s;
    };

    const ranked = medias
      .filter(m => !(m.tags || []).some((t: string) => forbiddenTags.includes(t)))
      .map(m => ({ url: m.url, score: scoreOf(m) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.url);
    if (ranked.length) return ranked;
    const imgs = ((product as any).images || []).map((i: any) => i.url).filter(Boolean);
    return imgs.slice(0, limit);
  }

  /**
   * Like chooseBestImages but returns metadata with alt text when available.
   */
  async chooseBestImagesWithAlts(params: { productId: string; fanpageId?: string; limit?: number }): Promise<Array<{ url: string; alt?: string }>> {
    const { productId } = params;
    const limit = Math.min(10, Math.max(1, params.limit || 4));
    const product = await this.productModel.findById(productId).lean();
    if (!product) return [];

    let custom: string[] | undefined;
    let policy: any | undefined;
    if (params.fanpageId) {
      const fpId = new Types.ObjectId(params.fanpageId);
      const v = (product as any).fanpageVariations?.find((x: any) => x.fanpageId?.toString() === fpId.toString() && x.isActive !== false);
      if (v) {
        custom = v.customImages && v.customImages.length ? v.customImages : undefined;
        policy = v.imagePolicy;
      }
    }
    if (custom && custom.length) {
      const list = custom.slice(0, limit);
      const mediaDocs = await this.mediaModel.find({ url: { $in: list } }).select('url alt').lean();
      const altMap = new Map(mediaDocs.map((m: any) => [m.url, m.alt]));
      return list.map((url) => ({ url, alt: altMap.get(url) }));
    }

    const medias = await this.mediaModel.find({ productId: product._id }).lean();
    if (!medias || !medias.length) {
      const imgs = ((product as any).images || []).map((i: any) => i.url).filter(Boolean).slice(0, limit);
      return imgs.map((url: string) => ({ url }));
    }

    const desiredAspect = policy?.aspectRatio && policy.aspectRatio !== 'any' ? policy.aspectRatio : undefined;
    const priorityTags: string[] = policy?.priorityTags || [];
    const forbiddenTags: string[] = policy?.forbiddenTags || [];

    const scoreOf = (m: any): number => {
      let s = 0;
      if (m.isMainImage) s += 5;
      if (desiredAspect && m.aspectRatio === desiredAspect) s += 3;
      const tags: string[] = m.tags || [];
      for (const t of priorityTags) if (tags.includes(t)) s += 2;
      for (const t of forbiddenTags) if (tags.includes(t)) s -= 100;
      const st = m.sourceType || 'gallery';
      if (st === 'gallery') s += 1; else if (st === 'feedback') s += 0.5;
      const pixels = (m.width || 0) * (m.height || 0);
      s += Math.min(3, Math.floor(pixels / (800 * 800)));
      return s;
    };

    const ranked = medias
      .filter(m => !(m.tags || []).some((t: string) => forbiddenTags.includes(t)))
      .map(m => ({ url: m.url, alt: m.alt, score: scoreOf(m) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => ({ url: x.url, alt: x.alt }));
    return ranked;
  }
  

  /**
   * Report: products with fanpage variation customImages
   */
  async getVariationImagesReport(params: { fanpageId?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const matchStage: any = {};
    if (params.search) {
      matchStage.name = { $regex: params.search, $options: 'i' };
    }

    const fanpageMatch: any = {};
    if (params.fanpageId) {
      fanpageMatch['fanpageVariations.fanpageId'] = new Types.ObjectId(params.fanpageId);
    }

    const pipeline: any[] = [
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
          items: [ { $skip: skip }, { $limit: limit } ],
          totalCount: [ { $count: 'count' } ]
        }
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [ { $arrayElemAt: ['$totalCount.count', 0] }, 0 ] },
          page: { $literal: page },
          limit: { $literal: limit },
          totalPages: { $cond: [ { $gt: [ { $ifNull: [ { $arrayElemAt: ['$totalCount.count', 0] }, 0 ] }, 0 ] }, { $ceil: { $divide: [ { $arrayElemAt: ['$totalCount.count', 0] }, limit ] } }, 0 ] }
        }
      }
    ];

    const res = await this.productModel.aggregate(pipeline).exec();
    return res[0] || { items: [], total: 0, page, limit, totalPages: 0 };
  }

  /**
   * 🧹 CLEANUP & VALIDATION METHODS
   * Làm sạch và đồng bộ hóa ảnh sản phẩm
   */

  async cleanupAndValidateImages() {
    const results = {
      totalProducts: 0,
      mainImagesChecked: 0,
      fanpageVariationsChecked: 0,
      invalidImagesRemoved: 0,
      productsUpdated: 0,
      orphanedFilesFound: 0,
      errors: [] as string[]
    };

    try {
      const products = await this.productModel.find({}).exec();
      results.totalProducts = products.length;

      for (const product of products) {
        let hasChanges = false;

        // Validate main product images
        if (product.images && product.images.length > 0) {
          results.mainImagesChecked += product.images.length;
          const validImages = [];
          
          for (const imageObj of product.images) {
            if (this.isValidImageUrl(imageObj.url)) {
              validImages.push(imageObj);
            } else {
              results.invalidImagesRemoved++;
              hasChanges = true;
            }
          }
          
          if (validImages.length !== product.images.length) {
            product.images = validImages;
          }
        }

        // Validate fanpage variation images (customImages can be string or string[])
        if (product.fanpageVariations && product.fanpageVariations.length > 0) {
          for (const variation of product.fanpageVariations) {
            const imgs = variation.customImages;
            if (!imgs) continue;

            // When stored as a single string
            if (typeof imgs === 'string') {
              results.fanpageVariationsChecked += 1;
              if (!this.isValidImageUrl(imgs)) {
                // Normalize to empty array for consistency with schema
                variation.customImages = [] as any;
                results.invalidImagesRemoved++;
                hasChanges = true;
              }
              continue;
            }

            // When stored as an array
            if (Array.isArray(imgs) && imgs.length > 0) {
              results.fanpageVariationsChecked += imgs.length;
              const validCustomImages: string[] = [];
              for (const imageUrl of imgs) {
                if (this.isValidImageUrl(imageUrl)) {
                  validCustomImages.push(imageUrl);
                } else {
                  results.invalidImagesRemoved++;
                  hasChanges = true;
                }
              }
              if (validCustomImages.length !== imgs.length) {
                variation.customImages = validCustomImages as any;
              }
            }
          }
        }

        if (hasChanges) {
          await product.save();
          results.productsUpdated++;
        }
      }

    } catch (error) {
      results.errors.push(`Cleanup failed: ${error.message}`);
    }

    return results;
  }

  async resetFanpageImages(fanpageId?: string, removeInvalidOnly = true) {
    const results = {
      affectedProducts: 0,
      totalImagesRemoved: 0,
      variationsUpdated: 0,
      errors: [] as string[]
    };

    try {
      const query: any = {};
      if (fanpageId) {
        query['fanpageVariations.fanpageId'] = new Types.ObjectId(fanpageId);
      }

      const products = await this.productModel.find(query).exec();
      results.affectedProducts = products.length;

      for (const product of products) {
        let hasChanges = false;

        if (product.fanpageVariations && product.fanpageVariations.length > 0) {
          for (const variation of product.fanpageVariations) {
            // Skip if fanpageId filter is specified and doesn't match
            if (fanpageId && variation.fanpageId.toString() !== fanpageId) {
              continue;
            }

            if (variation.customImages && variation.customImages.length > 0) {
              const originalCount = variation.customImages.length;
              
              if (removeInvalidOnly) {
                // Only remove invalid images
                const validImages = [];
                for (const imageUrl of variation.customImages) {
                  if (this.isValidImageUrl(imageUrl)) {
                    validImages.push(imageUrl);
                  }
                }
                variation.customImages = validImages;
              } else {
                // Remove all custom images for this fanpage
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

    } catch (error) {
      results.errors.push(`Reset failed: ${error.message}`);
    }

    return results;
  }

  async generateImageValidationReport(fanpageId?: string) {
    const report = {
      totalProducts: 0,
      productsWithImages: 0,
      productsWithFanpageImages: 0,
      validMainImages: 0,
      invalidMainImages: 0,
      validFanpageImages: 0,
      invalidFanpageImages: 0,
      fanpageBreakdown: {} as Record<string, { valid: number; invalid: number; total: number }>,
      invalidImagesList: [] as { productId: string; productName: string; imageUrl: string; imageType: 'main' | 'fanpage' }[]
    };

    try {
      // Simple query first to avoid population issues
      const products = await this.productModel.find({}).limit(100).exec();
      
      report.totalProducts = products.length;

      for (const product of products) {
        let hasMainImages = false;
        let hasFanpageImages = false;

        // Check main images
        if (product.images && product.images.length > 0) {
          hasMainImages = true;
          for (const imageObj of product.images) {
            const isValid = this.isValidImageUrl(imageObj.url);
            if (isValid) {
              report.validMainImages++;
            } else {
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

        // Check fanpage variation images
        if (product.fanpageVariations && product.fanpageVariations.length > 0) {
          for (const variation of product.fanpageVariations) {
            // Skip if fanpageId filter specified and doesn't match
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
                } else {
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

        if (hasMainImages) report.productsWithImages++;
        if (hasFanpageImages) report.productsWithFanpageImages++;
      }

    } catch (error) {
      console.error('Image validation report failed:', error);
      throw error; // Re-throw to see the actual error
    }

    return report;
  }

  private isValidImageUrl(imageUrl: string): boolean {
    if (!imageUrl) return false;
    
    // External URLs are considered valid (we can't easily check them)
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return !imageUrl.includes('/media/'); // Only validate internal media URLs
    }

    // Internal media URLs - check if file exists
    if (imageUrl.startsWith('/media/')) {
      try {
        const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads', 'media');
        const filePath = path.join(MEDIA_DIR, imageUrl.replace('/media/', ''));
        return fs.existsSync(filePath);
      } catch (error) {
        return false;
      }
    }

    return true; // Other URL formats are considered valid
  }
}
