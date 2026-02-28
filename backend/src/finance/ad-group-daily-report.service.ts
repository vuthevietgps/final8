import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from './schemas/ad-group-daily-report.schema';
import { CapitalAllocationSnapshot, CapitalAllocationSnapshotDocument } from './schemas/capital-allocation-snapshot.schema';
import { AdsDailySpending, AdsDailySpendingDocument } from './schemas/ads-daily-spending.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AdGroupDailyReportService {
  private readonly logger = new Logger(AdGroupDailyReportService.name);

  constructor(
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdGroupDailyReport.name) private readonly reportModel: Model<AdGroupDailyReportDocument>,
    @InjectModel(CapitalAllocationSnapshot.name) private readonly snapshotModel: Model<CapitalAllocationSnapshotDocument>,
    @InjectModel(AdsDailySpending.name) private readonly adsSpendingModel: Model<AdsDailySpendingDocument>,
  ) {}

  /**
   * Đồng bộ dữ liệu từ ordertest2 vào collection ad_group_daily_reports
   * Chạy tự động mỗi ngày lúc 3:00 AM sau khi recalculate orders
   */
  @Cron('0 3 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async syncFromOrderTest2(targetDate?: string) {
    const date = targetDate || new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
    this.logger.log(`🔄 Bắt đầu đồng bộ ad group daily report cho ngày ${date}`);

    try {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Aggregate từ ordertest2
      const aggregated = await this.orderModel.aggregate([
        {
          $match: {
            orderDate: { $gte: startDate, $lte: endDate },
            adGroupId: { $exists: true, $nin: [null, '', '0'] }
          }
        },
        {
          $group: {
            _id: '$adGroupId',
            netProfit: { $sum: '$netProfit' },
            adsCost: { $sum: '$adsCost' }
          }
        },
        {
          $project: {
            adGroupId: '$_id',
            netProfit: 1,
            adsCost: 1
          }
        }
      ]);

      // Lấy thông tin ad group
      const adGroupIds = aggregated.map(item => item.adGroupId);
      const adGroups = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).exec();
      const adGroupMap = new Map(adGroups.map(ag => [ag.adGroupId, ag]));

      // Upsert vào collection
      const bulkOps = aggregated.map(item => {
        const adGroup = adGroupMap.get(item.adGroupId);
        return {
          updateOne: {
            filter: { date, adGroupId: item.adGroupId },
            update: {
              $set: {
                date,
                adGroupId: item.adGroupId,
                adGroupName: adGroup?.name || '',
                platform: adGroup?.platform || '',
                adsCost: item.adsCost,
                netProfit: item.netProfit,
                syncedAt: new Date()
              }
            },
            upsert: true
          }
        };
      });

      if (bulkOps.length > 0) {
        const result = await this.reportModel.bulkWrite(bulkOps);
        this.logger.log(`✅ Đồng bộ thành công: ${result.upsertedCount} mới, ${result.modifiedCount} cập nhật`);

        // Tự động cập nhật reinvestmentUsed với tổng chi phí ads trong ngày
        const totalAdsCost = aggregated.reduce((sum, item) => sum + item.adsCost, 0);
        if (totalAdsCost > 0) {
          await this.updateReinvestmentUsed(date, totalAdsCost);
        }
      } else {
        this.logger.log(`⚠️ Không có dữ liệu để đồng bộ cho ngày ${date}`);
      }

      return { success: true, date, recordsProcessed: bulkOps.length };
    } catch (error) {
      this.logger.error(`❌ Lỗi đồng bộ ad group daily report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Báo cáo chi phí và lợi nhuận nhóm quảng cáo theo ngày
   * Đọc từ collection ad_group_daily_reports
   */
  async getAdGroupDailyReport(params: {
    fromDate?: string;
    toDate?: string;
    adGroupId?: string;
    platform?: string;
  }) {
    const { fromDate, toDate, adGroupId, platform } = params;

    // Build query
    const query: any = {};

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        query.date.$gte = fromDate;
      }
      if (toDate) {
        query.date.$lte = toDate;
      }
    }

    if (adGroupId) {
      query.adGroupId = adGroupId;
    }

    if (platform) {
      query.platform = platform;
    }

    // Lấy dữ liệu từ collection
    const details = await this.reportModel
      .find(query)
      .sort({ date: -1, netProfit: -1 })
      .lean()
      .exec();

    // Tính tổng hợp
    const summary = details.reduce(
      (acc, item) => {
        acc.totalAdsCost += item.adsCost;
        acc.totalNetProfit += item.netProfit;
        return acc;
      },
      {
        totalAdsCost: 0,
        totalNetProfit: 0
      }
    );

    return {
      summary,
      details,
      dateRange: {
        from: fromDate || '',
        to: toDate || '',
      },
    };
  }

  /**
   * Top nhóm quảng cáo theo lợi nhuận thuần
   */
  async getTopAdGroups(params: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
    sortBy?: 'profit' | 'adsCost';
  }) {
    const { fromDate, toDate, limit = 10, sortBy = 'profit' } = params;

    // Build query
    const query: any = {};

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) {
        query.date.$gte = fromDate;
      }
      if (toDate) {
        query.date.$lte = toDate;
      }
    }

    // Aggregate by adGroupId
    const pipeline: any[] = [
      { $match: query },
      {
        $group: {
          _id: '$adGroupId',
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
          adsCost: { $sum: '$adsCost' },
          netProfit: { $sum: '$netProfit' }
        }
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id',
          adGroupName: 1,
          platform: 1,
          adsCost: 1,
          netProfit: 1
        }
      }
    ];

    // Sort based on sortBy
    const sortField = sortBy === 'profit' ? 'netProfit' : 'adsCost';
    pipeline.push({ $sort: { [sortField]: -1 } });
    pipeline.push({ $limit: limit });

    const topAdGroups = await this.reportModel.aggregate(pipeline).exec();
    return { topAdGroups };
  }

  /**
   * Tính chi phí gợi ý tối ưu cho từng ad group
   * Sử dụng thuật toán lợi nhuận biên giảm dần (Diminishing Marginal Profit)
   * 
   * Logic:
   * 1. Lấy lịch sử chi phí và lợi nhuận theo ngày của từng ad group
   * 2. Sắp xếp theo mức chi phí tăng dần
   * 3. Tính marginal profit = Δ profit / Δ spend tại mỗi mức
   * 4. Tìm điểm optimal: marginal profit gần 0 nhất (điểm tối ưu)
   * 5. Nếu marginal > 0 ở tất cả các mức → có thể tăng chi phí
   * 6. Nếu marginal < 0 → đang chi quá nhiều, cần giảm
   */
  async getOptimalSpendSuggestions(): Promise<{
    suggestions: Map<string, { suggestedSpend: number; suggestedSpendWithCap: number; reason: string; confidence: number }>;
    adGroupSuggestions: Array<{
      adGroupId: string;
      adGroupName: string;
      platform: string;
      productCategoryId?: string;
      productCategoryName?: string;
      spendYesterday: number;
      profitYesterday: number;
      currentAvgSpend: number;
      /** CFO Spec v3.0: Baseline = max(spendYesterday, avgLast3Days, 200k) - dùng để tính cap */
      baselineSpend: number;
      suggestedSpend: number;
      /** Chi phí gợi ý có áp dụng trần 20% tăng / 30% giảm từ baselineSpend */
      suggestedSpendWithCap: number;
      reason: string;
      confidence: number;
      consecutiveNegativeDays: number;
      hasAlert: boolean;
      marginalAnalysis: {
        dataPoints: number;
        lastMarginalProfit: number;
        avgMarginalProfit: number;
      };
    }>;
    totalSuggestedSpend: number;
    /** Tổng chi phí gợi ý có áp dụng trần % - dùng cho Financial Control */
    totalSuggestedSpendWithCap: number;
    totalCurrentSpend: number;
  }> {
    // Lấy tất cả ad group có dữ liệu trong 30 ngày qua
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Lấy ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Aggregate: lấy lịch sử theo ngày cho từng ad group
    const historyByAdGroup = await this.reportModel.aggregate([
      { $match: { date: { $gte: dateStr } } },
      { $sort: { date: -1 } }, // Sort by date desc để tính consecutive negative days
      {
        $group: {
          _id: '$adGroupId',
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
          records: {
            $push: {
              date: '$date',
              adsCost: '$adsCost',
              netProfit: '$netProfit'
            }
          },
          totalSpend: { $sum: '$adsCost' },
          totalProfit: { $sum: '$netProfit' },
          dayCount: { $sum: 1 }
        }
      }
    ]).exec();

    // Lấy thông tin ad group (platform, productCategory)
    const adGroupIds = historyByAdGroup.map(ag => ag._id);
    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } })
      .populate('productCategoryId', 'name')
      .exec();
    const adGroupMap = new Map(adGroups.map(ag => [ag.adGroupId, ag]));

    const suggestions = new Map<string, { suggestedSpend: number; suggestedSpendWithCap: number; reason: string; confidence: number }>();
    const adGroupSuggestions: Array<any> = [];

    for (const ag of historyByAdGroup) {
      const adGroupId = ag._id;
      const adGroupInfo = adGroupMap.get(adGroupId);
      const adGroupName = ag.adGroupName || adGroupInfo?.name || adGroupId;
      const platform = ag.platform || adGroupInfo?.platform || 'unknown';
      const productCategoryId = adGroupInfo?.productCategoryId?._id?.toString() || '';
      const productCategoryName = (adGroupInfo?.productCategoryId as any)?.name || '';
      
      const records = ag.records || [];
      const dayCount = ag.dayCount || 1;
      const currentAvgSpend = ag.totalSpend / dayCount;
      
      // Tìm dữ liệu hôm qua
      const yesterdayRecord = records.find((r: any) => r.date === yesterdayStr);
      const spendYesterday = yesterdayRecord?.adsCost || 0;
      const profitYesterday = yesterdayRecord?.netProfit || 0;
      
      // CFO Spec v3.0: Tính baseline từ max(spendYesterday, avgLast3Days, minStartBudget)
      const MIN_START_BUDGET = 60000; // Ngân sách tối thiểu 60k VNĐ
      const sortedByDateDescForAvg = [...records].sort((a: any, b: any) => b.date.localeCompare(a.date));
      const last3DaysRecords = sortedByDateDescForAvg.slice(0, 3);
      const avgLast3Days = last3DaysRecords.length > 0 
        ? last3DaysRecords.reduce((sum: number, r: any) => sum + (r.adsCost || 0), 0) / last3DaysRecords.length 
        : 0;
      const baselineSpend = Math.max(spendYesterday, avgLast3Days, MIN_START_BUDGET);
      
      // Tính số ngày liên tiếp có lợi nhuận âm (từ gần nhất)
      let consecutiveNegativeDays = 0;
      const sortedByDateDesc = [...records].sort((a: any, b: any) => b.date.localeCompare(a.date));
      for (const rec of sortedByDateDesc) {
        if (rec.netProfit < 0) {
          consecutiveNegativeDays++;
        } else {
          break;
        }
      }

      if (records.length < 3) {
        // Không đủ dữ liệu - giữ nguyên
        const suggestedSpend = Math.round(currentAvgSpend);
        const suggestedSpendWithCap = suggestedSpend; // Không đổi
        const hasAlert = consecutiveNegativeDays >= 3;
        const suggestion = {
          suggestedSpend,
          suggestedSpendWithCap,
          reason: 'Không đủ dữ liệu (cần ≥3 ngày)',
          confidence: 30
        };
        suggestions.set(adGroupId, suggestion);
        adGroupSuggestions.push({
          adGroupId,
          adGroupName,
          platform,
          productCategoryId,
          productCategoryName,
          spendYesterday,
          profitYesterday,
          currentAvgSpend: Math.round(currentAvgSpend),
          suggestedSpend,
          suggestedSpendWithCap,
          reason: suggestion.reason,
          confidence: suggestion.confidence,
          consecutiveNegativeDays,
          hasAlert,
          marginalAnalysis: { dataPoints: records.length, lastMarginalProfit: 0, avgMarginalProfit: 0 }
        });
        continue;
      }

      // Sắp xếp theo mức chi phí tăng dần
      const sortedRecords = [...records].sort((a, b) => a.adsCost - b.adsCost);

      // Tính marginal profit tại mỗi mức
      const marginalProfits: number[] = [];
      for (let i = 1; i < sortedRecords.length; i++) {
        const prev = sortedRecords[i - 1];
        const curr = sortedRecords[i];
        const deltaSpend = curr.adsCost - prev.adsCost;
        const deltaProfit = curr.netProfit - prev.netProfit;

        if (deltaSpend > 0) {
          marginalProfits.push(deltaProfit / deltaSpend);
        }
      }

      if (marginalProfits.length === 0) {
        const suggestedSpend = Math.round(currentAvgSpend);
        const suggestedSpendWithCap = suggestedSpend; // Không đổi
        const hasAlert = consecutiveNegativeDays >= 3;
        const suggestion = {
          suggestedSpend,
          suggestedSpendWithCap,
          reason: 'Chi phí không đổi giữa các ngày',
          confidence: 40
        };
        suggestions.set(adGroupId, suggestion);
        adGroupSuggestions.push({
          adGroupId,
          adGroupName,
          platform,
          productCategoryId,
          productCategoryName,
          spendYesterday,
          profitYesterday,
          currentAvgSpend: Math.round(currentAvgSpend),
          suggestedSpend,
          suggestedSpendWithCap,
          reason: suggestion.reason,
          confidence: suggestion.confidence,
          consecutiveNegativeDays,
          hasAlert,
          marginalAnalysis: { dataPoints: records.length, lastMarginalProfit: 0, avgMarginalProfit: 0 }
        });
        continue;
      }

      const lastMarginalProfit = marginalProfits[marginalProfits.length - 1];
      const avgMarginalProfit = marginalProfits.reduce((a, b) => a + b, 0) / marginalProfits.length;

      // Tìm điểm optimal dựa trên marginal profit
      let suggestedSpend: number;
      let reason: string;
      let confidence: number;

      if (avgMarginalProfit > 1) {
        // Marginal profit > 1: mỗi đồng chi thêm mang về > 1 đồng lợi nhuận → TĂNG
        suggestedSpend = Math.min(currentAvgSpend * 1.2, currentAvgSpend + 500000);
        reason = `Marginal profit cao (${avgMarginalProfit.toFixed(2)}) → Có thể TĂNG 20%`;
        confidence = Math.min(85, 60 + marginalProfits.filter(m => m > 1).length * 5);
      } else if (avgMarginalProfit > 0) {
        // 0 < Marginal < 1: đang gần điểm optimal
        if (lastMarginalProfit > 0.5) {
          suggestedSpend = currentAvgSpend * 1.1;
          reason = `Marginal profit dương (${avgMarginalProfit.toFixed(2)}) → Có thể TĂNG NHẸ 10%`;
          confidence = 70;
        } else if (lastMarginalProfit > 0) {
          suggestedSpend = currentAvgSpend;
          reason = `Đang ở gần điểm OPTIMAL (marginal ≈ ${avgMarginalProfit.toFixed(2)})`;
          confidence = 80;
        } else {
          suggestedSpend = currentAvgSpend * 0.9;
          reason = `Marginal cuối âm → Nên GIẢM 10%`;
          confidence = 75;
        }
      } else {
        // Marginal < 0: chi thêm = lỗ thêm → GIẢM
        suggestedSpend = currentAvgSpend * 0.7;
        reason = `Marginal profit ÂM (${avgMarginalProfit.toFixed(2)}) → Cần GIẢM 30%`;
        confidence = 85;
      }

      // Đảm bảo suggestedSpend không âm và có giới hạn
      suggestedSpend = Math.max(0, Math.round(suggestedSpend));

      // CFO Spec v3.0: Tính cap từ baselineSpend (không phải currentAvgSpend)
      // baselineSpend = max(spendYesterday, avgLast3Days, 200k)
      const upperCap = Math.round(baselineSpend * 1.20);
      const lowerCap = Math.round(baselineSpend * 0.70);
      const suggestedSpendWithCap = Math.max(lowerCap, Math.min(upperCap, suggestedSpend));
      
      // Alert khi lỗ liên tiếp ≥3 ngày
      const hasAlert = consecutiveNegativeDays >= 3;

      const suggestion = { suggestedSpend, suggestedSpendWithCap, reason, confidence };
      suggestions.set(adGroupId, suggestion);
      adGroupSuggestions.push({
        adGroupId,
        adGroupName,
        platform,
        productCategoryId,
        productCategoryName,
        spendYesterday,
        profitYesterday,
        currentAvgSpend: Math.round(currentAvgSpend),
        baselineSpend: Math.round(baselineSpend), // CFO Spec v3.0: baseline để tính cap
        suggestedSpend,
        suggestedSpendWithCap,
        reason,
        confidence,
        consecutiveNegativeDays,
        hasAlert,
        marginalAnalysis: {
          dataPoints: marginalProfits.length,
          lastMarginalProfit: Math.round(lastMarginalProfit * 100) / 100,
          avgMarginalProfit: Math.round(avgMarginalProfit * 100) / 100
        }
      });
    }

    // Tính tổng chi phí quảng cáo đề xuất
    const totalSuggestedSpend = adGroupSuggestions.reduce(
      (sum, item) => sum + item.suggestedSpend, 
      0
    );
    const totalSuggestedSpendWithCap = adGroupSuggestions.reduce(
      (sum, item) => sum + item.suggestedSpendWithCap, 
      0
    );
    const totalCurrentSpend = adGroupSuggestions.reduce(
      (sum, item) => sum + item.currentAvgSpend, 
      0
    );

    return { suggestions, adGroupSuggestions, totalSuggestedSpend, totalSuggestedSpendWithCap, totalCurrentSpend };
  }

  /**
   * Báo cáo chi phí và lợi nhuận kèm chi phí gợi ý
   */
  async getReportWithSuggestions(params: {
    fromDate?: string;
    toDate?: string;
    adGroupId?: string;
    platform?: string;
  }) {
    // Lấy báo cáo gốc
    const report = await this.getAdGroupDailyReport(params);

    // Lấy gợi ý chi phí
    const { suggestions } = await this.getOptimalSpendSuggestions();

    // Merge gợi ý vào details
    const detailsWithSuggestions = report.details.map((item: any) => {
      const suggestion = suggestions.get(item.adGroupId);
      return {
        ...item,
        suggestedSpend: suggestion?.suggestedSpend ?? null,
        suggestionReason: suggestion?.reason ?? null,
        suggestionConfidence: suggestion?.confidence ?? null
      };
    });

    return {
      summary: report.summary,
      details: detailsWithSuggestions,
      dateRange: report.dateRange
    };
  }

  /**
   * Cập nhật reinvestmentUsed của snapshot với chi phí ads trong ngày
   * IDEMPOTENT: Chỉ cập nhật 1 lần cho mỗi ngày, tránh trùng lặp khi re-sync
   * 
   * LOGIC:
   * 1. Tìm snapshot của ngày đó (hoặc gần nhất trước ngày đó)
   * 2. Kiểm tra đã track chi phí ngày này chưa (dựa vào ads_daily_spendings)
   * 3. Nếu chưa → Tạo record tracking + cập nhật snapshot.reinvestmentUsed
   * 4. Nếu rồi → Skip (tránh cộng trùng)
   */
  private async updateReinvestmentUsed(date: string, adsCost: number) {
    try {
      // 1. Tìm snapshot phù hợp (của ngày đó hoặc gần nhất trước đó)
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const snapshot = await this.snapshotModel
        .findOne({
          date: { $lte: endOfDay }
        })
        .sort({ date: -1 })
        .exec();

      if (!snapshot) {
        this.logger.warn(`⚠️ Không tìm thấy snapshot để cập nhật reinvestmentUsed cho ngày ${date}`);
        return;
      }

      // 2. Kiểm tra đã track chi phí ngày này chưa (IDEMPOTENCY CHECK)
      const existing = await this.adsSpendingModel.findOne({
        date,
        snapshotId: snapshot._id
      });

      if (existing) {
        this.logger.log(`ℹ️ Chi phí ads ngày ${date} đã được cập nhật vào snapshot ${snapshot.date}, skip để tránh trùng`);
        return;
      }

      // 3. Lấy breakdown chi tiết từ ad_group_daily_reports
      const reports = await this.reportModel.find({ date }).lean().exec();
      const breakdown = reports.map(r => ({
        adGroupId: r.adGroupId,
        adGroupName: r.adGroupName,
        adsCost: r.adsCost
      }));

      // 4. Tạo record tracking mới
      await this.adsSpendingModel.create({
        date,
        snapshotId: snapshot._id,
        totalAdsCost: adsCost,
        breakdown,
        syncedAt: new Date(),
        source: 'auto-sync'
      });

      // 5. Cập nhật snapshot.reinvestmentUsed
      snapshot.reinvestmentUsed += adsCost;
      await snapshot.save();

      this.logger.log(`💰 Đã cập nhật reinvestmentUsed +${adsCost.toLocaleString()} VND cho snapshot ${snapshot.date.toISOString().split('T')[0]} (tổng: ${snapshot.reinvestmentUsed.toLocaleString()})`);
    } catch (error) {
      // Nếu lỗi duplicate key (E11000) → Bỏ qua (có thể do race condition)
      if (error.code === 11000) {
        this.logger.log(`ℹ️ Chi phí ads ngày ${date} đã được cập nhật, skip`);
        return;
      }
      this.logger.error(`❌ Lỗi cập nhật reinvestmentUsed: ${error.message}`, error.stack);
    }
  }
}

