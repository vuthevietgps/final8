/**
 * File: other-cost/other-cost.service.ts
 * Má»¥c Ä‘Ã­ch: Xá»­ lÃ½ nghiá»‡p vá»¥ cho Chi PhÃ­ Váº­n HÃ nh (CRUD, lá»c theo ngÃ y, thá»‘ng kÃª).
 * 
 * CFO v3.1: ThÃªm dueDate + category Ä‘á»ƒ tÃ­nh Committed Cash chÃ­nh xÃ¡c
 */
import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtherCost, OtherCostDocument, OpsCategory } from './schemas/other-cost.schema';
import { CreateOtherCostDto } from './dto/create-other-cost.dto';
import { UpdateOtherCostDto } from './dto/update-other-cost.dto';
import { TestOrder2Service } from '../test-order2/test-order2.service';

@Injectable()
export class OtherCostService {
  private readonly logger = new Logger(OtherCostService.name);

  private formatDayIso(date: Date, useUtc: boolean): string {
    const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
    const month = String((useUtc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const day = String(useUtc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate day keys in both local and UTC calendars to avoid timezone drift
   * when a stored Date was normalized by a different timezone convention.
   */
  private collectDayIsoCandidates(value?: Date | string | null): string[] {
    if (!value) return [];

    const candidates = new Set<string>();
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) candidates.add(m[1]);
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) return Array.from(candidates);

    candidates.add(this.formatDayIso(date, false));
    candidates.add(this.formatDayIso(date, true));
    return Array.from(candidates);
  }

  private async triggerRecalculateForDates(values: Array<Date | string | null | undefined>): Promise<void> {
    const daySet = new Set<string>();
    for (const value of values) {
      for (const dayIso of this.collectDayIsoCandidates(value ?? null)) {
        daySet.add(dayIso);
      }
    }

    for (const dayIso of daySet) {
      try {
        await this.testOrder2Service.recalculateOrdersForDate(dayIso);
      } catch (error: any) {
        this.logger.error(`Failed to recalculate orders after other-cost change for ${dayIso}`, error);
      }
    }
  }

  constructor(
    @InjectModel(OtherCost.name)
    private readonly otherCostModel: Model<OtherCostDocument>,
    @Inject(forwardRef(() => TestOrder2Service))
    private readonly testOrder2Service: TestOrder2Service,
  ) {}

  /**
   * Táº¡o má»›i chi phÃ­ váº­n hÃ nh
   * CFO v3.1: dueDate lÃ  required
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
    const saved = await created.save();
    await this.triggerRecalculateForDates([saved.date as any]);
    return saved;
  }

  /**
   * Láº¥y danh sÃ¡ch chi phÃ­, cÃ³ thá»ƒ lá»c theo khoáº£ng thá»i gian
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
   * Láº¥y chi tiáº¿t 1 chi phÃ­ theo id
   */
  async findOne(id: string): Promise<OtherCost> {
    const found = await this.otherCostModel.findById(id).exec();
    if (!found) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y chi phÃ­');
    return found;
  }

  /**
   * Cáº­p nháº­t chi phÃ­
   */
  async update(id: string, dto: UpdateOtherCostDto): Promise<OtherCost> {
    const existing = await this.otherCostModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Other cost not found');

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
    if (!updated) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y chi phÃ­ Ä‘á»ƒ cáº­p nháº­t');
    await this.triggerRecalculateForDates([existing.date as any, updated.date as any]);
    return updated;
  }

  /**
   * XÃ¡c nháº­n Ä‘Ã£ chi
   */
  async confirm(id: string): Promise<OtherCost> {
    const updated = await this.otherCostModel
      .findByIdAndUpdate(id, { isConfirmed: true, confirmedAt: new Date() }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y chi phÃ­ Ä‘á»ƒ xÃ¡c nháº­n');
    return updated;
  }

  /**
   * XÃ³a chi phÃ­
   */
  async remove(id: string): Promise<{ message: string }> {
    const existing = await this.otherCostModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Other cost not found');

    const deleted = await this.otherCostModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Other cost not found');
    await this.triggerRecalculateForDates([existing.date as any]);
    return { message: 'Xóa chi phí thành công' };
  }

  /**
   * Thá»‘ng kÃª tá»•ng tiá»n theo bá»™ lá»c thá»i gian (tÃ¹y chá»n)
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
  // NOTE: ÄÃ¢y lÃ  chi phÃ­ váº­n hÃ nh (Account Payable - AP)

  /**
   * Tá»•ng há»£p chi phÃ­ váº­n hÃ nh (Operating Expenses) cho Financial Control
   * CFO v3.1: Tá»‘i giáº£n nhÆ°ng Ä‘á»§ cho Committed + Forecast
   */
  async getCashflowSummary(windowDays: number = 14): Promise<{
    // === Tá»”NG Há»¢P ===
    totalOpsPaid: number;             // Chi phÃ­ Ä‘Ã£ tráº£ (cash-out)
    totalOpsUnpaid: number;           // Chi phÃ­ chÆ°a tráº£ (AP)
    totalOpsDue14d: number;           // Äáº¿n háº¡n trong windowDays (Committed)
    
    // === FORECAST 7 NGÃ€Y ===
    dueByDay7d: {
      date: string;                   // YYYY-MM-DD
      amount: number;
      count: number;
    }[];
    
    // === PHÃ‚N LOáº I ===
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

    // === 1. Tá»”NG Há»¢P ===
    // Tá»•ng Ä‘Ã£ tráº£ (isConfirmed = true)
    const paidAgg = await this.otherCostModel.aggregate([
      { $match: { isConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalOpsPaid = paidAgg[0]?.total || 0;

    // Tá»•ng chÆ°a tráº£ (unpaid)
    const unpaidAgg = await this.otherCostModel.aggregate([
      { $match: { isConfirmed: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalOpsUnpaid = unpaidAgg[0]?.total || 0;

    // Äáº¿n háº¡n trong windowDays (Committed)
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
      const msg = `[Ops] ${missingDueDateCount} khoáº£n chÆ°a chi thiáº¿u dueDate`;
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
      const msg = `[Ops] ${overdueCount} khoáº£n quÃ¡ háº¡n, tá»•ng ${overdueAmount.toLocaleString('vi-VN')} VNÄ`;
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

