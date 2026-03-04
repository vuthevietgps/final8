import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from './schemas/ad-group-daily-report.schema';
import { CapitalAllocationSnapshot, CapitalAllocationSnapshotDocument } from './schemas/capital-allocation-snapshot.schema';
import { AdsDailySpending, AdsDailySpendingDocument } from './schemas/ads-daily-spending.schema';
import { Cron, CronExpression } from '@nestjs/schedule';

type OptimalSpendMode = 'legacy' | 'product-x';
type ReturnAssumptionSource = 'product' | 'fallback' | 'mixed';

interface SuggestionRecord {
  date: string;
  adsCost: number;
  netProfit: number;
}

interface RawHistoryByAdGroup {
  _id: string;
  adGroupName?: string;
  platform?: string;
  records: SuggestionRecord[];
  totalSpend: number;
  totalProfit: number;
  dayCount: number;
}

interface ProductXContext {
  assumedReturnRatePercent: number;
  assumptionSource: ReturnAssumptionSource;
  appliedProducts: Array<{
    productId: string;
    productName: string;
    assumedReturnRatePercent: number;
  }>;
  expectedReturnedOrders: number;
  orderCount: number;
}

interface OptimalSpendSuggestionItem {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  productCategoryId?: string;
  productCategoryName?: string;
  spendYesterday: number;
  profitYesterday: number;
  currentAvgSpend: number;
  baselineSpend: number;
  suggestedSpend: number;
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
  assumedReturnRatePercent?: number;
  assumptionSource?: ReturnAssumptionSource;
  orderCount?: number;
  expectedReturnedOrders?: number;
  appliedProducts?: Array<{
    productId: string;
    productName: string;
    assumedReturnRatePercent: number;
  }>;
  optimizationMode?: OptimalSpendMode;
}

interface OptimalSpendSuggestionResponse {
  suggestions: Map<string, { suggestedSpend: number; suggestedSpendWithCap: number; reason: string; confidence: number }>;
  adGroupSuggestions: OptimalSpendSuggestionItem[];
  totalSuggestedSpend: number;
  totalSuggestedSpendWithCap: number;
  totalCurrentSpend: number;
  mode: OptimalSpendMode;
  defaultAssumedReturnRatePercent: number;
}

@Injectable()
export class AdGroupDailyReportService {
  private readonly logger = new Logger(AdGroupDailyReportService.name);

  constructor(
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
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
   * Optimized spend suggestions.
   * - legacy: giu nguyen thuat toan cu theo net profit thuc te
   * - product-x: uoc tinh nhanh theo X% hang hoan tren san pham
   */
  async getOptimalSpendSuggestions(options?: {
    mode?: OptimalSpendMode;
    defaultAssumedReturnRatePercent?: number;
  }): Promise<OptimalSpendSuggestionResponse> {
    const mode: OptimalSpendMode = options?.mode === 'product-x' ? 'product-x' : 'legacy';
    const defaultAssumedReturnRatePercent = this.clampReturnRatePercent(
      options?.defaultAssumedReturnRatePercent,
      20,
    );

    if (mode === 'product-x') {
      return this.getOptimalSpendSuggestionsByProductX(defaultAssumedReturnRatePercent);
    }

    return this.getOptimalSpendSuggestionsLegacy(defaultAssumedReturnRatePercent);
  }

  private async getOptimalSpendSuggestionsLegacy(
    defaultAssumedReturnRatePercent: number,
  ): Promise<OptimalSpendSuggestionResponse> {
    const dateStr = this.getDateStringDaysAgo(30);
    const yesterdayStr = this.getDateStringDaysAgo(1);

    const historyByAdGroup = await this.loadHistoricalReports(dateStr);
    const adGroupIds = historyByAdGroup.map((ag) => ag._id);
    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } })
      .populate('productCategoryId', 'name')
      .exec();
    const adGroupMap = new Map(adGroups.map((ag) => [ag.adGroupId, ag]));

    const result = this.buildSuggestionsFromHistory({
      historyByAdGroup,
      adGroupMap,
      yesterdayStr,
      mode: 'legacy',
    });

    return {
      ...result,
      mode: 'legacy',
      defaultAssumedReturnRatePercent,
    };
  }

  private async getOptimalSpendSuggestionsByProductX(
    defaultAssumedReturnRatePercent: number,
  ): Promise<OptimalSpendSuggestionResponse> {
    const dateStr = this.getDateStringDaysAgo(30);
    const yesterdayStr = this.getDateStringDaysAgo(1);
    const startDate = this.getDateObjectDaysAgo(30);

    const historyByAdGroup = await this.loadHistoricalReports(dateStr);
    const adGroupIds = historyByAdGroup.map((ag) => ag._id);

    if (!adGroupIds.length) {
      return {
        suggestions: new Map(),
        adGroupSuggestions: [],
        totalSuggestedSpend: 0,
        totalSuggestedSpendWithCap: 0,
        totalCurrentSpend: 0,
        mode: 'product-x',
        defaultAssumedReturnRatePercent,
      };
    }

    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } })
      .populate('productCategoryId', 'name')
      .select('adGroupId name platform productCategoryId selectedProducts')
      .lean();
    const adGroupMap = new Map(adGroups.map((ag: any) => [ag.adGroupId, ag]));

    const orderAggRows: Array<{
      _id: {
        adGroupId: string;
        date: string;
        productId?: string;
        supplierIsReturnable: boolean;
      };
      orderCount: number;
      codAmount: number;
      supplierCost: number;
      shippingFee: number;
      returnFee: number;
    }> = await this.orderModel.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          adGroupId: { $in: adGroupIds, $nin: [null, '', '0'] },
        },
      },
      {
        $project: {
          adGroupId: 1,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$orderDate',
            },
          },
          productId: {
            $cond: [
              { $ifNull: ['$productId', false] },
              { $toString: '$productId' },
              null,
            ],
          },
          supplierIsReturnable: { $ifNull: ['$supplierIsReturnableSnapshot', true] },
          codAmount: { $ifNull: ['$codAmount', 0] },
          supplierCost: {
            $multiply: [
              { $ifNull: ['$quantity', 1] },
              { $ifNull: ['$supplierAppliedPrice', { $ifNull: ['$supplierQuote', 0] }] },
            ],
          },
          shippingFee: { $ifNull: ['$shippingFee', 0] },
          returnFee: { $ifNull: ['$returnFee', 0] },
        },
      },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: '$date',
            productId: '$productId',
            supplierIsReturnable: '$supplierIsReturnable',
          },
          orderCount: { $sum: 1 },
          codAmount: { $sum: '$codAmount' },
          supplierCost: { $sum: '$supplierCost' },
          shippingFee: { $sum: '$shippingFee' },
          returnFee: { $sum: '$returnFee' },
        },
      },
    ]).exec();

    const productIds = new Set<string>();
    for (const row of orderAggRows) {
      if (row?._id?.productId) {
        productIds.add(String(row._id.productId));
      }
    }
    for (const adGroup of adGroups as any[]) {
      for (const productId of adGroup?.selectedProducts || []) {
        if (productId) {
          productIds.add(String(productId));
        }
      }
    }

    const products = await this.productModel.find({
      _id: { $in: Array.from(productIds) },
    }).select('name assumedReturnRatePercent').lean();

    const productMap = new Map(
      products.map((p: any) => [
        String(p._id),
        {
          productId: String(p._id),
          productName: p.name || String(p._id),
          assumedReturnRatePercent: this.clampReturnRatePercent(
            p.assumedReturnRatePercent,
            defaultAssumedReturnRatePercent,
          ),
        },
      ]),
    );

    const adGroupDefaultX = new Map<string, ProductXContext>();
    for (const adGroup of adGroups as any[]) {
      const selected = (adGroup?.selectedProducts || []).map((id: any) => String(id));
      const productItems = selected
        .map((id: string) => productMap.get(id))
        .filter(Boolean) as Array<{ productId: string; productName: string; assumedReturnRatePercent: number }>;

      if (productItems.length > 0) {
        const avgX = productItems.reduce((sum, p) => sum + p.assumedReturnRatePercent, 0) / productItems.length;
        const assumptionSource: ReturnAssumptionSource = productItems.length === selected.length ? 'product' : 'mixed';
        adGroupDefaultX.set(adGroup.adGroupId, {
          assumedReturnRatePercent: Math.round(avgX * 100) / 100,
          assumptionSource,
          appliedProducts: productItems,
          expectedReturnedOrders: 0,
          orderCount: 0,
        });
      } else {
        adGroupDefaultX.set(adGroup.adGroupId, {
          assumedReturnRatePercent: defaultAssumedReturnRatePercent,
          assumptionSource: 'fallback',
          appliedProducts: [],
          expectedReturnedOrders: 0,
          orderCount: 0,
        });
      }
    }

    const estimatedGrossByAdGroupDate = new Map<string, number>();
    const productXContextByAdGroup = new Map<string, ProductXContext>();

    for (const row of orderAggRows) {
      const adGroupId = row?._id?.adGroupId;
      const date = row?._id?.date;
      if (!adGroupId || !date) continue;

      const productId = row?._id?.productId ? String(row._id.productId) : '';
      const fromProduct = productId ? productMap.get(productId) : undefined;
      const defaultProfile = adGroupDefaultX.get(adGroupId) || {
        assumedReturnRatePercent: defaultAssumedReturnRatePercent,
        assumptionSource: 'fallback' as ReturnAssumptionSource,
        appliedProducts: [],
        expectedReturnedOrders: 0,
        orderCount: 0,
      };

      const usedXPercent = fromProduct?.assumedReturnRatePercent ?? defaultProfile.assumedReturnRatePercent;
      const xRate = usedXPercent / 100;
      const isSupplierReturnable = row?._id?.supplierIsReturnable !== false;

      const expectedRevenue = (row.codAmount || 0) * (1 - xRate);
      const expectedSupplierCost = isSupplierReturnable
        ? (row.supplierCost || 0) * (1 - xRate)
        : (row.supplierCost || 0);
      const expectedReturnFee = (row.returnFee || 0) * xRate;
      const expectedGrossProfit =
        expectedRevenue
        - expectedSupplierCost
        - (row.shippingFee || 0)
        - expectedReturnFee;

      const key = `${adGroupId}|${date}`;
      estimatedGrossByAdGroupDate.set(
        key,
        (estimatedGrossByAdGroupDate.get(key) || 0) + expectedGrossProfit,
      );

      const ctx = productXContextByAdGroup.get(adGroupId) || {
        assumedReturnRatePercent: 0,
        assumptionSource: defaultProfile.assumptionSource,
        appliedProducts: [...defaultProfile.appliedProducts],
        expectedReturnedOrders: 0,
        orderCount: 0,
      };

      const rowOrders = row.orderCount || 0;
      ctx.assumedReturnRatePercent =
        ctx.orderCount + rowOrders > 0
          ? ((ctx.assumedReturnRatePercent * ctx.orderCount) + (usedXPercent * rowOrders)) / (ctx.orderCount + rowOrders)
          : usedXPercent;
      ctx.expectedReturnedOrders += rowOrders * xRate;
      ctx.orderCount += rowOrders;

      if (fromProduct && !ctx.appliedProducts.some((p) => p.productId === fromProduct.productId)) {
        ctx.appliedProducts.push(fromProduct);
      }

      productXContextByAdGroup.set(adGroupId, ctx);
    }

    for (const adGroupId of adGroupIds) {
      if (!productXContextByAdGroup.has(adGroupId)) {
        const fallback = adGroupDefaultX.get(adGroupId);
        if (fallback) {
          productXContextByAdGroup.set(adGroupId, fallback);
        }
      }
    }

    const estimatedHistory: RawHistoryByAdGroup[] = historyByAdGroup.map((ag) => {
      const records = (ag.records || []).map((record) => {
        const key = `${ag._id}|${record.date}`;
        const adsCost = Number(record.adsCost || 0);
        const estimatedGross = estimatedGrossByAdGroupDate.has(key)
          ? Number(estimatedGrossByAdGroupDate.get(key) || 0)
          : Number(record.netProfit || 0) + adsCost;
        return {
          date: record.date,
          adsCost,
          netProfit: estimatedGross - adsCost,
        };
      });

      return {
        ...ag,
        records,
        totalProfit: records.reduce((sum, r) => sum + (r.netProfit || 0), 0),
      };
    });

    const result = this.buildSuggestionsFromHistory({
      historyByAdGroup: estimatedHistory,
      adGroupMap,
      yesterdayStr,
      mode: 'product-x',
      productXContextByAdGroup,
    });

    return {
      ...result,
      mode: 'product-x',
      defaultAssumedReturnRatePercent,
    };
  }

  private buildSuggestionsFromHistory(params: {
    historyByAdGroup: RawHistoryByAdGroup[];
    adGroupMap: Map<string, any>;
    yesterdayStr: string;
    mode: OptimalSpendMode;
    productXContextByAdGroup?: Map<string, ProductXContext>;
  }): Omit<OptimalSpendSuggestionResponse, 'mode' | 'defaultAssumedReturnRatePercent'> {
    const suggestions = new Map<string, { suggestedSpend: number; suggestedSpendWithCap: number; reason: string; confidence: number }>();
    const adGroupSuggestions: OptimalSpendSuggestionItem[] = [];

    for (const ag of params.historyByAdGroup) {
      const adGroupId = ag._id;
      const adGroupInfo = params.adGroupMap.get(adGroupId);
      const adGroupName = ag.adGroupName || adGroupInfo?.name || adGroupId;
      const platform = ag.platform || adGroupInfo?.platform || 'unknown';
      const productCategoryId = adGroupInfo?.productCategoryId?._id?.toString?.() || '';
      const productCategoryName = adGroupInfo?.productCategoryId?.name || '';
      const productXContext = params.productXContextByAdGroup?.get(adGroupId);

      const records = ag.records || [];
      const dayCount = ag.dayCount || 1;
      const currentAvgSpend = (ag.totalSpend || 0) / dayCount;

      const yesterdayRecord = records.find((r) => r.date === params.yesterdayStr);
      const spendYesterday = yesterdayRecord?.adsCost || 0;
      const profitYesterday = yesterdayRecord?.netProfit || 0;

      const MIN_START_BUDGET = 60000;
      const sortedByDateDescForAvg = [...records].sort((a, b) => b.date.localeCompare(a.date));
      const last3DaysRecords = sortedByDateDescForAvg.slice(0, 3);
      const avgLast3Days = last3DaysRecords.length > 0
        ? last3DaysRecords.reduce((sum, r) => sum + (r.adsCost || 0), 0) / last3DaysRecords.length
        : 0;
      const baselineSpend = Math.max(spendYesterday, avgLast3Days, MIN_START_BUDGET);

      let consecutiveNegativeDays = 0;
      const sortedByDateDesc = [...records].sort((a, b) => b.date.localeCompare(a.date));
      for (const rec of sortedByDateDesc) {
        if ((rec.netProfit || 0) < 0) {
          consecutiveNegativeDays++;
        } else {
          break;
        }
      }

      const baseSuggestionPayload = {
        adGroupId,
        adGroupName,
        platform,
        productCategoryId,
        productCategoryName,
        spendYesterday,
        profitYesterday,
        currentAvgSpend: Math.round(currentAvgSpend),
        baselineSpend: Math.round(baselineSpend),
        consecutiveNegativeDays,
        hasAlert: consecutiveNegativeDays >= 3,
        assumedReturnRatePercent: productXContext
          ? Math.round((productXContext.assumedReturnRatePercent || 0) * 100) / 100
          : undefined,
        assumptionSource: productXContext?.assumptionSource,
        orderCount: productXContext?.orderCount,
        expectedReturnedOrders: productXContext
          ? Math.round((productXContext.expectedReturnedOrders || 0) * 100) / 100
          : undefined,
        appliedProducts: productXContext?.appliedProducts,
        optimizationMode: params.mode,
      };

      if (records.length < 3) {
        const suggestedSpend = Math.round(currentAvgSpend);
        const suggestedSpendWithCap = suggestedSpend;
        const suggestion = {
          suggestedSpend,
          suggestedSpendWithCap,
          reason: 'Khong du du lieu (can >=3 ngay)',
          confidence: 30,
        };
        suggestions.set(adGroupId, suggestion);
        adGroupSuggestions.push({
          ...baseSuggestionPayload,
          ...suggestion,
          marginalAnalysis: { dataPoints: records.length, lastMarginalProfit: 0, avgMarginalProfit: 0 },
        });
        continue;
      }

      const sortedRecords = [...records].sort((a, b) => (a.adsCost || 0) - (b.adsCost || 0));
      const marginalProfits: number[] = [];
      for (let i = 1; i < sortedRecords.length; i++) {
        const prev = sortedRecords[i - 1];
        const curr = sortedRecords[i];
        const deltaSpend = (curr.adsCost || 0) - (prev.adsCost || 0);
        const deltaProfit = (curr.netProfit || 0) - (prev.netProfit || 0);
        if (deltaSpend > 0) {
          marginalProfits.push(deltaProfit / deltaSpend);
        }
      }

      if (marginalProfits.length === 0) {
        const suggestedSpend = Math.round(currentAvgSpend);
        const suggestedSpendWithCap = suggestedSpend;
        const suggestion = {
          suggestedSpend,
          suggestedSpendWithCap,
          reason: 'Chi phi khong doi giua cac ngay',
          confidence: 40,
        };
        suggestions.set(adGroupId, suggestion);
        adGroupSuggestions.push({
          ...baseSuggestionPayload,
          ...suggestion,
          marginalAnalysis: { dataPoints: records.length, lastMarginalProfit: 0, avgMarginalProfit: 0 },
        });
        continue;
      }

      const lastMarginalProfit = marginalProfits[marginalProfits.length - 1];
      const avgMarginalProfit = marginalProfits.reduce((a, b) => a + b, 0) / marginalProfits.length;

      let suggestedSpend: number;
      let reason: string;
      let confidence: number;

      if (avgMarginalProfit > 1) {
        suggestedSpend = Math.min(currentAvgSpend * 1.2, currentAvgSpend + 500000);
        reason = `Marginal profit cao (${avgMarginalProfit.toFixed(2)}) -> co the TANG 20%`;
        confidence = Math.min(85, 60 + marginalProfits.filter((m) => m > 1).length * 5);
      } else if (avgMarginalProfit > 0) {
        if (lastMarginalProfit > 0.5) {
          suggestedSpend = currentAvgSpend * 1.1;
          reason = `Marginal profit duong (${avgMarginalProfit.toFixed(2)}) -> co the TANG NHE 10%`;
          confidence = 70;
        } else if (lastMarginalProfit > 0) {
          suggestedSpend = currentAvgSpend;
          reason = `Dang o gan diem OPTIMAL (marginal ~ ${avgMarginalProfit.toFixed(2)})`;
          confidence = 80;
        } else {
          suggestedSpend = currentAvgSpend * 0.9;
          reason = 'Marginal cuoi am -> nen GIAM 10%';
          confidence = 75;
        }
      } else {
        suggestedSpend = currentAvgSpend * 0.7;
        reason = `Marginal profit AM (${avgMarginalProfit.toFixed(2)}) -> can GIAM 30%`;
        confidence = 85;
      }

      suggestedSpend = Math.max(0, Math.round(suggestedSpend));
      const upperCap = Math.round(baselineSpend * 1.20);
      const lowerCap = Math.round(baselineSpend * 0.70);
      const suggestedSpendWithCap = Math.max(lowerCap, Math.min(upperCap, suggestedSpend));

      const suggestion = { suggestedSpend, suggestedSpendWithCap, reason, confidence };
      suggestions.set(adGroupId, suggestion);
      adGroupSuggestions.push({
        ...baseSuggestionPayload,
        ...suggestion,
        marginalAnalysis: {
          dataPoints: marginalProfits.length,
          lastMarginalProfit: Math.round(lastMarginalProfit * 100) / 100,
          avgMarginalProfit: Math.round(avgMarginalProfit * 100) / 100,
        },
      });
    }

    const totalSuggestedSpend = adGroupSuggestions.reduce((sum, item) => sum + item.suggestedSpend, 0);
    const totalSuggestedSpendWithCap = adGroupSuggestions.reduce((sum, item) => sum + item.suggestedSpendWithCap, 0);
    const totalCurrentSpend = adGroupSuggestions.reduce((sum, item) => sum + item.currentAvgSpend, 0);

    return {
      suggestions,
      adGroupSuggestions,
      totalSuggestedSpend,
      totalSuggestedSpendWithCap,
      totalCurrentSpend,
    };
  }

  private async loadHistoricalReports(fromDate: string): Promise<RawHistoryByAdGroup[]> {
    return this.reportModel.aggregate([
      { $match: { date: { $gte: fromDate } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$adGroupId',
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
          records: {
            $push: {
              date: '$date',
              adsCost: '$adsCost',
              netProfit: '$netProfit',
            },
          },
          totalSpend: { $sum: '$adsCost' },
          totalProfit: { $sum: '$netProfit' },
          dayCount: { $sum: 1 },
        },
      },
    ]).exec();
  }

  private getDateStringDaysAgo(daysAgo: number): string {
    const date = this.getDateObjectDaysAgo(daysAgo);
    return date.toISOString().split('T')[0];
  }

  private getDateObjectDaysAgo(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  private clampReturnRatePercent(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(95, Math.max(0, n));
  }

  /**
   * Bao cao chi phi va loi nhuan kem chi phi goi y
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




