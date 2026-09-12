import { removeVietnameseTone, asArray } from './ai-operator.format';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { AdReportService } from '../ad-report/ad-report.service';
import { AiMarketingService } from '../ai-marketing/ai-marketing.service';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
import { AdvertisingCostFacebookSyncService } from '../advertising-cost/advertising-cost.facebook-sync.service';
import { AdvertisingCostGoogleSyncService } from '../advertising-cost/advertising-cost.google-sync.service';
import { AdvertisingCostTiktokSyncService } from '../advertising-cost/advertising-cost.tiktok-sync.service';
import { EmployeeAdsKpiService } from '../employee-ads-kpi/employee-ads-kpi.service';
import {
  AdAccount,
  AdAccountDocument,
} from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import {
  Conversation,
  ConversationDocument,
} from '../chat-message/schemas/conversation.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import {
  PendingOrder,
  PendingOrderDocument,
} from '../pending-order/schemas/pending-order.schema';
import {
  TestOrder2,
  TestOrder2Document,
} from '../test-order2/schemas/test-order2.schema';
import { trimText, dateOnly } from './ai-operator.snapshot-utils';

@Injectable()
export class AiOperatorAdsReader {
  constructor(
    private readonly profitReportService: AdGroupProfitReportService,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(PendingOrder.name)
    private readonly pendingOrderModel: Model<PendingOrderDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(Fanpage.name)
    private readonly fanpageModel: Model<FanpageDocument>,
    private readonly aiMarketingService?: AiMarketingService,
    private readonly employeeAdsKpiService?: EmployeeAdsKpiService,
    private readonly apiTokenService?: ApiTokenService,
    private readonly advertisingCostService?: AdvertisingCostService,
    private readonly facebookSyncService?: AdvertisingCostFacebookSyncService,
    private readonly googleSyncService?: AdvertisingCostGoogleSyncService,
    private readonly tiktokSyncService?: AdvertisingCostTiktokSyncService,
    private readonly adReportService?: AdReportService,
  ) {}

  async buildEmployeeAdsKpiSnapshot(startDate: Date, endDate: Date) {
    if (!this.employeeAdsKpiService)
      throw new Error('employee ads KPI service is not available');
    const [employees, assignableEmployees] = await Promise.all([
      this.employeeAdsKpiService.getAllEmployeesKpi(startDate, endDate),
      this.employeeAdsKpiService.getAssignableEmployees(),
    ]);
    const rows = asArray(employees);
    const alerts = rows.flatMap((employee: any) =>
      asArray(employee.alerts).map((alert: any) => ({
        employeeId: employee.employeeId || null,
        employeeName:
          employee.employeeName ||
          employee.fullName ||
          employee.email ||
          'unknown',
        type: alert.type || alert.level || 'WARNING',
        message: trimText(alert.message || alert.reason || '', 220),
      })),
    );
    const underperformers = rows
      .filter(
        (employee: any) =>
          employee.kpiProfitableRateMet === false ||
          (employee.profitableRate || 0) <
            (employee.kpiProfitableRateTarget || 0),
      )
      .sort(
        (a: any, b: any) => (a.profitableRate || 0) - (b.profitableRate || 0),
      )
      .slice(0, 8)
      .map((employee: any) => ({
        employeeId: employee.employeeId || null,
        employeeName:
          employee.employeeName ||
          employee.fullName ||
          employee.email ||
          'unknown',
        profitableRate: employee.profitableRate || 0,
        target: employee.kpiProfitableRateTarget || null,
        totalSpend: employee.totalSpend || 0,
        totalProfit: employee.totalProfit || 0,
        avgROI: employee.avgROI || 0,
        activeAdGroups: employee.totalAdGroups || employee.activeAdGroups || 0,
      }));
    const topWorkload = [...rows]
      .sort(
        (a: any, b: any) =>
          (b.totalAdGroups || b.activeAdGroups || 0) -
          (a.totalAdGroups || a.activeAdGroups || 0),
      )
      .slice(0, 8)
      .map((employee: any) => ({
        employeeId: employee.employeeId || null,
        employeeName:
          employee.employeeName ||
          employee.fullName ||
          employee.email ||
          'unknown',
        activeAdGroups: employee.totalAdGroups || employee.activeAdGroups || 0,
        profitableRate: employee.profitableRate || 0,
        totalSpend: employee.totalSpend || 0,
        totalProfit: employee.totalProfit || 0,
      }));

    return {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      summary: {
        employeeCount: rows.length,
        assignableEmployeeCount: asArray(assignableEmployees).length,
        criticalAlerts: alerts.filter(
          (alert: any) => String(alert.type).toUpperCase() === 'CRITICAL',
        ).length,
        warningAlerts: alerts.filter(
          (alert: any) => String(alert.type).toUpperCase() !== 'CRITICAL',
        ).length,
        underperformerCount: underperformers.length,
        avgProfitableRate: rows.length
          ? rows.reduce(
              (sum: number, employee: any) =>
                sum + (Number(employee.profitableRate) || 0),
              0,
            ) / rows.length
          : 0,
      },
      alerts: alerts.slice(0, 20),
      underperformers,
      topWorkload,
      assignableEmployees: asArray(assignableEmployees).slice(0, 12),
    };
  }

  async buildApiTokenSnapshot() {
    if (!this.apiTokenService)
      throw new Error('API token service is not available');
    const [tokens, settings] = await Promise.all([
      this.apiTokenService.findAll({}),
      this.apiTokenService.getAdsSettings(),
    ]);
    const now = Date.now();
    const expiringSoon = asArray(tokens).filter((token: any) => {
      if (!token.expireAt) return false;
      const hours = Math.round(
        (new Date(token.expireAt).getTime() - now) / (1000 * 60 * 60),
      );
      return hours >= 0 && hours <= 72;
    });
    const expired = asArray(tokens).filter(
      (token: any) =>
        token.expireAt && new Date(token.expireAt).getTime() <= now,
    );
    const failing = asArray(tokens).filter(
      (token: any) =>
        token.degraded ||
        ['invalid', 'error', 'failed'].includes(
          String(token.lastCheckStatus || '').toLowerCase(),
        ),
    );
    const byProvider = asArray(tokens).reduce(
      (acc: Record<string, number>, token: any) => {
        const provider = token.provider || 'unknown';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      },
      {},
    );

    return {
      summary: {
        totalTokens: asArray(tokens).length,
        activeTokens: asArray(tokens).filter(
          (token: any) => token.status === 'active',
        ).length,
        primaryTokens: asArray(tokens).filter((token: any) => token.isPrimary)
          .length,
        expiringSoon: expiringSoon.length,
        expired: expired.length,
        failing: failing.length,
        byProvider,
      },
      settings,
      issues: [...failing, ...expired, ...expiringSoon]
        .slice(0, 15)
        .map((token: any) => ({
          _id: String(token._id || token.id || ''),
          name: token.name,
          provider: token.provider,
          status: token.status,
          lastCheckStatus: token.lastCheckStatus || null,
          lastCheckMessage: trimText(token.lastCheckMessage, 220),
          expireAt: token.expireAt || null,
          degraded: !!token.degraded,
        })),
      recentTokens: asArray(tokens)
        .slice(0, 12)
        .map((token: any) => ({
          _id: String(token._id || token.id || ''),
          name: token.name,
          provider: token.provider,
          status: token.status,
          isPrimary: !!token.isPrimary,
          lastCheckStatus: token.lastCheckStatus || null,
          lastCheckedAt: token.lastCheckedAt || null,
          expireAt: token.expireAt || null,
        })),
    };
  }

  async buildAdsSyncHealthSnapshot() {
    const sources: Array<[string, any]> = [
      ['facebook', this.facebookSyncService],
      ['google', this.googleSyncService],
      ['tiktok', this.tiktokSyncService],
    ];
    const results = await Promise.all(
      sources.map(async ([platform, service]) => {
        if (!service) {
          return {
            platform,
            ok: false,
            error: `${platform} sync service is not available`,
          };
        }
        try {
          return { platform, ok: true, data: await service.getSyncHealth() };
        } catch (error: any) {
          return {
            platform,
            ok: false,
            error: error?.message || String(error),
          };
        }
      }),
    );
    const stale = results
      .filter(
        (item: any) =>
          item.ok &&
          typeof item.data?.sync?.freshnessHours === 'number' &&
          item.data.sync.freshnessHours > 24,
      )
      .map((item: any) => ({
        platform: item.platform,
        freshnessHours: item.data.sync.freshnessHours,
        lastSyncAt: item.data.sync.lastSyncAt || null,
      }));
    const tokenIssues = results
      .filter((item: any) => item.ok && item.data?.token)
      .filter(
        (item: any) =>
          item.data.token.configured === false ||
          item.data.token.isExpired === true ||
          ['invalid', 'error', 'failed'].includes(
            String(item.data.token.lastCheckStatus || '').toLowerCase(),
          ),
      )
      .map((item: any) => ({
        platform: item.platform,
        source: item.data.token.source || null,
        lastCheckStatus: item.data.token.lastCheckStatus || null,
        lastCheckMessage: trimText(item.data.token.lastCheckMessage, 220),
        expireAt: item.data.token.expireAt || null,
      }));

    return {
      summary: {
        platforms: results.length,
        okPlatforms: results.filter((item: any) => item.ok).length,
        failedPlatforms: results.filter((item: any) => !item.ok).length,
        stalePlatforms: stale.length,
        tokenIssues: tokenIssues.length,
      },
      platforms: results,
      stale,
      tokenIssues,
    };
  }

  async buildAdvertisingCostByAdGroupSnapshot(startDate: Date, endDate: Date) {
    const from = dateOnly(startDate);
    const to = dateOnly(endDate);
    const [dailySummary, topAdGroups] = await Promise.all([
      this.advertisingCostService
        ? this.advertisingCostService.getDailySummary(from, to)
        : Promise.reject(
            new Error('advertising cost service is not available'),
          ),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$adGroupId',
              spent: { $sum: '$spentAmount' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              messages: { $sum: '$messagingConversationStarted7d' },
              records: { $sum: 1 },
              latestDate: { $max: '$date' },
            },
          },
          { $sort: { spent: -1 } },
          { $limit: 12 },
        ])
        .toArray(),
    ]);

    return {
      from,
      to,
      dailySummary,
      topAdGroups: topAdGroups.map((item: any) => ({
        adGroupId: item._id || null,
        spent: item.spent || 0,
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        messages: item.messages || 0,
        records: item.records || 0,
        latestDate: item.latestDate || null,
      })),
    };
  }

  async buildCostPerOrderSnapshot(startDate: Date, endDate: Date) {
    if (!this.adReportService)
      throw new Error('ad report service is not available');
    const rows = await this.adReportService.costPerOrderByAdGroup({
      from: dateOnly(startDate),
      to: dateOnly(endDate),
    });
    const list = asArray(rows);
    const withOrders = list.filter(
      (item: any) => (item.ordersCount || 0) > 0 && item.costPerOrder != null,
    );
    const noOrdersWithSpend = list.filter(
      (item: any) => (item.totalSpent || 0) > 0 && !(item.ordersCount || 0),
    );
    const totalSpent = list.reduce(
      (sum: number, item: any) => sum + (Number(item.totalSpent) || 0),
      0,
    );
    const totalOrders = list.reduce(
      (sum: number, item: any) => sum + (Number(item.ordersCount) || 0),
      0,
    );

    return {
      from: dateOnly(startDate),
      to: dateOnly(endDate),
      summary: {
        rows: list.length,
        totalSpent,
        totalOrders,
        blendedCostPerOrder: totalOrders > 0 ? totalSpent / totalOrders : null,
        noOrdersWithSpend: noOrdersWithSpend.length,
      },
      worstCostPerOrder: [...withOrders]
        .sort((a: any, b: any) => (b.costPerOrder || 0) - (a.costPerOrder || 0))
        .slice(0, 12),
      noOrdersWithSpend: noOrdersWithSpend
        .sort((a: any, b: any) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 12),
    };
  }

  async buildMarketingDecisionSnapshot(windowDays: number) {
    if (!this.aiMarketingService)
      throw new Error('ai marketing service is not available');
    const [
      overview,
      funnel,
      creatives,
      creativePerformance,
      plans,
      evaluations,
    ] = await Promise.all([
      this.getAiMarketingOverview(windowDays),
      this.aiMarketingService.getLeadFunnel({
        lookbackDays: windowDays,
      } as any),
      this.aiMarketingService.listCreatives({
        lookbackDays: windowDays,
        limit: 20,
      } as any),
      this.aiMarketingService.getCreativePerformance({
        lookbackDays: windowDays,
        limit: 20,
      } as any),
      this.getAiMarketingPlans(),
      this.getAiMarketingEvaluations(),
    ]);
    const creativePerformanceAny = creativePerformance as any;
    const creativesAny = creatives as any;

    return {
      overview,
      funnel,
      creativeSummary:
        creativePerformanceAny?.summary ||
        creativePerformanceAny?.creativeSummary ||
        null,
      creativePerformance: asArray(
        creativePerformanceAny?.items ||
          creativePerformanceAny?.creatives ||
          creativePerformanceAny?.rows,
      ).slice(0, 12),
      creatives: asArray(
        creativesAny?.creatives || creativesAny?.items || creativesAny,
      ).slice(0, 12),
      plans,
      evaluations,
    };
  }

  async getAiMarketingOverview(windowDays: number) {
    if (!this.aiMarketingService)
      throw new Error('ai marketing service is not available');
    const overview = await this.aiMarketingService.getOverview({
      lookbackDays: windowDays,
    } as any);
    return {
      window: overview.window,
      summary: overview.summary,
      creativeSummary: overview.creativeSummary,
      funnel: overview.funnel,
      planStats: overview.planStats,
      evaluationStats: overview.evaluationStats,
      assistantQuality: overview.assistantQuality,
      readiness: overview.readiness,
    };
  }

  async getAiMarketingPlans() {
    if (!this.aiMarketingService)
      throw new Error('ai marketing service is not available');
    const result = await this.aiMarketingService.listPlans({
      limit: 10,
    } as any);
    return {
      total: result.total,
      plans: asArray(result.plans)
        .slice(0, 10)
        .map((plan: any) => ({
          _id: String(plan._id),
          title: plan.title,
          status: plan.status,
          generatedAt: plan.generatedAt || plan.createdAt,
          itemCount: Array.isArray(plan.items) ? plan.items.length : 0,
          approvedCount: asArray(plan.items).filter(
            (item: any) => item.approvalStatus === 'approved',
          ).length,
        })),
    };
  }

  async getAiMarketingEvaluations() {
    if (!this.aiMarketingService)
      throw new Error('ai marketing service is not available');
    const result = await this.aiMarketingService.listEvaluations({
      limit: 10,
    } as any);
    return {
      summary: result.summary,
      evaluations: asArray(result.evaluations)
        .slice(0, 10)
        .map((item: any) => ({
          _id: String(item._id),
          adGroupId: item.adGroupId,
          status: item.status,
          verdict: item.verdict || null,
          actionType: item.actionType || null,
          evaluatedAt: item.evaluatedAt || item.updatedAt,
        })),
    };
  }

  async buildAdsDiagnosticOverview(
    startDate: Date,
    endDate: Date,
    windowDays: number,
  ) {
    const messageDateMatch = {
      $or: [
        { receivedAt: { $gte: startDate, $lte: endDate } },
        {
          receivedAt: { $exists: false },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      ],
    };
    const conversationDateMatch = {
      $or: [
        { lastMessageAt: { $gte: startDate, $lte: endDate } },
        {
          lastMessageAt: { $exists: false },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      ],
    };

    const [
      adAccounts,
      adGroups,
      fanpages,
      tokenHealth,
      syncHealth,
      spendSummaryRows,
      spendByAdGroupRows,
      spendByAccountRows,
      inboundSummaryRows,
      inboundByAdGroupRows,
      conversationSummaryRows,
      conversationAttributionRows,
      pendingOrderSummaryRows,
      pendingOrderByAdGroupRows,
      performanceRows,
      optimalSpendSuggestions,
    ] = await Promise.all([
      this.adAccountModel
        .find(
          {},
          {
            name: 1,
            accountId: 1,
            accountType: 1,
            isActive: 1,
            accountStatus: 1,
            lastSyncAt: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            tokenSource: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.adGroupModel
        .find(
          {},
          {
            name: 1,
            adGroupId: 1,
            platform: 1,
            isActive: 1,
            adAccountId: 1,
            fanpageId: 1,
            campaignId: 1,
            remoteStatus: 1,
            effectiveStatus: 1,
            dailyBudget: 1,
            lastSyncAt: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            selectedProducts: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.fanpageModel
        .find(
          {},
          {
            pageId: 1,
            name: 1,
            status: 1,
            aiEnabled: 1,
            subscribedWebhook: 1,
            hasAccessToken: 1,
            lastRefreshAt: 1,
            updatedAt: 1,
          },
        )
        .lean(),
      this.buildApiTokenSnapshot().catch((error: any) => ({
        error: error?.message || String(error),
      })),
      this.buildAdsSyncHealthSnapshot().catch((error: any) => ({
        error: error?.message || String(error),
      })),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: null,
              records: { $sum: 1 },
              spent: { $sum: '$spentAmount' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              conversations: { $sum: '$messagingConversationStarted7d' },
              firstDate: { $min: '$date' },
              latestDate: { $max: '$date' },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$adGroupId',
              spent: { $sum: '$spentAmount' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              conversations: { $sum: '$messagingConversationStarted7d' },
              records: { $sum: 1 },
              latestDate: { $max: '$date' },
            },
          },
          { $sort: { spent: -1 } },
          { $limit: 25 },
        ])
        .toArray(),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: {
                accountId: { $ifNull: ['$customerId', 'unknown'] },
                channel: { $ifNull: ['$channel', 'unknown'] },
              },
              spent: { $sum: '$spentAmount' },
              records: { $sum: 1 },
              conversations: { $sum: '$messagingConversationStarted7d' },
              latestDate: { $max: '$date' },
            },
          },
          { $sort: { spent: -1 } },
          { $limit: 25 },
        ])
        .toArray(),
      this.orderModel.db
        .collection('chatmessages')
        .aggregate([
          { $match: { direction: 'in', ...messageDateMatch } },
          {
            $group: {
              _id: null,
              inbox: { $sum: 1 },
              awaitingHuman: { $sum: { $cond: ['$awaitingHuman', 1, 0] } },
              uniqueSenders: { $addToSet: '$senderPsid' },
              latestAt: { $max: { $ifNull: ['$receivedAt', '$createdAt'] } },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('chatmessages')
        .aggregate([
          { $match: { direction: 'in', ...messageDateMatch } },
          {
            $group: {
              _id: { $ifNull: ['$adGroupId', 'unknown'] },
              inbox: { $sum: 1 },
              awaitingHuman: { $sum: { $cond: ['$awaitingHuman', 1, 0] } },
              uniqueSenders: { $addToSet: '$senderPsid' },
              latestAt: { $max: { $ifNull: ['$receivedAt', '$createdAt'] } },
            },
          },
          { $sort: { inbox: -1 } },
          { $limit: 25 },
        ])
        .toArray(),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...conversationDateMatch } },
        {
          $group: {
            _id: null,
            conversations: { $sum: 1 },
            needsHuman: { $sum: { $cond: ['$needsHuman', 1, 0] } },
            awaitingCount: { $sum: '$awaitingCount' },
            withAdGroup: {
              $sum: { $cond: [{ $ifNull: ['$lastAdGroupId', false] }, 1, 0] },
            },
            latestAt: { $max: '$lastMessageAt' },
          },
        },
      ]),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...conversationDateMatch } },
        {
          $group: {
            _id: null,
            linkedToErp: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ifNull: ['$orderId', false] },
                      { $ifNull: ['$pendingOrderId', false] },
                      {
                        $in: [
                          '$orderDraftStatus',
                          ['draft', 'awaiting', 'approved'],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            unattributed: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ifNull: ['$lastAdGroupId', false] },
                      { $not: [{ $ifNull: ['$orderId', false] }] },
                      { $not: [{ $ifNull: ['$pendingOrderId', false] }] },
                      {
                        $not: [
                          {
                            $in: [
                              '$orderDraftStatus',
                              ['draft', 'awaiting', 'approved'],
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      this.pendingOrderModel.aggregate([
        {
          $match: {
            $or: [
              { capturedAt: { $gte: startDate, $lte: endDate } },
              {
                capturedAt: { $exists: false },
                createdAt: { $gte: startDate, $lte: endDate },
              },
            ],
          },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.pendingOrderModel.aggregate([
        {
          $match: {
            $or: [
              { capturedAt: { $gte: startDate, $lte: endDate } },
              {
                capturedAt: { $exists: false },
                createdAt: { $gte: startDate, $lte: endDate },
              },
            ],
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$adGroupId', 'unknown'] },
            pendingOrders: { $sum: 1 },
            draftOrAwaiting: {
              $sum: {
                $cond: [{ $in: ['$status', ['draft', 'awaiting']] }, 1, 0],
              },
            },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
            },
            latestAt: { $max: { $ifNull: ['$capturedAt', '$createdAt'] } },
          },
        },
        { $sort: { pendingOrders: -1 } },
        { $limit: 25 },
      ]),
      this.profitReportService
        .getAdGroupPerformanceReport({
          startDate,
          endDate,
          minOrders: 1,
          onlyFinalized: true,
        })
        .catch(() => []),
      this.profitReportService
        .getOptimalSpendSuggestions({ lookbackDays: windowDays })
        .catch(() => []),
    ]);

    const accountByObjectId = new Map(
      asArray(adAccounts).map((item: any) => [String(item._id), item]),
    );
    const accountByProviderId = new Map(
      asArray(adAccounts).map((item: any) => [
        String(item.accountId || ''),
        item,
      ]),
    );
    const adGroupById = new Map(
      asArray(adGroups).map((item: any) => [
        String(item.adGroupId || ''),
        item,
      ]),
    );
    const fanpagesList = asArray(fanpages);
    const activeAdGroup = (group: any) => {
      const statusText = removeVietnameseTone(
        `${group?.remoteStatus || ''} ${group?.effectiveStatus || ''}`,
      ).toLowerCase();
      const badStatus = [
        'paused',
        'error',
        'disabled',
        'disable',
        'inactive',
        'archived',
        'deleted',
        'disapproved',
        'rejected',
      ].some((needle) => statusText.includes(needle));
      return (
        group?.isActive === true &&
        !badStatus &&
        group?.lastSyncStatus !== 'error'
      );
    };
    const pausedOrErrorAdGroups = asArray(adGroups).filter(
      (group: any) => !activeAdGroup(group),
    );
    const campaignIds = Array.from(
      new Set(
        asArray(adGroups)
          .map((group: any) => group.campaignId)
          .filter(Boolean),
      ),
    );
    const activeCampaignIds = Array.from(
      new Set(
        asArray(adGroups)
          .filter(activeAdGroup)
          .map((group: any) => group.campaignId)
          .filter(Boolean),
      ),
    );
    const tokenSummary = (tokenHealth as any)?.summary || null;
    const syncSummary = (syncHealth as any)?.summary || null;
    const providerErrors = [
      ...asArray(adAccounts)
        .filter((item: any) => item.lastSyncStatus === 'error')
        .map((item: any) => ({
          provider: item.accountType || 'unknown',
          source: item.name || item.accountId,
          message: trimText(item.lastSyncError, 180),
          lastSyncAt: item.lastSyncAt || null,
        })),
      ...pausedOrErrorAdGroups
        .filter((item: any) => item.lastSyncStatus === 'error')
        .map((item: any) => ({
          provider: item.platform || 'unknown',
          source: item.name || item.adGroupId,
          message: trimText(item.lastSyncError, 180),
          lastSyncAt: item.lastSyncAt || null,
        })),
      ...asArray((syncHealth as any)?.tokenIssues).map((item: any) => ({
        provider: item.platform || item.provider || 'unknown',
        source: item.source || 'sync-token',
        message: trimText(item.lastCheckMessage || item.lastCheckStatus, 180),
        lastSyncAt: item.expireAt || null,
      })),
      ...asArray((syncHealth as any)?.platforms)
        .filter((item: any) => item.ok === false)
        .map((item: any) => ({
          provider: item.platform || 'unknown',
          source: 'sync-health',
          message: trimText(item.error, 180),
          lastSyncAt: null,
        })),
    ];
    const missingPermissionFanpages = fanpagesList.filter(
      (page: any) => !page.hasAccessToken || page.subscribedWebhook !== true,
    );
    const spendSummary = spendSummaryRows[0] || {
      records: 0,
      spent: 0,
      impressions: 0,
      clicks: 0,
      conversations: 0,
      latestDate: null,
    };
    const inboundSummary = inboundSummaryRows[0] || {
      inbox: 0,
      awaitingHuman: 0,
      uniqueSenders: [],
      latestAt: null,
    };
    const conversationSummary = conversationSummaryRows[0] || {
      conversations: 0,
      needsHuman: 0,
      awaitingCount: 0,
      withAdGroup: 0,
      latestAt: null,
    };
    const conversationAttribution = conversationAttributionRows[0] || {
      linkedToErp: 0,
      unattributed: 0,
    };
    const pendingByStatus = asArray(pendingOrderSummaryRows).reduce(
      (acc: Record<string, number>, row: any) => {
        acc[row._id || 'unknown'] = row.count || 0;
        return acc;
      },
      {},
    );
    const totalPendingOrders = Object.values(pendingByStatus).reduce(
      (sum: number, value: any) => sum + (Number(value) || 0),
      0,
    );
    const pendingDraftAwaiting =
      (pendingByStatus.draft || 0) + (pendingByStatus.awaiting || 0);
    const spendByAdGroup = asArray(spendByAdGroupRows).map((row: any) => {
      const group = adGroupById.get(String(row._id || ''));
      return {
        adGroupId: row._id || null,
        adGroupName: group?.name || row._id || 'unknown',
        platform: group?.platform || null,
        spent: row.spent || 0,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        conversations: row.conversations || 0,
        records: row.records || 0,
        latestDate: row.latestDate || null,
      };
    });
    const spendByAccount = asArray(spendByAccountRows).map((row: any) => {
      const accountId = row._id?.accountId || 'unknown';
      const account = accountByProviderId.get(String(accountId));
      return {
        accountId,
        accountName: account?.name || accountId,
        provider: account?.accountType || row._id?.channel || 'unknown',
        spent: row.spent || 0,
        records: row.records || 0,
        conversations: row.conversations || 0,
        latestDate: row.latestDate || null,
      };
    });
    const inboundByAdGroup = asArray(inboundByAdGroupRows).map((row: any) => {
      const group = adGroupById.get(String(row._id || ''));
      return {
        adGroupId: row._id || null,
        adGroupName: group?.name || row._id || 'unknown',
        inbox: row.inbox || 0,
        awaitingHuman: row.awaitingHuman || 0,
        uniqueLeads: asArray(row.uniqueSenders).length,
        latestAt: row.latestAt || null,
      };
    });
    const pendingByAdGroup = asArray(pendingOrderByAdGroupRows).map(
      (row: any) => {
        const group = adGroupById.get(String(row._id || ''));
        return {
          adGroupId: row._id || null,
          adGroupName: group?.name || row._id || 'unknown',
          pendingOrders: row.pendingOrders || 0,
          draftOrAwaiting: row.draftOrAwaiting || 0,
          approved: row.approved || 0,
          latestAt: row.latestAt || null,
        };
      },
    );
    const performance = asArray(performanceRows);
    const suggestions = asArray(optimalSpendSuggestions);
    const performanceByAdGroup = new Map(
      performance.map((item: any) => [String(item.adGroupId || ''), item]),
    );
    const suggestionByAdGroup = new Map(
      suggestions.map((item: any) => [String(item.adGroupId || ''), item]),
    );
    const leadByAdGroup = new Map<string, number>();
    for (const row of inboundByAdGroup) {
      if (row.adGroupId)
        leadByAdGroup.set(
          String(row.adGroupId),
          (leadByAdGroup.get(String(row.adGroupId)) || 0) + row.uniqueLeads,
        );
    }
    for (const row of pendingByAdGroup) {
      if (row.adGroupId)
        leadByAdGroup.set(
          String(row.adGroupId),
          (leadByAdGroup.get(String(row.adGroupId)) || 0) + row.pendingOrders,
        );
    }
    const spendByAdGroupMap = new Map(
      spendByAdGroup.map((item: any) => [String(item.adGroupId || ''), item]),
    );
    const adGroupIdsForReadiness = Array.from(
      new Set([
        ...asArray(adGroups)
          .map((item: any) => item.adGroupId)
          .filter(Boolean),
        ...spendByAdGroup.map((item: any) => item.adGroupId).filter(Boolean),
        ...performance.map((item: any) => item.adGroupId).filter(Boolean),
      ]),
    ).slice(0, 60);
    const readinessItems = adGroupIdsForReadiness.map((adGroupId: any) => {
      const id = String(adGroupId);
      const group = adGroupById.get(id);
      const spend = Number(spendByAdGroupMap.get(id)?.spent || 0);
      const leadCount = Number(leadByAdGroup.get(id) || 0);
      const perf = performanceByAdGroup.get(id);
      const suggestion = suggestionByAdGroup.get(id);
      if (spend <= 0) {
        return {
          adGroupId: id,
          adGroupName: group?.name || perf?.adGroupName || id,
          status: 'not_ready',
          reason: 'spend = 0',
          spent: spend,
          leadCount,
          hasProfit: !!perf,
        };
      }
      if (leadCount <= 0) {
        return {
          adGroupId: id,
          adGroupName: group?.name || perf?.adGroupName || id,
          status: 'not_ready',
          reason: 'thiếu lead/inbox',
          spent: spend,
          leadCount,
          hasProfit: !!perf,
        };
      }
      if (!perf) {
        return {
          adGroupId: id,
          adGroupName: group?.name || id,
          status: 'not_ready',
          reason: 'thiếu profit/order attribution',
          spent: spend,
          leadCount,
          hasProfit: false,
        };
      }
      if (suggestion) {
        return {
          adGroupId: id,
          adGroupName:
            group?.name || suggestion.adGroupName || perf.adGroupName || id,
          status: 'pending_approval',
          reason: suggestion.reason || 'đủ dữ liệu và có đề xuất optimal spend',
          spent: spend,
          leadCount,
          hasProfit: true,
          action: suggestion.scaleAction || 'maintain',
          suggestedSpend:
            suggestion.suggestedSpend ?? suggestion.appliedSpend ?? null,
          confidence: suggestion.confidence ?? null,
        };
      }
      return {
        adGroupId: id,
        adGroupName: group?.name || perf.adGroupName || id,
        status: 'ready_review',
        reason: 'đủ spend, lead và profit; chưa có đề xuất tự động',
        spent: spend,
        leadCount,
        hasProfit: true,
      };
    });

    const missingData = [
      'Chưa có collection Campaign riêng; campaign đang được suy từ campaignId trên AdGroup.',
      'Chưa có collection Ads/Creative riêng nên chưa đếm được ads active thật theo từng mẫu quảng cáo.',
      'Chưa có module Lead/Form riêng; lead hiện được suy từ inbox, conversation và pending-order.',
      'Token fanpage không có trường expireAt riêng; hạn token được kiểm tra qua ApiToken/sync health nếu có.',
    ];

    return {
      generatedAt: endDate.toISOString(),
      windowDays,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      accounts: {
        total: asArray(adAccounts).length,
        active: asArray(adAccounts).filter(
          (item: any) => item.isActive === true,
        ).length,
        checked: true,
        tokenSummary,
        tokenValid: tokenSummary
          ? (tokenSummary.expired || 0) === 0 &&
            (tokenSummary.failing || 0) === 0
          : null,
        providerErrorCount: providerErrors.length,
        providerErrors: providerErrors.slice(0, 10),
        byProvider: asArray(adAccounts).reduce(
          (acc: Record<string, any>, item: any) => {
            const provider = item.accountType || 'unknown';
            acc[provider] = acc[provider] || {
              total: 0,
              active: 0,
              syncErrors: 0,
            };
            acc[provider].total += 1;
            if (item.isActive === true) acc[provider].active += 1;
            if (item.lastSyncStatus === 'error') acc[provider].syncErrors += 1;
            return acc;
          },
          {},
        ),
        recent: asArray(adAccounts)
          .slice(0, 12)
          .map((item: any) => ({
            _id: String(item._id),
            name: item.name,
            accountId: item.accountId,
            provider: item.accountType,
            isActive: item.isActive === true,
            accountStatus: item.accountStatus ?? null,
            lastSyncAt: item.lastSyncAt || null,
            lastSyncStatus: item.lastSyncStatus || null,
            lastSyncError: trimText(item.lastSyncError, 160),
            tokenSource: item.tokenSource || null,
          })),
      },
      fanpages: {
        total: fanpagesList.length,
        active: fanpagesList.filter((page: any) => page.status === 'active')
          .length,
        activePages: fanpagesList
          .filter((page: any) => page.status === 'active')
          .slice(0, 12)
          .map((page: any) => ({
            pageId: page.pageId,
            name: page.name,
            aiEnabled: !!page.aiEnabled,
            subscribedWebhook: !!page.subscribedWebhook,
          })),
        missingPermissionCount: missingPermissionFanpages.length,
        missingPermissions: missingPermissionFanpages
          .slice(0, 12)
          .map((page: any) => ({
            pageId: page.pageId,
            name: page.name,
            missing: [
              !page.hasAccessToken ? 'accessToken' : null,
              page.subscribedWebhook !== true ? 'subscribedWebhook' : null,
            ].filter(Boolean),
            lastRefreshAt: page.lastRefreshAt || null,
          })),
      },
      sync: {
        lastSyncAt:
          [
            ...asArray(adAccounts)
              .map((item: any) => item.lastSyncAt)
              .filter(Boolean),
            ...asArray(adGroups)
              .map((item: any) => item.lastSyncAt)
              .filter(Boolean),
            spendSummary.latestDate,
            conversationSummary.latestAt,
          ].sort(
            (a: any, b: any) => new Date(b).getTime() - new Date(a).getTime(),
          )[0] || null,
        summary: syncSummary,
        health: syncHealth,
        hasFacebookError: asArray(providerErrors).some(
          (item: any) => item.provider === 'facebook',
        ),
        hasGoogleError: asArray(providerErrors).some(
          (item: any) => item.provider === 'google',
        ),
        errorLogs: providerErrors.slice(0, 10),
      },
      entities: {
        campaigns: {
          totalInferred: campaignIds.length,
          activeInferred: activeCampaignIds.length,
          pausedOrErrorInferred: Math.max(
            0,
            campaignIds.length - activeCampaignIds.length,
          ),
          dataSource: 'adgroups.campaignId',
        },
        adsets: {
          total: asArray(adGroups).length,
          active: asArray(adGroups).filter(activeAdGroup).length,
          pausedOrError: pausedOrErrorAdGroups.length,
          pausedOrErrorItems: pausedOrErrorAdGroups
            .slice(0, 12)
            .map((group: any) => ({
              adGroupId: group.adGroupId,
              name: group.name,
              platform: group.platform,
              remoteStatus: group.remoteStatus || null,
              effectiveStatus: group.effectiveStatus || null,
              lastSyncStatus: group.lastSyncStatus || null,
              lastSyncError: trimText(group.lastSyncError, 160),
            })),
        },
        ads: {
          active: null,
          dataSource: 'missing_ads_collection',
        },
      },
      spend7d: {
        totalSpent: spendSummary.spent || 0,
        records: spendSummary.records || 0,
        impressions: spendSummary.impressions || 0,
        clicks: spendSummary.clicks || 0,
        conversations: spendSummary.conversations || 0,
        latestDate: spendSummary.latestDate || null,
        byAccount: spendByAccount,
        byAdGroup: spendByAdGroup,
      },
      leads: {
        leadCount:
          asArray(inboundSummary.uniqueSenders).length ||
          inboundSummary.inbox ||
          0,
        inboxCount: inboundSummary.inbox || 0,
        formCount: null,
        unhandledLeadCount:
          (conversationSummary.needsHuman || 0) +
          pendingDraftAwaiting +
          (inboundSummary.awaitingHuman || 0),
        needsHuman: conversationSummary.needsHuman || 0,
        awaitingMessages: inboundSummary.awaitingHuman || 0,
        pendingOrders: totalPendingOrders,
        pendingByStatus,
        byAdGroup: inboundByAdGroup,
      },
      attribution: {
        linkedToErp:
          (conversationAttribution.linkedToErp || 0) +
          (pendingByStatus.approved || 0),
        unattributed: conversationAttribution.unattributed || 0,
        conversationsWithAdGroup: conversationSummary.withAdGroup || 0,
        pendingByAdGroup,
      },
      profit: {
        groupsWithRevenue: performance
          .filter((item: any) => (item.totalRevenue || 0) > 0)
          .slice(0, 12),
        groupsWithProfit: performance
          .filter((item: any) => (item.totalNetProfit || 0) > 0)
          .slice(0, 12),
        groupsWithoutData: asArray(adGroups)
          .filter(
            (group: any) =>
              !performanceByAdGroup.has(String(group.adGroupId || '')),
          )
          .slice(0, 12)
          .map((group: any) => ({
            adGroupId: group.adGroupId,
            name: group.name,
            isActive: !!group.isActive,
            platform: group.platform,
          })),
      },
      pnl: {
        winning: performance
          .filter((item: any) => (item.totalNetProfit || 0) > 0)
          .slice(0, 12),
        losing: performance
          .filter(
            (item: any) =>
              (item.totalAdsSpent || 0) > 0 && (item.totalNetProfit || 0) < 0,
          )
          .slice(0, 12),
        insufficientData: asArray(adGroups)
          .filter(
            (group: any) =>
              !performanceByAdGroup.has(String(group.adGroupId || '')),
          )
          .slice(0, 12)
          .map((group: any) => ({
            adGroupId: group.adGroupId,
            name: group.name,
            isActive: !!group.isActive,
            platform: group.platform,
          })),
      },
      readiness: {
        summary: {
          totalChecked: readinessItems.length,
          notReady: readinessItems.filter(
            (item: any) => item.status === 'not_ready',
          ).length,
          pendingApproval: readinessItems.filter(
            (item: any) => item.status === 'pending_approval',
          ).length,
          readyReview: readinessItems.filter(
            (item: any) => item.status === 'ready_review',
          ).length,
        },
        items: readinessItems.slice(0, 25),
      },
      missingData,
    };
  }
}
