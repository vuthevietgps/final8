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

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    @InjectModel(Media.name)
    private mediaModel: Model<MediaDocument>
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Set default values
    if (!createProductDto.estimatedDeliveryDays) {
      createProductDto.estimatedDeliveryDays = 0;
    }
    if (!createProductDto.status) {
      createProductDto.status = 'Hoạt động';
    }

    const createdProduct = new this.productModel(createProductDto);
    return createdProduct.save();
  }

  async findAll(query?: any): Promise<Product[]> {
    const filter = {};
    
    // Filter by category
    if (query?.categoryId) {
      filter['categoryId'] = new Types.ObjectId(query.categoryId);
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
    const updatedProduct = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, { new: true })
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
    return this.productModel
      .find({ categoryId: new Types.ObjectId(categoryId) })
      .populate('categoryId', 'name code icon color')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Get products statistics
  async getStats() {
    const total = await this.productModel.countDocuments();
    const active = await this.productModel.countDocuments({ status: 'Hoạt động' });
    const inactive = await this.productModel.countDocuments({ status: 'Tạm dừng' });
    
    // Calculate average costs
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
}
