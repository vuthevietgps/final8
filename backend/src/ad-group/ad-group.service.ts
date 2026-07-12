/**
 * AdGroup service.
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
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

  private normalizeSelectedProducts(selectedProducts: unknown): string[] {
    if (selectedProducts === undefined || selectedProducts === null) {
      return [];
    }
    if (!Array.isArray(selectedProducts)) {
      throw new BadRequestException('selectedProducts phai la mang neu duoc gui len');
    }

    const normalized = Array.from(new Set(
      selectedProducts
        .map((item) => String(item ?? '').trim())
        .filter(Boolean),
    ));

    if (normalized.length > 1) {
      throw new BadRequestException('Moi nhom quang cao chi duoc gan toi da 1 san pham');
    }

    return normalized;
  }

  private async resolveCategoryIdByProductId(productId: string): Promise<string> {
    const product = await this.productModel
      .findById(productId)
      .select('categoryId')
      .lean();

    const categoryId = product?.categoryId ? String(product.categoryId) : '';
    if (!categoryId) {
      throw new BadRequestException('San pham da chon khong ton tai hoac chua co danh muc');
    }
    return categoryId;
  }

  private async resolveProductContext(
    selectedProducts: string[],
    requestedCategoryId?: string,
  ): Promise<{ selectedProducts?: string[]; productCategoryId?: string }> {
    if (!selectedProducts.length) {
      return {
        selectedProducts: [],
        productCategoryId: undefined,
      };
    }

    const resolvedCategoryId = await this.resolveCategoryIdByProductId(selectedProducts[0]);
    if (requestedCategoryId && String(requestedCategoryId) !== resolvedCategoryId) {
      throw new BadRequestException('San pham da chon khong thuoc danh muc san pham da truyen');
    }

    return {
      selectedProducts,
      productCategoryId: resolvedCategoryId,
    };
  }

  private baseQuery(filter: FilterQuery<AdGroupDocument>) {
    return this.adGroupModel.find(filter)
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name categoryId status')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId accountType managementMode businessCenterId businessCenterName')
      .populate('assignedEmployeeId', 'fullName email role')
      .sort({ createdAt: -1 });
  }

  async create(dto: CreateAdGroupDto): Promise<AdGroup> {
    const productContext = await this.resolveProductContext(
      this.normalizeSelectedProducts(dto.selectedProducts),
      dto.productCategoryId,
    );

    const created = new this.adGroupModel({
      ...dto,
      productCategoryId: productContext.productCategoryId,
      selectedProducts: productContext.selectedProducts,
      isActive: dto.isActive ?? true,
      lastOperatorActivityAt: dto.platform === 'tiktok' ? new Date() : undefined,
    });
    try {
      return await created.save();
    } catch (e: any) {
      if (e?.code === 11000 && e?.keyPattern?.adGroupId) {
        throw new BadRequestException('ID nhom quang cao da ton tai. Vui long nhap ID khac.');
      }
      throw e;
    }
  }

  async findAll(query?: any): Promise<AdGroup[]> {
    const filter: FilterQuery<AdGroupDocument> = {};
    if (query?.platform) filter.platform = query.platform;
    if (query?.fanpageId) filter.fanpageId = query.fanpageId;
    if (query?.productCategoryId) filter.productCategoryId = query.productCategoryId;
    if (query?.productId) filter.selectedProducts = query.productId;
    if (query?.agentId) filter.agentId = query.agentId;
    if (query?.assignedEmployeeId) filter.assignedEmployeeId = query.assignedEmployeeId;
    if (query?.adAccountId) filter.adAccountId = query.adAccountId;
    if (query?.adGroupId) filter.adGroupId = query.adGroupId;
    if (query?.isActive !== undefined) filter.isActive = query.isActive === 'true';

    return this.baseQuery(filter).exec();
  }

  async search(query?: any): Promise<AdGroup[]> {
    const filter: FilterQuery<AdGroupDocument> = {};
    if (query?.platform && query.platform !== 'all') filter.platform = query.platform;
    if (query?.fanpageId && query.fanpageId !== 'all') filter.fanpageId = query.fanpageId;
    if (query?.productCategoryId && query.productCategoryId !== 'all') filter.productCategoryId = query.productCategoryId;
    if (query?.productId && query.productId !== 'all') filter.selectedProducts = query.productId;
    if (query?.agentId && query.agentId !== 'all') filter.agentId = query.agentId;
    if (query?.assignedEmployeeId && query.assignedEmployeeId !== 'all') filter.assignedEmployeeId = query.assignedEmployeeId;
    if (query?.adAccountId && query.adAccountId !== 'all') filter.adAccountId = query.adAccountId;
    if (query?.status && query.status !== 'all') filter.isActive = query.status === 'active';

    if (query?.q) {
      const rx = new RegExp(query.q.trim(), 'i');
      filter.$or = [{ name: rx }, { adGroupId: rx }, { description: rx }];
    }

    return this.baseQuery(filter).exec();
  }

  async existsByAdGroupId(adGroupId: string): Promise<boolean> {
    const count = await this.adGroupModel.countDocuments({ adGroupId }).exec();
    return count > 0;
  }

  async findOne(id: string): Promise<AdGroup> {
    const doc = await this.adGroupModel.findById(id)
      .populate('fanpageId', 'name pageId avatarUrl')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name categoryId status images')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId accountType managementMode businessCenterId businessCenterName')
      .populate('assignedEmployeeId', 'fullName email role')
      .exec();
    if (!doc) throw new NotFoundException('Khong tim thay nhom quang cao');
    return doc;
  }

  async findByAdGroupIdAndFanpage(adGroupId: string, fanpageId: string): Promise<AdGroup | null> {
    return this.adGroupModel.findOne({
      adGroupId,
      fanpageId,
      isActive: true,
    })
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description')
      .populate('selectedProducts', 'name categoryId status images')
      .populate('assignedEmployeeId', 'fullName email role')
      .exec();
  }

  async update(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const existing = await this.adGroupModel
      .findById(id)
      .select('selectedProducts platform')
      .lean();
    if (!existing) throw new NotFoundException('Khong tim thay nhom quang cao');

    const updatePayload: any = { ...dto };

    if (dto.selectedProducts !== undefined) {
      const productContext = await this.resolveProductContext(
        this.normalizeSelectedProducts(dto.selectedProducts),
        dto.productCategoryId,
      );
      updatePayload.selectedProducts = productContext.selectedProducts;
      updatePayload.productCategoryId = productContext.productCategoryId;
    } else if (dto.productCategoryId !== undefined) {
      delete updatePayload.productCategoryId;
    }

    const nextPlatform = (dto.platform as AdGroup['platform']) || existing.platform;
    const shouldMarkOperatorActivity = nextPlatform === 'tiktok' && (
      'assignedEmployeeId' in dto ||
      'adAccountId' in dto ||
      'notes' in dto ||
      'description' in dto ||
      'isActive' in dto
    );
    if (shouldMarkOperatorActivity) {
      updatePayload.lastOperatorActivityAt = new Date();
    }

    const updated = await this.adGroupModel.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true },
    )
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name categoryId status')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId accountType managementMode businessCenterId businessCenterName')
      .populate('assignedEmployeeId', 'fullName email role')
      .exec();
    if (!updated) throw new NotFoundException('Khong tim thay nhom quang cao');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.adGroupModel.findById(id).select('adGroupId').lean();
    if (!existing) throw new NotFoundException('Khong tim thay nhom quang cao');

    await this.adGroupModel.findByIdAndDelete(id).exec();

    if (existing.adGroupId) {
      try {
        const cleanup = await this.advertisingCostModel.deleteMany({ adGroupId: existing.adGroupId });
        this.logger.log(`Deleted adGroup ${existing.adGroupId} and cleaned ${cleanup.deletedCount || 0} advertising cost records.`);
      } catch (error: any) {
        this.logger.warn(`AdGroup deleted but failed to cleanup AdvertisingCost for ${existing.adGroupId}: ${error?.message}`);
      }
    }
  }

  async getCountsByProduct(): Promise<Array<{ productId: string; productName: string; active: number; inactive: number }>> {
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
