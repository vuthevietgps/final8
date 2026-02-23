/**
 * File: other-cost/other-cost.service.ts
 * Mục đích: Xử lý nghiệp vụ cho Chi Phí Vận Hành (CRUD, lọc theo ngày, thống kê).
 * 
 * CFO v3.1: Thêm dueDate + category để tính Committed Cash chính xác
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtherCost, OtherCostDocument, OpsCategory } from './schemas/other-cost.schema';
import { CreateOtherCostDto } from './dto/create-other-cost.dto';
import { UpdateOtherCostDto } from './dto/update-other-cost.dto';

@Injectable()
export class OtherCostService {
  private readonly logger = new Logger(OtherCostService.name);

  constructor(
    @InjectModel(OtherCost.name)
    private readonly otherCostModel: Model<OtherCostDocument>,
  ) {}

  /**
   * Tạo mới chi phí vận hành
   * CFO v3.1: dueDate là required
   */
  async create(dto: CreateOtherCostDto): Promise<OtherCost> {
    const payload: Partial<OtherCost> = {
      date: new Date(dto.date),
      dueDate: new Date(dto.dueDate), // CFO v3.1: Required
      amount: dto.amount,
      category: (dto.category as OpsCategory) || 'other',
      notes: dto.notes?.trim() || undefined,
      documentLink: dto.documentLink?.trim() || undefined,
      isConfirmed: dto.isConfirmed ?? false,
      confirmedAt: dto.isConfirmed ? new Date() : undefined,
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
    if (dto.dueDate) {
      update.dueDate = new Date(dto.dueDate);
    }
    if (dto.category !== undefined) {
      update.category = dto.category;
    }
    if (dto.documentLink !== undefined) {
      update.documentLink = dto.documentLink?.trim() || undefined;
    }
    if (dto.isConfirmed !== undefined) {
      update.isConfirmed = dto.isConfirmed;
      update.confirmedAt = dto.isConfirmed ? new Date() : undefined;
    }
    const updated = await this.otherCostModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy chi phí để cập nhật');
    return updated;
  }

  /**
   * Xác nhận đã chi
   */
  async confirm(id: string): Promise<OtherCost> {
    const updated = await this.otherCostModel
      .findByIdAndUpdate(id, { isConfirmed: true, confirmedAt: new Date() }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy chi phí để xác nhận');
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

  // ============ Summary for Financial Control ============
  // NOTE: Đây là chi phí vận hành (Account Payable - AP)

  /**
   * Tổng hợp chi phí vận hành (Operating Expenses) cho Financial Control
   * CFO v3.1: Tối giản nhưng đủ cho Committed + Forecast
   */
  async getCashflowSummary(windowDays: number = 14): Promise<{
    // === TỔNG HỢP ===
    totalOpsPaid: number;             // Chi phí đã trả (cash-out)
    totalOpsUnpaid: number;           // Chi phí chưa trả (AP)
    totalOpsDue14d: number;           // Đến hạn trong windowDays (Committed)
    
    // === FORECAST 7 NGÀY ===
    dueByDay7d: {
      date: string;                   // YYYY-MM-DD
      amount: number;
      count: number;
    }[];
    
    // === PHÂN LOẠI ===
    byCategory: {
      category: string;
      paid: number;
      unpaid: number;
      due14d: number;
      nextDueDate?: string;
    }[];
    
    // === METADATA ===
    metadata: {
      asOfDate: string;
      timezone: string;
      windowDays: number;
      generatedAt: string;
    };
    
    // === ALERTS ===
    alerts: string[];
  }> {
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]); // Start of today
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + windowDays);
    const day7End = new Date(today);
    day7End.setDate(day7End.getDate() + 7);

    // === 1. TỔNG HỢP ===
    // Tổng đã trả (isConfirmed = true)
    const paidAgg = await this.otherCostModel.aggregate([
      { $match: { isConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalOpsPaid = paidAgg[0]?.total || 0;

    // Tổng chưa trả (unpaid)
    const unpaidAgg = await this.otherCostModel.aggregate([
      { $match: { isConfirmed: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalOpsUnpaid = unpaidAgg[0]?.total || 0;

    // Đến hạn trong windowDays (Committed)
    // CFO rule: due14d = sum(amount where !isConfirmed && dueDate <= today + windowDays)
    const dueAgg = await this.otherCostModel.aggregate([
      {
        $match: {
          isConfirmed: { $ne: true },
          dueDate: { $exists: true, $lte: windowEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalOpsDue14d = dueAgg[0]?.total || 0;

    // === 2. DUE BY DAY 7D (for forecast) ===
    const dueByDayAgg = await this.otherCostModel.aggregate([
      {
        $match: {
          isConfirmed: { $ne: true },
          dueDate: { $gte: today, $lte: day7End },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$dueDate' } },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          amount: 1,
          count: 1,
          _id: 0,
        },
      },
    ]);

    // === 3. BY CATEGORY ===
    const byCategoryAgg = await this.otherCostModel.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$category', 'other'] },
          paid: {
            $sum: { $cond: [{ $eq: ['$isConfirmed', true] }, '$amount', 0] },
          },
          unpaid: {
            $sum: { $cond: [{ $ne: ['$isConfirmed', true] }, '$amount', 0] },
          },
          due14d: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$isConfirmed', true] },
                    { $lte: ['$dueDate', windowEnd] },
                  ],
                },
                '$amount',
                0,
              ],
            },
          },
          nextDueDate: {
            $min: {
              $cond: [
                { $ne: ['$isConfirmed', true] },
                '$dueDate',
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          category: '$_id',
          paid: 1,
          unpaid: 1,
          due14d: 1,
          nextDueDate: {
            $cond: [
              { $gt: ['$nextDueDate', null] },
              { $dateToString: { format: '%Y-%m-%d', date: '$nextDueDate' } },
              null,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { due14d: -1 } },
    ]);

    // === 4. ALERTS ===
    const alerts: string[] = [];

    // Check missing dueDate
    const missingDueDateCount = await this.otherCostModel.countDocuments({
      isConfirmed: { $ne: true },
      dueDate: { $exists: false },
    });
    if (missingDueDateCount > 0) {
      const msg = `[Ops] ${missingDueDateCount} khoản chưa chi thiếu dueDate`;
      this.logger.warn(msg);
      alerts.push(msg);
    }

    // Check overdue (dueDate < today)
    const overdueCount = await this.otherCostModel.countDocuments({
      isConfirmed: { $ne: true },
      dueDate: { $lt: today },
    });
    if (overdueCount > 0) {
      const overdueAgg = await this.otherCostModel.aggregate([
        {
          $match: {
            isConfirmed: { $ne: true },
            dueDate: { $lt: today },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const overdueAmount = overdueAgg[0]?.total || 0;
      const msg = `[Ops] ${overdueCount} khoản quá hạn, tổng ${overdueAmount.toLocaleString('vi-VN')} VNĐ`;
      this.logger.warn(msg);
      alerts.push(msg);
    }

    return {
      totalOpsPaid,
      totalOpsUnpaid,
      totalOpsDue14d,
      dueByDay7d: dueByDayAgg,
      byCategory: byCategoryAgg,
      metadata: {
        asOfDate: today.toISOString().split('T')[0],
        timezone: 'Asia/Bangkok',
        windowDays,
        generatedAt: now.toISOString(),
      },
      alerts,
    };
  }
}
