/**
 * File: other-cost/other-cost.service.ts
 * Mục đích: Xử lý nghiệp vụ cho Chi Phí Khác (CRUD, lọc theo ngày, thống kê tổng tiền).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtherCost, OtherCostDocument } from './schemas/other-cost.schema';
import { CreateOtherCostDto } from './dto/create-other-cost.dto';
import { UpdateOtherCostDto } from './dto/update-other-cost.dto';

@Injectable()
export class OtherCostService {
  constructor(
    @InjectModel(OtherCost.name)
    private readonly otherCostModel: Model<OtherCostDocument>,
  ) {}

  /**
   * Tạo mới chi phí khác
   */
  async create(dto: CreateOtherCostDto): Promise<OtherCost> {
    const payload: Partial<OtherCost> = {
      date: new Date(dto.date),
      amount: dto.amount,
  notes: dto.notes?.trim() || undefined,
  documentLink: dto.documentLink?.trim() || undefined,
    };
    const created = new this.otherCostModel(payload);
    return created.save();
  }

  /**
   * Lấy danh sách chi phí, có thể lọc theo khoảng thời gian
   */
  async findAll(from?: string, to?: string): Promise<OtherCost[]> {
    const filter: any = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    return this.otherCostModel.find(filter).sort({ date: -1, createdAt: -1 }).exec();
  }

  /**
   * Lấy chi tiết 1 chi phí theo id
   */
  async findOne(id: string): Promise<OtherCost> {
    const found = await this.otherCostModel.findById(id).exec();
    if (!found) throw new NotFoundException('Không tìm thấy chi phí');
    return found;
  }

  /**
   * Cập nhật chi phí
   */
  async update(id: string, dto: UpdateOtherCostDto): Promise<OtherCost> {
    const update: any = { ...dto };
    if (dto.date) {
      update.date = new Date(dto.date);
    }
    if (dto.documentLink !== undefined) {
      update.documentLink = dto.documentLink?.trim() || undefined;
    }
    const updated = await this.otherCostModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy chi phí để cập nhật');
    return updated;
  }

  /**
   * Xóa chi phí
   */
  async remove(id: string): Promise<{ message: string }> {
    const deleted = await this.otherCostModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Không tìm thấy chi phí để xóa');
    return { message: 'Xóa chi phí thành công' };
  }

  /**
   * Thống kê tổng tiền theo bộ lọc thời gian (tùy chọn)
   */
  async getSummary(from?: string, to?: string): Promise<{ totalAmount: number; count: number }> {
    const match: any = {};
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }

    const [result] = await this.otherCostModel.aggregate([
      { $match: match },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $count: {} } } },
    ]).exec();

    return { totalAmount: result?.totalAmount || 0, count: result?.count || 0 };
  }
}
