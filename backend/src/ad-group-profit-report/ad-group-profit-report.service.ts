import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { OptimalSpendSnapshot, OptimalSpendSnapshotDocument } from './schemas/optimal-spend-snapshot.schema';
import {
  AdGroupPerformance,
  AdGroupProfitClassificationReport,
  AdGroupProfitClassificationStatus,
  OptimalSpendSuggestion,
  AdGroupProfitSummary,
} from './interfaces/ad-group-performance.interface';

@Injectable()
export class AdGroupProfitReportService {
  private readonly logger = new Logger(AdGroupProfitReportService.name);
  private readonly finalizedStatuses = [
    'Giao th\u00e0nh c\u00f4ng',
    'H\u00e0ng ho\u00e0n',
    '\u0110\u00e3 \u0111\u1ed1i so\u00e1t',
    'Ho\u00e0n th\u00e0nh',
    'Giao thanh cong',
    'Hang hoan',
    'Da doi soat',
    'Hoan thanh',
  ];
  private readonly successStatuses = [
    'Giao th\u00e0nh c\u00f4ng',
    '\u0110\u00e3 \u0111\u1ed1i so\u00e1t',
    'Ho\u00e0n th\u00e0nh',
    'Giao thanh cong',
    'Da doi soat',
    'Hoan thanh',
  ];
  private readonly returnStatuses = [
    'H\u00e0ng ho\u00e0n',
    'Ho\u00e0n h\u00e0ng',
    'Hang hoan',
    'Hoan hang',
  ];
  private readonly pendingStatuses = [
    '\u0110ang giao',
    'Ch\u1edd l\u1ea5y',
    'Dang giao',
    'Cho lay',
  ];

  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(OptimalSpendSnapshot.name)
    private readonly snapshotModel: Model<OptimalSpendSnapshotDocument>,
  ) {}

  /**
   * Prefer orderDate so report windows stay aligned with other profit reports.
   * Fallback createdAt for legacy rows that do not have orderDate yet.
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

  async getAdGroupPerformanceReport(params?: {
    startDate?: Date;
    endDate?: Date;
    adGroupIds?: string[];
    minOrders?: number;
    onlyFinalized?: boolean;
  }): Promise<AdGroupPerformance[]> {
    const startDate = params?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = params?.endDate || new Date();
    const minOrders = params?.minOrders || 1;
    const onlyFinalized = params?.onlyFinalized ?? true;

    const matchConditions: any = {
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null },
      netProfit: { $exists: true },
      ...this.buildDateRangeMatch(startDate, endDate),
    };

    if (onlyFinalized) {
      matchConditions.orderStatus = {
        $in: this.finalizedStatuses,
      };
    }

    if (params?.adGroupIds?.length) {
      matchConditions.adGroupId = { $in: params.adGroupIds };
    }

    const results = await this.orderModel.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          normalizedOrderStatus: {
            $ifNull: ['$orderStatus', 'Unknown'],
          },
        },
      },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            status: '$normalizedOrderStatus',
          },
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$codCollectedBySupplier' },
          totalNetProfit: { $sum: '$netProfit' },
          totalAdsSpent: { $sum: '$advertisingCost' },
          totalProductCost: { $sum: '$productCost' },
          totalShippingFee: { $sum: '$shippingFee' },
          successOrders: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.successStatuses] },
                1,
                0,
              ],
            },
          },
          returnOrders: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.returnStatuses] },
                1,
                0,
              ],
            },
          },
          successProfit: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.successStatuses] },
                '$netProfit',
                0,
              ],
            },
          },
          returnLoss: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.returnStatuses] },
                '$netProfit',
                0,
              ],
            },
          },
          realizedProfit: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.successStatuses] },
                '$netProfit',
                0,
              ],
            },
          },
          pendingProfit: {
            $sum: {
              $cond: [
                { $in: ['$normalizedOrderStatus', this.pendingStatuses] },
                '$netProfit',
                0,
              ],
            },
          },
          riskyProfit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $in: ['$normalizedOrderStatus', this.successStatuses] } },
                    { $not: { $in: ['$normalizedOrderStatus', this.pendingStatuses] } },
                  ],
                },
                '$netProfit',
                0,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.adGroupId',
          totalOrders: { $sum: '$totalOrders' },
          totalRevenue: { $sum: '$totalRevenue' },
          totalNetProfit: { $sum: '$totalNetProfit' },
          totalAdsSpent: { $sum: '$totalAdsSpent' },
          totalProductCost: { $sum: '$totalProductCost' },
          totalShippingFee: { $sum: '$totalShippingFee' },
          successOrders: { $sum: '$successOrders' },
          returnOrders: { $sum: '$returnOrders' },
          successProfit: { $sum: '$successProfit' },
          returnLoss: { $sum: '$returnLoss' },
          realizedProfit: { $sum: '$realizedProfit' },
          pendingProfit: { $sum: '$pendingProfit' },
          riskyProfit: { $sum: '$riskyProfit' },
          ordersByStatus: {
            $push: {
              status: '$_id.status',
              count: '$totalOrders',
              revenue: '$totalRevenue',
              profit: '$totalNetProfit',
            },
          },
        },
      },
      {
        $match: {
          totalOrders: { $gte: minOrders },
        },
      },
      {
        $sort: {
          totalNetProfit: -1,
        },
      },
    ]);

    const adGroupIds = results.map((result) => result._id).filter(Boolean);
    const adGroups = await this.adGroupModel
      .find({ adGroupId: { $in: adGroupIds } }, { adGroupId: 1, name: 1 })
      .lean();
    const adGroupNameMap = new Map(
      adGroups.map((adGroup) => [adGroup.adGroupId, adGroup.name || adGroup.adGroupId]),
    );

    const daysInPeriod =
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    return results.map((result) => {
      const adGroupId = result._id;
      const totalRevenue = result.totalRevenue || 0;
      const totalAdsSpent = result.totalAdsSpent || 0;
      const totalNetProfit = result.totalNetProfit || 0;
      const totalOrders = result.totalOrders || 0;
      const successOrders = result.successOrders || 0;
      const returnOrders = result.returnOrders || 0;
      const successProfit = result.successProfit || 0;
      const returnLoss = result.returnLoss || 0;
      const roi = totalAdsSpent > 0 ? (totalNetProfit / totalAdsSpent) * 100 : 0;
      const profitMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const returnRate = totalOrders > 0 ? (returnOrders / totalOrders) * 100 : 0;

      return {
        adGroupId,
        adGroupName: adGroupNameMap.get(adGroupId) || adGroupId,
        totalOrders,
        successOrders,
        returnOrders,
        returnRate,
        totalRevenue,
        totalCost: (result.totalProductCost || 0) + (result.totalShippingFee || 0) + totalAdsSpent,
        totalAdsSpent,
        totalNetProfit,
        successProfit,
        returnLoss,
        roi,
        profitMargin,
        averageOrderValue,
        realizedProfit: result.realizedProfit || 0,
        pendingProfit: result.pendingProfit || 0,
        riskyProfit: result.riskyProfit || 0,
        ordersByStatus: (result.ordersByStatus || []).map((item: any) => ({
          status: item.status || 'Unknown',
          count: item.count || 0,
          revenue: item.revenue || 0,
          profit: item.profit || 0,
        })),
        startDate,
        endDate,
        daysInPeriod,
        avgDailyOrders: totalOrders / daysInPeriod,
        avgDailyRevenue: totalRevenue / daysInPeriod,
        avgDailyProfit: totalNetProfit / daysInPeriod,
        avgDailySpent: totalAdsSpent / daysInPeriod,
      };
    });
  }

  /**
   * Láº¥y dá»¯ liá»‡u chi phÃ­/lá»£i nhuáº­n theo ngÃ y cá»§a má»™t ad group
   * DÃ¹ng Ä‘á»ƒ phÃ¢n tÃ­ch marginal efficiency
   */
  private async getDailySpendProfitHistory(
    adGroupId: string,
    lookbackDays: number = 30,
  ): Promise<{ date: Date; spend: number; profit: number; orders: number; returnOrders: number }[]> {
    const endDate = new Date();
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const results = await this.orderModel.aggregate([
      {
        $match: {
          adGroupId,
          ...this.buildDateRangeMatch(startDate, endDate),
          orderStatus: { $in: this.finalizedStatuses },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: this.getEffectiveOrderDateExpression() },
          },
          spend: { $sum: '$advertisingCost' },
          profit: { $sum: '$netProfit' },
          orders: { $sum: 1 },
          returnOrders: {
            $sum: {
              $cond: [
                {
                  $in: [{ $ifNull: ['$orderStatus', ''] }, this.returnStatuses],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({
      date: new Date(r._id),
      spend: r.spend || 0,
      profit: r.profit || 0,
      orders: r.orders || 0,
      returnOrders: r.returnOrders || 0,
    }));
  }

  /**
   * TÃ­nh Optimal Spend dá»±a trÃªn Marginal Efficiency Analysis
   */
  async getOptimalSpendSuggestions(params?: {
    lookbackDays?: number;
    minROI?: number;
    minProfit?: number;
  }): Promise<OptimalSpendSuggestion[]> {
    const lookbackDays = params?.lookbackDays || 30;
    const minROI = params?.minROI || 0;
    const minProfit = params?.minProfit || 0;

    const endDate = new Date();
    const startDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const performances = await this.getAdGroupPerformanceReport({
      startDate,
      endDate,
      minOrders: 1,
      onlyFinalized: true,
    });

    const suggestions: OptimalSpendSuggestion[] = [];

    for (const perf of performances) {
      const dailyHistory = await this.getDailySpendProfitHistory(perf.adGroupId, lookbackDays);

      if (dailyHistory.length < 3) {
        continue;
      }

      const sortedBySpend = [...dailyHistory].sort((a, b) => a.spend - b.spend);
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
            marginalEfficiency: deltaProfit / deltaSpend,
          });
        }
      }

      let optimalSpend = perf.avgDailySpent;
      let optimalEfficiency = 1;

      if (marginalData.length > 0) {
        const goodPoints = marginalData.filter((d) => d.marginalEfficiency > 0);
        if (goodPoints.length > 0) {
          const sorted = goodPoints.sort(
            (a, b) =>
              Math.abs(a.marginalEfficiency - 1) - Math.abs(b.marginalEfficiency - 1),
          );
          optimalSpend = sorted[0].spend;
          optimalEfficiency = sorted[0].marginalEfficiency;
        }

        const allPositive = marginalData.every((d) => d.marginalEfficiency > 1);
        if (allPositive && marginalData.length > 0) {
          optimalSpend = Math.max(...marginalData.map((d) => d.spend)) * 1.2;
        }

        const lastMarginal = marginalData[marginalData.length - 1];
        if (lastMarginal && lastMarginal.marginalEfficiency < 0) {
          const positivePoints = marginalData.filter((d) => d.marginalEfficiency > 0);
          if (positivePoints.length > 0) {
            optimalSpend = positivePoints[positivePoints.length - 1].spend;
          }
        }
      }

      const currentSpend = perf.avgDailySpent;
      const currentROI = perf.roi;
      const returnRate = perf.returnRate || 0;

      let scaleAction: 'increase' | 'decrease' | 'maintain' | 'kill';
      let reason: string;
      let confidence: number;

      const spendDiff = optimalSpend - currentSpend;
      const spendDiffPercent = currentSpend > 0 ? (spendDiff / currentSpend) * 100 : 0;

      if (currentROI < 0 || returnRate > 40) {
        scaleAction = 'kill';
        optimalSpend = 0;
        confidence = 95;
        reason = `ROI Ã¢m (${currentROI.toFixed(0)}%) hoáº·c hoÃ n quÃ¡ cao (${returnRate.toFixed(0)}%) - Táº M Dá»ªNG`;
      } else if (spendDiffPercent > 10) {
        scaleAction = 'increase';
        confidence = Math.min(
          90,
          60 + marginalData.filter((d) => d.marginalEfficiency > 1).length * 5,
        );
        reason = `Optimal cao hÆ¡n ${spendDiffPercent.toFixed(0)}% - cÃ³ thá»ƒ TÄ‚NG Dáº¦N (tá»‘i Ä‘a +20%/láº§n)`;
      } else if (spendDiffPercent < -10) {
        scaleAction = 'decrease';
        confidence = Math.min(
          90,
          60 + marginalData.filter((d) => d.marginalEfficiency < 1).length * 5,
        );
        reason = `Äang chi quÃ¡ optimal ${Math.abs(spendDiffPercent).toFixed(0)}% - nÃªn GIáº¢M`;
      } else {
        scaleAction = 'maintain';
        confidence = 80;
        reason = `Chi phÃ­ hiá»‡n táº¡i Gáº¦N OPTIMAL (Â±10%)`;
      }

      if (returnRate > 20) {
        reason += ` âš ï¸ HoÃ n ${returnRate.toFixed(0)}%`;
      }

      const last7Days = dailyHistory.slice(-7).map((d) => ({
        date: d.date.toISOString().split('T')[0],
        spent: d.spend,
        profit: d.profit,
        roi: d.spend > 0 ? (d.profit / d.spend) * 100 : 0,
        orders: d.orders,
      }));

      const expectedROI =
        optimalEfficiency > 0
          ? currentROI * (1 + (optimalEfficiency - 1) * 0.1)
          : currentROI * 0.9;
      const expectedProfit = optimalSpend * (expectedROI / 100);

      if (perf.roi < minROI || perf.avgDailyProfit < minProfit) {
        continue;
      }

      suggestions.push({
        adGroupId: perf.adGroupId,
        adGroupName: perf.adGroupName,
        lastSpend: currentSpend,
        lastProfit: perf.avgDailyProfit,
        currentROI,
        returnRate,
        totalOrders: perf.totalOrders,
        successOrders: perf.successOrders,
        returnOrders: perf.returnOrders,
        suggestedSpend: optimalSpend,
        appliedSpend: optimalSpend,
        expectedProfit,
        expectedROI,
        scaleAction,
        reason,
        confidence,
        minBudget: 50_000,
        maxBudget: 10_000_000,
        last7Days,
      });
    }

    return suggestions.sort((a, b) => b.currentROI - a.currentROI);
  }

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

    const topByProfit = performances.slice(0, 5);
    const topByROI = [...performances].sort((a, b) => b.roi - a.roi).slice(0, 5);
    const lowPerformers = performances.filter((p) => p.roi < 50);

    const profitByStatus = {
      realized: performances.reduce((sum, p) => sum + p.realizedProfit, 0),
      pending: performances.reduce((sum, p) => sum + p.pendingProfit, 0),
      risky: performances.reduce((sum, p) => sum + p.riskyProfit, 0),
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
      profitByStatus,
    };
  }

  async getAdGroupProfitClassification(params?: {
    days?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AdGroupProfitClassificationReport> {
    const periodDays = Math.min(90, Math.max(1, Math.round(Number(params?.days) || 7)));
    const endDate = params?.endDate || new Date();
    const startDate = params?.startDate || new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const [
      adGroups,
      performanceRows,
      spendRows,
      leadRows,
      tokenIssueRows,
    ] = await Promise.all([
      this.adGroupModel
        .find(
          {},
          {
            name: 1,
            adGroupId: 1,
            platform: 1,
            isActive: 1,
            adAccountId: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
          },
        )
        .sort({ isActive: -1, updatedAt: -1, createdAt: -1 })
        .lean(),
      this.getAdGroupPerformanceReport({
        startDate,
        endDate,
        minOrders: 1,
        onlyFinalized: true,
      }),
      this.orderModel.db.collection('advertisingcosts').aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$adGroupId',
            spend: { $sum: '$spentAmount' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            adMetricConversations: { $sum: '$messagingConversationStarted7d' },
            latestDate: { $max: '$date' },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('chatmessages').aggregate([
        {
          $match: {
            direction: 'in',
            adGroupId: { $exists: true, $nin: [null, ''] },
            $or: [
              { receivedAt: { $gte: startDate, $lte: endDate } },
              { receivedAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
            ],
          },
        },
        {
          $group: {
            _id: '$adGroupId',
            inbox: { $sum: 1 },
            uniqueSenders: { $addToSet: '$senderPsid' },
          },
        },
      ]).toArray(),
      this.orderModel.db.collection('apitokens').aggregate([
        {
          $match: {
            $or: [
              { degraded: true },
              { lastCheckStatus: { $in: ['invalid', 'expired'] } },
              { expireAt: { $lte: endDate } },
            ],
          },
        },
        { $count: 'count' },
      ]).toArray(),
    ]);

    const accountIds = adGroups.map((group: any) => group.adAccountId).filter(Boolean);
    const accounts = accountIds.length
      ? await this.orderModel.db
          .collection('adaccounts')
          .find({ _id: { $in: accountIds } }, { projection: { name: 1, accountId: 1 } })
          .toArray()
      : [];
    const accountById = new Map(accounts.map((account: any) => [String(account._id), account]));
    const performanceByAdGroup = new Map(performanceRows.map((row) => [String(row.adGroupId), row]));
    const spendByAdGroup = new Map(spendRows.map((row: any) => [String(row._id), row]));
    const leadByAdGroup = new Map(leadRows.map((row: any) => [String(row._id), row]));

    const groups = adGroups.map((group: any) => {
      const adGroupId = String(group.adGroupId || '');
      const performance = performanceByAdGroup.get(adGroupId);
      const spendRow: any = spendByAdGroup.get(adGroupId) || {};
      const leadRow: any = leadByAdGroup.get(adGroupId) || {};
      const account = group.adAccountId ? accountById.get(String(group.adAccountId)) : null;
      const spend = Number(spendRow.spend || performance?.totalAdsSpent || 0);
      const orders = Number(performance?.totalOrders || 0);
      const revenue = Number(performance?.totalRevenue || 0);
      const netProfit = performance ? Number(performance.totalNetProfit || 0) : (spend > 0 && orders === 0 ? -spend : null);
      const grossProfit = performance ? Number((performance.totalNetProfit || 0) + (performance.totalAdsSpent || 0)) : 0;
      const leads = Math.max(
        Array.isArray(leadRow.uniqueSenders) ? leadRow.uniqueSenders.length : 0,
        Number(spendRow.adMetricConversations || 0),
      );
      const inbox = Number(leadRow.inbox || 0);

      let status: AdGroupProfitClassificationStatus;
      let reason: string;
      if (spend <= 0) {
        status = 'insufficient_data';
        reason = `Spend ${periodDays} ngày = 0đ nên chưa thể kết luận lãi/lỗ.`;
      } else if (!performance && orders === 0) {
        status = 'loss';
        reason = 'Có spend nhưng chưa có đơn/doanh thu hoàn tất trong kỳ.';
      } else if (netProfit == null) {
        status = 'insufficient_data';
        reason = 'Thiếu dữ liệu lợi nhuận sau ads.';
      } else if (netProfit > 0) {
        status = 'profitable';
        reason = 'Lợi nhuận sau ads dương.';
      } else if (netProfit < 0) {
        status = 'loss';
        reason = 'Lợi nhuận sau ads âm.';
      } else {
        status = 'break_even';
        reason = 'Lợi nhuận sau ads bằng 0.';
      }

      return {
        adGroupId,
        name: group.name || adGroupId,
        platform: group.platform || null,
        accountName: account?.name || account?.accountId || null,
        isActive: group.isActive !== false,
        spend,
        leads,
        inbox,
        orders,
        revenue,
        grossProfit,
        netProfitAfterAds: netProfit,
        roi: spend > 0 && netProfit != null ? (netProfit / spend) * 100 : null,
        status,
        reason,
      };
    });

    const summary = groups.reduce(
      (acc, group) => {
        if (group.status === 'profitable') acc.profitable += 1;
        if (group.status === 'loss') acc.loss += 1;
        if (group.status === 'break_even') acc.breakEven += 1;
        if (group.status === 'insufficient_data') acc.insufficientData += 1;
        return acc;
      },
      { profitable: 0, loss: 0, breakEven: 0, insufficientData: 0 },
    );
    const syncErrors = adGroups.filter((group: any) => group.lastSyncStatus === 'error');
    const groupsWithSpend = groups.filter((group) => group.spend > 0).length;
    const groupsWithAttribution = groups.filter((group) => group.orders > 0 || group.leads > 0).length;
    const tokenIssues = tokenIssueRows[0]?.count ?? 0;
    const notes: string[] = [];
    if (syncErrors.length) notes.push(`${syncErrors.length} nhóm quảng cáo có lỗi đồng bộ gần nhất.`);
    if (tokenIssues) notes.push(`${tokenIssues} token provider có lỗi/hết hạn.`);
    if (!groupsWithSpend) notes.push(`Spend ${periodDays} ngày = 0đ cho toàn bộ nhóm đã đọc.`);
    if (summary.insufficientData) notes.push(`${summary.insufficientData} nhóm chưa đủ dữ liệu để kết luận lãi/lỗ.`);

    return {
      periodDays,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      total: groups.length,
      summary,
      groups: groups.sort((a, b) => {
        const statusOrder: Record<AdGroupProfitClassificationStatus, number> = {
          profitable: 1,
          loss: 2,
          break_even: 3,
          insufficient_data: 4,
        };
        return statusOrder[a.status] - statusOrder[b.status] || b.spend - a.spend;
      }),
      dataQuality: {
        syncOk: syncErrors.length ? false : true,
        tokenIssues,
        attributionCoverage: groupsWithSpend > 0 ? groupsWithAttribution / groupsWithSpend : 0,
        notes,
      },
    };
  }

  @Cron('0 0 6 * * *')
  async updateDailyOptimalSpendSnapshot() {
    this.logger.log('ðŸ”„ [CRON] Äang cáº­p nháº­t Optimal Spend Suggestions...');

    try {
      const suggestions = await this.getOptimalSpendSuggestions({ lookbackDays: 30 });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let created = 0;
      let updated = 0;

      for (const s of suggestions) {
        const spendDiffPercent =
          s.lastSpend > 0 ? ((s.suggestedSpend - s.lastSpend) / s.lastSpend) * 100 : 0;

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
          last7Days: s.last7Days,
        };

        const result = await this.snapshotModel.updateOne(
          { adGroupId: s.adGroupId, date: today },
          { $set: data },
          { upsert: true },
        );

        if (result.upsertedCount > 0) created++;
        else if (result.modifiedCount > 0) updated++;
      }

      this.logger.log(`âœ… [CRON] Optimal Spend updated: ${created} created, ${updated} updated`);
      return { created, updated, total: suggestions.length };
    } catch (error) {
      this.logger.error('âŒ [CRON] Failed to update Optimal Spend', error);
      throw error;
    }
  }

  async getLatestOptimalSpendSnapshots(): Promise<OptimalSpendSnapshot[]> {
    const latestDoc = await this.snapshotModel.findOne().sort({ date: -1 }).lean();
    if (!latestDoc) return [];

    return this.snapshotModel.find({ date: latestDoc.date }).sort({ currentROI: -1 }).lean();
  }

  async getOptimalSpendHistory(
    adGroupId: string,
    days: number = 30,
  ): Promise<OptimalSpendSnapshot[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.snapshotModel
      .find({ adGroupId, date: { $gte: startDate } })
      .sort({ date: -1 })
      .lean();
  }

  async triggerOptimalSpendUpdate() {
    return this.updateDailyOptimalSpendSnapshot();
  }
}
