/**
 * File: ad-group/ad-group.service.ts
 * Mục đích: Xử lý nghiệp vụ Nhóm Quảng Cáo (CRUD, filter).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';

@Injectable()
export class AdGroupService {
  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  async create(dto: CreateAdGroupDto): Promise<AdGroup> {
    const created = new this.adGroupModel({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    try {
      return await created.save();
    } catch (e: any) {
      // Mongo duplicate key error
      if (e?.code === 11000 && e?.keyPattern?.adGroupId) {
        throw new BadRequestException('ID nhóm quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
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
    if (query?.enableAIChat !== undefined) filter.enableAIChat = query.enableAIChat === 'true';

    return this.adGroupModel.find(filter)
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price')
      .populate('openAIConfigId', 'name model systemPrompt')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Tìm kiếm nhóm quảng cáo với bộ lọc + từ khóa (tên hoặc adGroupId)
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
      .populate('openAIConfigId', 'name model')
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
      .populate('openAIConfigId', 'name model systemPrompt temperature maxTokens')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy nhóm quảng cáo');
    return doc;
  }

  /**
   * Tìm Ad Group theo adGroupId và fanpageId (dùng cho webhook)
   * Phục vụ AI chatbot khi nhận tin nhắn từ webhook
   */
  async findByAdGroupIdAndFanpage(adGroupId: string, fanpageId: string): Promise<AdGroup | null> {
    return this.adGroupModel.findOne({ 
      adGroupId, 
      fanpageId, 
      isActive: true,
      enableAIChat: true 
    })
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description')
      .populate('selectedProducts', 'name description price images')
      .populate('openAIConfigId', 'name model systemPrompt temperature maxTokens apiKey')
      .exec();
  }

  async update(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const updated = await this.adGroupModel.findByIdAndUpdate(id, dto, { new: true })
      .populate('fanpageId', 'name pageId')
      .populate('productCategoryId', 'name description color icon')
      .populate('selectedProducts', 'name description price')
      .populate('openAIConfigId', 'name model')
      .populate('agentId', 'fullName name')
      .populate('adAccountId', 'name accountId')
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy nhóm quảng cáo');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.adGroupModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Không tìm thấy nhóm quảng cáo');
  }

  /**
   * Thống kê số lượng nhóm quảng cáo theo sản phẩm.
   * Trả về mảng gồm { productId, active, inactive }
   */
  async getCountsByProduct(): Promise<Array<{ productId: string; active: number; inactive: number }>> {
    const rows = await this.adGroupModel.aggregate([
      {
        $group: {
          _id: '$productCategoryId',
          active: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          productId: { $toString: '$_id' },
          active: 1,
          inactive: 1
        }
      }
    ]).exec();
    return rows as Array<{ productId: string; active: number; inactive: number }>;
  }
}
