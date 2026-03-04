/**
 * File: ad-group/ad-group.service.ts
 * Má»¥c Ä‘Ã­ch: Xá»­ lÃ½ nghiá»‡p vá»¥ NhÃ³m Quáº£ng CÃ¡o (CRUD, filter).
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';

@Injectable()
export class AdGroupService {
  private readonly logger = new Logger(AdGroupService.name);

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdvertisingCost.name) private readonly advertisingCostModel: Model<AdvertisingCostDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  private normalizeSingleProductSelection(selectedProducts: unknown): string[] {
    if (!Array.isArray(selectedProducts)) {
      throw new BadRequestException('Phải chọn đúng 1 sản phẩm cho nhóm quảng cáo');
    }

    const normalized = Array.from(
      new Set(
        selectedProducts
          .map((item) => String(item ?? '').trim())
          .filter(Boolean),
      ),
    );

    if (normalized.length !== 1) {
      throw new BadRequestException('Mỗi nhóm quảng cáo phải gắn đúng 1 sản phẩm');
    }

    return normalized;
  }

  private async validateProductInCategory(productId: string, productCategoryId: string): Promise<void> {
    const exists = await this.productModel.exists({
      _id: productId,
      categoryId: productCategoryId,
    });

    if (!exists) {
      throw new BadRequestException('Sản phẩm đã chọn không thuộc danh mục sản phẩm của nhóm quảng cáo');
    }
  }

  async create(dto: CreateAdGroupDto): Promise<AdGroup> {
    const selectedProducts = this.normalizeSingleProductSelection(dto.selectedProducts);
    await this.validateProductInCategory(selectedProducts[0], dto.productCategoryId);

    const created = new this.adGroupModel({
      ...dto,
      selectedProducts,
      isActive: dto.isActive ?? true,
    });
    try {
      return await created.save();
    } catch (e: any) {
      // Mongo duplicate key error
      if (e?.code === 11000 && e?.keyPattern?.adGroupId) {
        throw new BadRequestException('ID nhÃ³m quáº£ng cÃ¡o Ä‘Ã£ tá»“n táº¡i. Vui lÃ²ng nháº­p ID khÃ¡c.');
      }
      throw e;
    }
  }

  async findAll(query?: any): Promise<AdGroup[]> {
    const filter: FilterQuery<AdGroupDocument> = {};
    if (query?.platform) filter.platform = query.platform;
    if (query?.fanpageId) filter.fanpageId = query.fanpageId;
    if (query?.productCategoryId) filter.productCategoryId = query.productCategoryId;
    if (query?.agentId) filter.agentId = query.agentId;
    if (query?.adAccountId) filter.adAccountId = query.adAccountId;
    if (query?.isActive !== undefined) filter.isActive = query.isActive === 'true';

    return this.adGroupModel.find(filter)
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * TÃ¬m kiáº¿m nhÃ³m quáº£ng cÃ¡o vá»›i bá»™ lá»c + tá»« khÃ³a (tÃªn hoáº·c adGroupId)
   */
  async search(query?: any): Promise<AdGroup[]> {
    const filter: FilterQuery<AdGroupDocument> = {};
    if (query?.platform && query.platform !== 'all') filter.platform = query.platform;
    if (query?.fanpageId && query.fanpageId !== 'all') filter.fanpageId = query.fanpageId;
    if (query?.productCategoryId && query.productCategoryId !== 'all') filter.productCategoryId = query.productCategoryId;
    if (query?.agentId && query.agentId !== 'all') filter.agentId = query.agentId;
    if (query?.adAccountId && query.adAccountId !== 'all') filter.adAccountId = query.adAccountId;
    if (query?.status && query.status !== 'all') filter.isActive = query.status === 'active';

    if (query?.q) {
      const rx = new RegExp(query.q.trim(), 'i');
      filter.$or = [{ name: rx }, { adGroupId: rx }, { description: rx }];
    }

    return this.adGroupModel.find(filter)
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async existsByAdGroupId(adGroupId: string): Promise<boolean> {
    const count = await this.adGroupModel.countDocuments({ adGroupId }).exec();
    return count > 0;
  }

  async findOne(id: string): Promise<AdGroup> {
    const doc = await this.adGroupModel.findById(id)
      .populate('fanpageId', 'name pageId avatarUrl')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price images')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .exec();
    if (!doc) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ³m quáº£ng cÃ¡o');
    return doc;
  }

  /**
   * TÃ¬m Ad Group theo adGroupId vÃ  fanpageId (dÃ¹ng cho webhook)
   * Phá»¥c vá»¥ AI chatbot khi nháº­n tin nháº¯n tá»« webhook
   */
  async findByAdGroupIdAndFanpage(adGroupId: string, fanpageId: string): Promise<AdGroup | null> {
    return this.adGroupModel.findOne({ 
      adGroupId, 
      fanpageId,
      isActive: true
    })
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description')
      .populate('selectedProducts', 'name description price images')
      .exec();
  }

  async update(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const existing = await this.adGroupModel
      .findById(id)
      .select('productCategoryId selectedProducts')
      .lean();
    if (!existing) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ³m quáº£ng cÃ¡o');

    const updatePayload: any = { ...dto };
    const nextCategoryId = String(dto.productCategoryId ?? existing.productCategoryId ?? '');

    let nextSelectedProducts: string[] | undefined;
    if (dto.selectedProducts !== undefined) {
      nextSelectedProducts = this.normalizeSingleProductSelection(dto.selectedProducts);
      updatePayload.selectedProducts = nextSelectedProducts;
    } else if (dto.productCategoryId !== undefined) {
      // Khi đổi danh mục mà không truyền selectedProducts, thử giữ sản phẩm hiện tại nếu hợp lệ.
      const currentSelected = this.normalizeSingleProductSelection(existing.selectedProducts || []);
      nextSelectedProducts = currentSelected;
      updatePayload.selectedProducts = currentSelected;
    }

    if (nextSelectedProducts) {
      await this.validateProductInCategory(nextSelectedProducts[0], nextCategoryId);
    }

    const updated = await this.adGroupModel.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true },
    )
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .exec();
    if (!updated) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ³m quáº£ng cÃ¡o');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.adGroupModel.findById(id).select('adGroupId').lean();
    if (!existing) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ³m quáº£ng cÃ¡o');

    await this.adGroupModel.findByIdAndDelete(id).exec();

    // Cascade cleanup vÃ¬ AdvertisingCost liÃªn káº¿t báº±ng adGroupId string.
    if (existing.adGroupId) {
      try {
        const cleanup = await this.advertisingCostModel.deleteMany({ adGroupId: existing.adGroupId });
        this.logger.log(`Deleted adGroup ${existing.adGroupId} and cleaned ${cleanup.deletedCount || 0} advertising cost records.`);
      } catch (error: any) {
        this.logger.warn(`AdGroup deleted but failed to cleanup AdvertisingCost for ${existing.adGroupId}: ${error?.message}`);
      }
    }
  }

  /**
   * Thống kê số lượng nhóm quảng cáo theo sản phẩm.
   * Trả về mảng gồm { productId, productName, active, inactive }.
   * productId is Product _id from products collection.
   */
  async getCountsByProduct(): Promise<Array<{ productId: string; productName: string; active: number; inactive: number }>> {
    // Always use products collection as the source of truth for product list.
    const rows = await this.productModel.aggregate([
      {
        $lookup: {
          from: this.adGroupModel.collection.name,
          let: { productId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: '$$productId' },
                    {
                      $map: {
                        input: { $ifNull: ['$selectedProducts', []] },
                        as: 'selectedProductId',
                        in: { $toString: '$$selectedProductId' },
                      },
                    },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                active: {
                  $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
                },
                inactive: {
                  $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
                },
              },
            },
          ],
          as: 'adGroupStats',
        },
      },
      {
        $addFields: {
          stats: {
            $ifNull: [
              { $arrayElemAt: ['$adGroupStats', 0] },
              { active: 0, inactive: 0 },
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: '$_id' },
          productName: '$name',
          active: { $ifNull: ['$stats.active', 0] },
          inactive: { $ifNull: ['$stats.inactive', 0] },
        },
      },
      {
        $sort: { productName: 1 },
      },
    ]).exec();

    return rows as Array<{ productId: string; productName: string; active: number; inactive: number }>;
  }
}


