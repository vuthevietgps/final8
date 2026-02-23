/**
 * File: ad-account/ad-account.service.ts
 * Mục đích: Xử lý nghiệp vụ Tài Khoản Quảng Cáo (CRUD, filter).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AdAccount, AdAccountDocument } from './schemas/ad-account.schema';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';

@Injectable()
export class AdAccountService {
  constructor(
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
  ) {}

  async create(dto: CreateAdAccountDto): Promise<AdAccount> {
    const created = new this.adAccountModel({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    try {
      return await created.save();
    } catch (e: any) {
      // Mongo duplicate key error
      if (e?.code === 11000 && e?.keyPattern?.accountId) {
        throw new BadRequestException('ID tài khoản quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
      }
      throw e;
    }
  }

  async findAll(query?: any): Promise<AdAccount[]> {
    const filter: FilterQuery<AdAccountDocument> = {};
    if (query?.accountType) filter.accountType = query.accountType;
    if (query?.isActive !== undefined) filter.isActive = query.isActive === 'true';
    return this.adAccountModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  /**
   * Tìm kiếm tài khoản quảng cáo với bộ lọc + từ khóa (tên hoặc accountId)
   */
  async search(query?: any): Promise<AdAccount[]> {
    const filter: FilterQuery<AdAccountDocument> = {};
    if (query?.accountType && query.accountType !== 'all') filter.accountType = query.accountType;
    if (query?.status && query.status !== 'all') filter.isActive = query.status === 'active';

    // Tìm kiếm theo từ khóa (tên hoặc ID tài khoản)
    if (query?.keyword) {
      const keyword = query.keyword.trim();
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { accountId: { $regex: keyword, $options: 'i' } },
        ];
      }
    }

    return this.adAccountModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<AdAccount> {
    const item = await this.adAccountModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo');
    }
    return item;
  }

  async update(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    try {
      const updated = await this.adAccountModel
        .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
        .exec();
      if (!updated) {
        throw new NotFoundException('Không tìm thấy tài khoản quảng cáo để cập nhật');
      }
      return updated;
    } catch (e: any) {
      if (e?.code === 11000 && e?.keyPattern?.accountId) {
        throw new BadRequestException('ID tài khoản quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.adAccountModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Không tìm thấy tài khoản quảng cáo để xóa');
    }
  }

  /**
   * Kiểm tra accountId có tồn tại không (để validate)
   */
  async validateAccountId(accountId: string): Promise<{ exists: boolean; account?: AdAccount }> {
    const account = await this.adAccountModel.findOne({ accountId }).exec();
    return {
      exists: !!account,
      account: account || undefined,
    };
  }

  /**
   * Lấy thống kê số lượng theo loại tài khoản
   */
  async getStatsByType(): Promise<any[]> {
    return this.adAccountModel.aggregate([
      {
        $group: {
          _id: '$accountType',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).exec();
  }
}
