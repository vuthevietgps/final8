import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { OptimalSpendSnapshot, OptimalSpendSnapshotDocument } from './schemas/optimal-spend-snapshot.schema';
import {
  AdGroupPerformance,
  OptimalSpendSuggestion,
  AdGroupProfitSummary
} from './interfaces/ad-group-performance.interface';

@Injectable()
export class AdGroupProfitReportService {
  private readonly logger = new Logger(AdGroupProfitReportService.name);

  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(OptimalSpendSnapshot.name)
    private readonly snapshotModel: Model<OptimalSpendSnapshotDocument>,
  ) {}

  /**
   * Ưu tiên lọc theo orderDate để đồng bộ với các báo cáo lợi nhuận theo ngày đơn.
   * Fallback createdAt cho dữ liệu legacy chưa có orderDate.
   */
  private buildDateRangeMatch(startDate: Date, endDate: Date): any {
    return {
      $or: [
        { orderDate: { $gte: startDate, $lte: endDate } },
        { orderDate: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
        { orderDate: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
  }

  private getEffectiveOrderDateExpression(): any {
    return { $ifNull: ['$orderDate', '$createdAt'] };
  }

  /**
   * Lấy performance report cho từng ad group
   * @param params - Tham số lọc (từ ngày, đến ngày, adGroupIds)
   */
  async getAdGroupPerformanceReport(params?: {
    startDate?: Date;
    endDate?: Date;
    adGroupIds?: string[];
    minOrders?: number;
    onlyFinalized?: boolean; // Chỉ tính đơn đã kết thúc (thành công + hoàn)
  }): Promise<AdGroupPerformance[]> {
    const startDate = params?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = params?.endDate || new Date();
    const minOrders = params?.minOrders || 1;
    const onlyFinalized = params?.onlyFinalized ?? true; // Mặc định chỉ tính đơn đã kết thúc

    // Build match conditions
    const matchConditions: any = {
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null },
      netProfit: { $exists: true },
      ...this.buildDateRangeMatch(startDate, endDate),
    };

    // Chỉ tính đơn đã kết thúc (Giao thành công hoặc Hàng hoàn)
    // Đơn hoàn sẽ có netProfit âm → giảm ROI thực tế
    if (onlyFinalized) {
      matchConditions.orderStatus = { 
        $in: ['Giao thành công', 'Hàng hoàn', 'Đã đối soát', 'Hoàn thành'] 
      };
    }

    if (params?.adGroupIds && params.adGroupIds.length > 0) {
      matchConditions.adGroupId = { $in: params.adGroupIds };
    }

    // Aggregate orders by adGroupId
    const results = await this.orderModel.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$adGroupId',
          totalOrders: { $sum: 1 },
          // Đơn hoàn: codCollectedBySupplier = 0, nên tự động không tính vào revenue
          totalRevenue: { $sum: '$codCollectedBySupplier' },
          // Đơn hoàn: netProfit thường âm (mất phí ship) → giảm tổng profit
          totalNetProfit: { $sum: '$netProfit' },
          totalAdsSpent: { $sum: '$advertisingCost' },
          totalProductCost: { $sum: '$productCost' },
          totalShippingFee: { $sum: '$shippingFee' },
          
          // Đếm riêng đơn thành công và hoàn
          successOrders: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /giao thành công|đã đối soát|hoàn thành/i } },
                1,
                0
              ]
            }
          },
          returnOrders: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /hàng hoàn|hoàn hàng/i } },
                1,
                0
              ]
            }
          },
          // Profit từ đơn thành công
          successProfit: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /giao thành công|đã đối soát|hoàn thành/i } },
                '$netProfit',
                0
              ]
            }
          },
          // Loss từ đơn hoàn (thường âm)
          returnLoss: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /hàng hoàn|hoàn hàng/i } },
                '$netProfit',
                0
              ]
            }
          },
          
          // Phân loại theo orderStatus
          realizedProfit: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /giao thành công/i } },
                    { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /đã đối soát/i } },
                    { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /hoàn thành/i } }
                  ]
                },
                '$netProfit',
                0
              ]
            }
          },
          pendingProfit: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /đang giao/i } },
                    { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /chờ lấy/i } }
                  ]
                },
                '$netProfit',
                0
              ]
            }
          },
          riskyProfit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /giao thành công/i } } },
                    { $not: { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /đang giao/i } } },
                    { $not: { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /chờ lấy/i } } }
                  ]
                },
                '$netProfit',
                0
              ]
            }
          },
          
          // Chi tiết theo status
          orderStatuses: { $push: '$orderStatus' },
          orderProfits: { $push: { status: '$orderStatus', profit: '$netProfit', revenue: '$codCollectedBySupplier' } }
        }
      },
      {
        $match: {
          totalOrders: { $gte: minOrders }
        }
      }
    ]);

    // Filter và enrich với thông tin ad group
    const performances: AdGroupPerformance[] = [];
    
    for (const result of results) {
      const adGroupId = result._id;
      
      // Lấy thông tin ad group
      const adGroup = await this.adGroupModel.findOne({ adGroupId }).lean();
      const adGroupName = adGroup?.name || adGroupId;

      const totalRevenue = result.totalRevenue || 0;
      const totalAdsSpent = result.totalAdsSpent || 0;
      const totalNetProfit = result.totalNetProfit || 0;
      const totalOrders = result.totalOrders || 0;

      const roi = totalAdsSpent > 0 ? (totalNetProfit / totalAdsSpent) * 100 : 0;
      const profitMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      const avgDailyOrders = totalOrders / daysInPeriod;
      const avgDailyRevenue = totalRevenue / daysInPeriod;
      const avgDailyProfit = totalNetProfit / daysInPeriod;
      const avgDailySpent = totalAdsSpent / daysInPeriod;

      // Group orders by status
      const statusMap = new Map<string, { count: number; revenue: number; profit: number }>();
      for (const item of result.orderProfits) {
        const status = item.status || 'Unknown';
        const existing = statusMap.get(status) || { count: 0, revenue: 0, profit: 0 };
        existing.count += 1;
        existing.revenue += item.revenue || 0;
        existing.profit += item.profit || 0;
        statusMap.set(status, existing);
      }

      const ordersByStatus = Array.from(statusMap.entries()).map(([status, data]) => ({
        status,
        count: data.count,
        revenue: data.revenue,
        profit: data.profit
      }));

      // Tính tỷ lệ hoàn hàng
      const successOrders = result.successOrders || 0;
      const returnOrders = result.returnOrders || 0;
      const returnRate = totalOrders > 0 ? (returnOrders / totalOrders) * 100 : 0;
      const successProfit = result.successProfit || 0;
      const returnLoss = result.returnLoss || 0; // Thường là số âm

      performances.push({
        adGroupId,
        adGroupName,
        totalOrders,
        successOrders,
        returnOrders,
        returnRate,
        totalRevenue,
        totalCost: result.totalProductCost + result.totalShippingFee + totalAdsSpent,
        totalAdsSpent,
        totalNetProfit, // = successProfit + returnLoss (đã bao gồm loss từ hoàn)
        successProfit,
        returnLoss,
        roi,
        profitMargin,
        averageOrderValue,
        realizedProfit: result.realizedProfit || 0,
        pendingProfit: result.pendingProfit || 0,
        riskyProfit: result.riskyProfit || 0,
        ordersByStatus,
        startDate,
        endDate,
        daysInPeriod,
        avgDailyOrders,
        avgDailyRevenue,
        avgDailyProfit,
        avgDailySpent
      });
    }

    return performances.sort((a, b) => b.totalNetProfit - a.totalNetProfit);
  }

  /**
   * Lấy dữ liệu chi phí/lợi nhuận theo ngày của một ad group
   * Dùng để phân tích marginal efficiency
   */
  private async getDailySpendProfitHistory(
    adGroupId: string,
    lookbackDays: number = 30
  ): Promise<{ date: Date; spend: number; profit: number; orders: number; returnOrders: number }[]> {
    const endDate = new Date();
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const results = await this.orderModel.aggregate([
      {
        $match: {
          adGroupId,
          ...this.buildDateRangeMatch(startDate, endDate),
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn', 'Đã đối soát', 'Hoàn thành'] }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: this.getEffectiveOrderDateExpression() }
          },
          spend: { $sum: '$advertisingCost' },
          profit: { $sum: '$netProfit' },
          orders: { $sum: 1 },
          returnOrders: {
            $sum: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$orderStatus', ''] }, regex: /hàng hoàn|hoàn hàng/i } },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return results.map(r => ({
      date: new Date(r._id),
      spend: r.spend || 0,
      profit: r.profit || 0,
      orders: r.orders || 0,
      returnOrders: r.returnOrders || 0
    }));
  }

  /**
   * Tính Optimal Spend dựa trên Marginal Efficiency Analysis
   * 
   * Thuật toán:
   * 1. Lấy dữ liệu chi phí/lợi nhuận theo ngày (30 ngày)
   * 2. Tính marginal efficiency tại mỗi mức chi phí
   * 3. Tìm điểm mà marginal efficiency bắt đầu giảm (diminishing returns)
   * 4. Đó là optimal spend
   * 
   * Marginal Efficiency = Δ Profit / Δ Spend
   * - > 1: Mỗi đồng chi thêm mang về > 1 đồng lợi nhuận → SCALE
   * - = 1: Break-even → MAINTAIN
   * - < 1: Diminishing returns → gần optimal
   * - < 0: Lỗ → DECREASE
   */
  async getOptimalSpendSuggestions(params?: {
    lookbackDays?: number;
    minROI?: number;
    minProfit?: number;
  }): Promise<OptimalSpendSuggestion[]> {
    const lookbackDays = params?.lookbackDays || 30; // Tăng lên 30 ngày để có đủ data
    const minROI = params?.minROI || 0; // Bỏ filter minROI, hiển thị tất cả
    const minProfit = params?.minProfit || 0;

    const endDate = new Date();
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Lấy performance report tổng quan
    const performances = await this.getAdGroupPerformanceReport({
      startDate,
      endDate,
      minOrders: 1,
      onlyFinalized: true
    });

    const suggestions: OptimalSpendSuggestion[] = [];

    for (const perf of performances) {
      // Lấy dữ liệu chi phí/lợi nhuận theo ngày
      const dailyHistory = await this.getDailySpendProfitHistory(perf.adGroupId, lookbackDays);
      
      if (dailyHistory.length < 3) {
        // Không đủ dữ liệu để phân tích
        continue;
      }

      // Sắp xếp theo mức chi phí để phân tích marginal efficiency
      const sortedBySpend = [...dailyHistory].sort((a, b) => a.spend - b.spend);
      
      // Tính marginal efficiency tại mỗi mức
      const marginalData: { spend: number; profit: number; marginalEfficiency: number }[] = [];
      for (let i = 1; i < sortedBySpend.length; i++) {
        const prev = sortedBySpend[i - 1];
        const curr = sortedBySpend[i];
        const deltaSpend = curr.spend - prev.spend;
        const deltaProfit = curr.profit - prev.profit;
        
        if (deltaSpend > 0) {
          marginalData.push({
            spend: curr.spend,
            profit: curr.profit,
            marginalEfficiency: deltaProfit / deltaSpend
          });
        }
      }

      // Tìm optimal spend: điểm mà marginal efficiency gần 1 nhất (hoặc bắt đầu < 1)
      let optimalSpend = perf.avgDailySpent; // Default = chi phí hiện tại
      let optimalEfficiency = 1;
      
      if (marginalData.length > 0) {
        // Tìm điểm có marginal efficiency cao nhất nhưng vẫn > 0
        const goodPoints = marginalData.filter(d => d.marginalEfficiency > 0);
        if (goodPoints.length > 0) {
          // Tìm điểm có marginal efficiency gần 1 nhất (điểm optimal thực sự)
          const sorted = goodPoints.sort((a, b) => 
            Math.abs(a.marginalEfficiency - 1) - Math.abs(b.marginalEfficiency - 1)
          );
          optimalSpend = sorted[0].spend;
          optimalEfficiency = sorted[0].marginalEfficiency;
        }

        // Nếu tất cả marginal efficiency > 1, có thể tăng thêm
        const allPositive = marginalData.every(d => d.marginalEfficiency > 1);
        if (allPositive && marginalData.length > 0) {
          // Chưa đạt điểm optimal, có thể tăng thêm 20%
          optimalSpend = Math.max(...marginalData.map(d => d.spend)) * 1.2;
        }

        // Nếu marginal efficiency cuối cùng < 0, cần giảm
        const lastMarginal = marginalData[marginalData.length - 1];
        if (lastMarginal && lastMarginal.marginalEfficiency < 0) {
          // Tìm điểm cuối cùng có marginal > 0
          const positivePoints = marginalData.filter(d => d.marginalEfficiency > 0);
          if (positivePoints.length > 0) {
            optimalSpend = positivePoints[positivePoints.length - 1].spend;
          }
        }
      }

      // Tính các metrics
      const currentSpend = perf.avgDailySpent;
      const currentROI = perf.roi;
      const returnRate = perf.returnRate || 0;

      // Xác định action và reason
      let scaleAction: 'increase' | 'decrease' | 'maintain' | 'kill';
      let reason: string;
      let confidence: number;

      const spendDiff = optimalSpend - currentSpend;
      const spendDiffPercent = currentSpend > 0 ? (spendDiff / currentSpend) * 100 : 0;

      if (currentROI < 0 || returnRate > 40) {
        scaleAction = 'kill';
        optimalSpend = 0;
        confidence = 95;
        reason = `ROI âm (${currentROI.toFixed(0)}%) hoặc hoàn quá cao (${returnRate.toFixed(0)}%) - TẠM DỪNG`;
      } else if (spendDiffPercent > 10) {
        scaleAction = 'increase';
        confidence = Math.min(90, 60 + marginalData.filter(d => d.marginalEfficiency > 1).length * 5);
        reason = `Optimal cao hơn ${spendDiffPercent.toFixed(0)}% - có thể TĂNG DẦN (tối đa +20%/lần)`;
      } else if (spendDiffPercent < -10) {
        scaleAction = 'decrease';
        confidence = Math.min(90, 60 + marginalData.filter(d => d.marginalEfficiency < 1).length * 5);
        reason = `Đang chi quá optimal ${Math.abs(spendDiffPercent).toFixed(0)}% - nên GIẢM`;
      } else {
        scaleAction = 'maintain';
        confidence = 80;
        reason = `Chi phí hiện tại GẦN OPTIMAL (±10%)`;
      }

      // Thêm cảnh báo tỷ lệ hoàn
      if (returnRate > 20) {
        reason += ` ⚠️ Hoàn ${returnRate.toFixed(0)}%`;
      }

      // Format last 7 days
      const last7Days = dailyHistory.slice(-7).map(d => ({
        date: d.date.toISOString().split('T')[0],
        spent: d.spend,
        profit: d.profit,
        roi: d.spend > 0 ? (d.profit / d.spend) * 100 : 0,
        orders: d.orders
      }));

      // Expected values (dựa trên marginal analysis)
      const expectedROI = optimalEfficiency > 0 ? currentROI * (1 + (optimalEfficiency - 1) * 0.1) : currentROI * 0.9;
      const expectedProfit = optimalSpend * (expectedROI / 100);

      suggestions.push({
        adGroupId: perf.adGroupId,
        adGroupName: perf.adGroupName,
        
        // Hiện tại
        lastSpend: currentSpend,
        lastProfit: perf.avgDailyProfit,
        currentROI,
        
        // Thống kê đơn
        returnRate,
        totalOrders: perf.totalOrders,
        successOrders: perf.successOrders,
        returnOrders: perf.returnOrders,
        
        // GỢI Ý TỐI ƯU (dựa trên marginal efficiency)
        suggestedSpend: optimalSpend,
        appliedSpend: optimalSpend, // Không áp dụng constraint, chỉ là gợi ý
        expectedProfit,
        expectedROI,
        
        // Thông tin
        scaleAction,
        reason,
        confidence,
        minBudget: 50_000,
        maxBudget: 10_000_000,
        last7Days
      });
    }

    return suggestions.sort((a, b) => b.currentROI - a.currentROI);
  }

  /**
   * Lấy tổng quan profit của tất cả ad groups
   */
  async getProfitSummary(params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<AdGroupProfitSummary> {
    const performances = await this.getAdGroupPerformanceReport(params);

    const totalAdGroups = performances.length;
    const totalRevenue = performances.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalProfit = performances.reduce((sum, p) => sum + p.totalNetProfit, 0);
    const totalAdsSpent = performances.reduce((sum, p) => sum + p.totalAdsSpent, 0);
    const averageROI = totalAdsSpent > 0 ? (totalProfit / totalAdsSpent) * 100 : 0;

    // Top 5 by profit
    const topByProfit = performances.slice(0, 5);

    // Top 5 by ROI
    const topByROI = [...performances].sort((a, b) => b.roi - a.roi).slice(0, 5);

    // Low performers (ROI < 50%)
    const lowPerformers = performances.filter(p => p.roi < 50);

    // Profit by status
    const profitByStatus = {
      realized: performances.reduce((sum, p) => sum + p.realizedProfit, 0),
      pending: performances.reduce((sum, p) => sum + p.pendingProfit, 0),
      risky: performances.reduce((sum, p) => sum + p.riskyProfit, 0)
    };

    return {
      totalAdGroups,
      totalRevenue,
      totalProfit,
      totalAdsSpent,
      averageROI,
      topByProfit,
      topByROI,
      lowPerformers,
      profitByStatus
    };
  }

  /**
   * CRON JOB: Cập nhật Optimal Spend hàng ngày lúc 06:00
   * Lưu snapshot vào database để nhân viên xem và điều chỉnh
   */
  @Cron('0 0 6 * * *') // 06:00 mỗi ngày
  async updateDailyOptimalSpendSnapshot() {
    this.logger.log('🔄 [CRON] Đang cập nhật Optimal Spend Suggestions...');
    
    try {
      const suggestions = await this.getOptimalSpendSuggestions({ lookbackDays: 30 });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let created = 0;
      let updated = 0;

      for (const s of suggestions) {
        const spendDiffPercent = s.lastSpend > 0 
          ? ((s.suggestedSpend - s.lastSpend) / s.lastSpend) * 100 
          : 0;

        const data = {
          adGroupId: s.adGroupId,
          adGroupName: s.adGroupName,
          date: today,
          currentSpend: s.lastSpend,
          optimalSpend: s.suggestedSpend,
          spendDiffPercent,
          currentROI: s.currentROI,
          expectedROI: s.expectedROI,
          returnRate: s.returnRate,
          totalOrders: s.totalOrders,
          successOrders: s.successOrders,
          returnOrders: s.returnOrders,
          scaleAction: s.scaleAction,
          reason: s.reason,
          confidence: s.confidence,
          last7Days: s.last7Days
        };

        // Upsert: update nếu đã có, create nếu chưa
        const result = await this.snapshotModel.updateOne(
          { adGroupId: s.adGroupId, date: today },
          { $set: data },
          { upsert: true }
        );

        if (result.upsertedCount > 0) created++;
        else if (result.modifiedCount > 0) updated++;
      }

      this.logger.log(`✅ [CRON] Optimal Spend updated: ${created} created, ${updated} updated`);
      return { created, updated, total: suggestions.length };
    } catch (error) {
      this.logger.error('❌ [CRON] Failed to update Optimal Spend', error);
      throw error;
    }
  }

  /**
   * Lấy snapshot Optimal Spend mới nhất
   * Dùng cho frontend hiển thị gợi ý cho nhân viên
   */
  async getLatestOptimalSpendSnapshots(): Promise<OptimalSpendSnapshot[]> {
    // Lấy ngày mới nhất có data
    const latestDoc = await this.snapshotModel.findOne().sort({ date: -1 }).lean();
    if (!latestDoc) return [];

    // Lấy tất cả snapshot của ngày đó
    return this.snapshotModel
      .find({ date: latestDoc.date })
      .sort({ currentROI: -1 })
      .lean();
  }

  /**
   * Lấy lịch sử optimal spend của một ad group
   */
  async getOptimalSpendHistory(adGroupId: string, days: number = 30): Promise<OptimalSpendSnapshot[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.snapshotModel
      .find({ adGroupId, date: { $gte: startDate } })
      .sort({ date: -1 })
      .lean();
  }

  /**
   * Trigger manual update (cho testing hoặc on-demand)
   */
  async triggerOptimalSpendUpdate() {
    return this.updateDailyOptimalSpendSnapshot();
  }
}
