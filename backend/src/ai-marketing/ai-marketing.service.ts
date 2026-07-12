import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { BudgetApplyService } from '../advertising-optimization/ai-optimization/budget-apply.service';
import {
  buildAiAssistantQualityDirectives,
  gradeAssistantConfidence,
} from '../common/ai-assistant-quality';
import {
  CANONICAL_ADS_EXECUTION_REQUIRED,
  getAdsSafetyConfig,
} from '../common/ads-safety-config';
import { redactSecrets, redactSecretString } from '../common/utils/secret-redaction.util';
import { ChatMessage, ChatMessageDocument } from '../chat-message/schemas/chat-message.schema';
import { PendingOrder, PendingOrderDocument } from '../pending-order/schemas/pending-order.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import {
  ApplyPlanDto,
  ApprovePlanItemDto,
  CreateMarketingLeadDto,
  CreateCreativeAssetDto,
  CreativePerformanceQueryDto,
  DirectAdGroupActionDto,
  EvaluationQueryDto,
  GenerateAdsPlanDto,
  LeadFunnelQueryDto,
  ListPlansQueryDto,
  SyncLeadsDto,
  UpdateCreativeAssetDto,
  UpdateMarketingLeadDto,
} from './dto/ai-marketing.dto';
import {
  AdsActionPlan,
  AdsActionPlanDocument,
  AdsActionPlanItem,
  AdsActionType,
} from './schemas/ads-action-plan.schema';
import {
  AdsActionExecutionLog,
  AdsActionExecutionLogDocument,
  AdsExecutionStatus,
} from './schemas/ads-action-execution-log.schema';
import {
  AdsActionEvaluation,
  AdsActionEvaluationDocument,
} from './schemas/ads-action-evaluation.schema';
import { CreativeAsset, CreativeAssetDocument } from './schemas/creative-asset.schema';
import { MarketingLead, MarketingLeadDocument } from './schemas/marketing-lead.schema';

interface DateWindow {
  from: Date;
  to: Date;
  lookbackDays: number;
}

interface AdGroupMarketingMetrics {
  adGroupId: string;
  adGroupName?: string;
  platform?: string;
  assignedEmployeeId?: string;
  adsSpent: number;
  explicitLeads: number;
  inferredConversationLeads: number;
  totalLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  noResponseLeads: number;
  unhandledLeads: number;
  pendingOrders: number;
  totalOrders: number;
  successOrders: number;
  returnOrders: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  roi: number;
  closeRate: number;
  costPerLead: number;
  costPerOrder: number;
  saleIssue: boolean;
  saleIssueReason?: string;
  dataQuality: 'explicit_leads' | 'inferred_from_chat' | 'orders_only';
  dataQualityScore: number;
  dataQualityGrade: 'high' | 'medium' | 'low';
  dataQualityReasons: string[];
}

const ADS_SAFETY_CONFIG = getAdsSafetyConfig();
// ai-marketing remains a planning, approval and dry-run surface. Live provider
// mutation is owned exclusively by the canonical Google Ads V2 execution plan.
const AI_MARKETING_PROVIDER_EXECUTION_ENABLED = false;

@Injectable()
export class AiMarketingService {
  private readonly logger = new Logger(AiMarketingService.name);

  private readonly successStatuses = [
    'Giao thanh cong',
    'Giao th\u00e0nh c\u00f4ng',
    'Da doi soat',
    '\u0110\u00e3 \u0111\u1ed1i so\u00e1t',
    'Hoan thanh',
    'Ho\u00e0n th\u00e0nh',
  ];

  private readonly returnStatuses = [
    'Hang hoan',
    'H\u00e0ng ho\u00e0n',
    'Hoan hang',
    'Ho\u00e0n h\u00e0ng',
  ];

  constructor(
    @InjectModel(MarketingLead.name)
    private readonly leadModel: Model<MarketingLeadDocument>,
    @InjectModel(AdsActionPlan.name)
    private readonly planModel: Model<AdsActionPlanDocument>,
    @InjectModel(AdsActionExecutionLog.name)
    private readonly executionLogModel: Model<AdsActionExecutionLogDocument>,
    @InjectModel(AdsActionEvaluation.name)
    private readonly evaluationModel: Model<AdsActionEvaluationDocument>,
    @InjectModel(CreativeAsset.name)
    private readonly creativeModel: Model<CreativeAssetDocument>,
    @InjectModel(AdvertisingCost.name)
    private readonly advertisingCostModel: Model<AdvertisingCostDocument>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(PendingOrder.name)
    private readonly pendingOrderModel: Model<PendingOrderDocument>,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly adGroupProfitReportService: AdGroupProfitReportService,
    private readonly budgetApplyService: BudgetApplyService,
  ) {}

  @Cron('0 7,13,19 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runMaintenanceCron() {
    try {
      const sync = await this.syncLeadsFromSignals({ lookbackDays: 7, limit: 3000 });
      const evaluation = await this.evaluateDueActions(false);
      this.logger.log(`AI Marketing maintenance done: synced=${sync.totalUpserts}, evaluated=${evaluation.evaluated}`);
    } catch (error: any) {
      this.logger.warn(`AI Marketing maintenance failed: ${redactSecretString(error?.message || String(error))}`);
    }
  }

  async createLead(body: CreateMarketingLeadDto) {
    const leadCreatedAt = body.leadCreatedAt ? new Date(body.leadCreatedAt) : new Date();
    const firstResponseAt = body.firstResponseAt ? new Date(body.firstResponseAt) : undefined;
    const lastFollowUpAt = body.lastFollowUpAt ? new Date(body.lastFollowUpAt) : undefined;
    const responseSlaSeconds =
      firstResponseAt && leadCreatedAt
        ? Math.max(0, Math.round((firstResponseAt.getTime() - leadCreatedAt.getTime()) / 1000))
        : undefined;

    const lead = await this.leadModel.create({
      ...body,
      leadCreatedAt,
      firstResponseAt,
      lastFollowUpAt,
      responseSlaSeconds,
    });

    return { success: true, lead };
  }

  async syncLeadsFromSignals(body: SyncLeadsDto = {}) {
    const window = this.resolveWindow(body);
    const limit = body.limit || 3000;
    const operations: any[] = [];

    const inboundMessages = await this.chatMessageModel
      .find({
        direction: 'in',
        adGroupId: { $exists: true, $nin: [null, ''] },
        receivedAt: { $gte: window.from, $lte: window.to },
      })
      .sort({ receivedAt: 1 })
      .limit(limit)
      .lean();

    const firstByConversation = new Map<string, any>();
    for (const message of inboundMessages as any[]) {
      const sourcePlatform = message.sourcePlatform || 'facebook';
      const fanpageId = message.fanpageId ? String(message.fanpageId) : 'unknown';
      const key = `chat:${sourcePlatform}:${fanpageId}:${message.senderPsid}:${message.adGroupId}`;
      if (!firstByConversation.has(key)) firstByConversation.set(key, message);
    }

    for (const [sourceLeadKey, message] of firstByConversation) {
      const firstResponse = await this.chatMessageModel
        .findOne({
          direction: 'out',
          fanpageId: message.fanpageId,
          senderPsid: message.senderPsid,
          receivedAt: { $gte: message.receivedAt },
        })
        .sort({ receivedAt: 1 })
        .lean();
      const leadCreatedAt = new Date(message.receivedAt || message.createdAt || new Date());
      const firstResponseAt = firstResponse?.receivedAt ? new Date(firstResponse.receivedAt) : undefined;
      operations.push({
        updateOne: {
          filter: { sourceLeadKey },
          update: {
            $set: {
              sourceLeadKey,
              sourcePlatform: message.sourcePlatform || 'facebook',
              leadCreatedAt,
              fanpageId: message.fanpageId ? String(message.fanpageId) : undefined,
              adGroupId: message.adGroupId,
              conversationId: `${message.sourcePlatform || 'facebook'}:${message.fanpageId || 'unknown'}:${message.senderPsid}`,
              senderPsid: message.senderPsid,
              status: firstResponseAt ? 'contacted' : 'new',
              firstResponseAt,
              responseSlaSeconds: firstResponseAt
                ? Math.max(0, Math.round((firstResponseAt.getTime() - leadCreatedAt.getTime()) / 1000))
                : undefined,
              raw: { source: 'chat-message', messageId: String(message._id) },
            },
          },
          upsert: true,
        },
      });
    }

    const pendingOrders = await this.pendingOrderModel
      .find({
        adGroupId: { $exists: true, $nin: [null, ''] },
        capturedAt: { $gte: window.from, $lte: window.to },
      })
      .sort({ capturedAt: 1 })
      .limit(limit)
      .lean();

    for (const pending of pendingOrders as any[]) {
      const sourceLeadKey = `pending-order:${pending._id}`;
      operations.push({
        updateOne: {
          filter: { sourceLeadKey },
          update: {
            $set: {
              sourceLeadKey,
              sourcePlatform: 'facebook',
              leadCreatedAt: new Date(pending.capturedAt || pending.createdAt || new Date()),
              fanpageId: pending.fanpageId ? String(pending.fanpageId) : undefined,
              adGroupId: pending.adGroupId,
              customerName: pending.customerName,
              phone: pending.phone,
              conversationId: pending.senderPsid
                ? `facebook:${pending.fanpageId || 'unknown'}:${pending.senderPsid}`
                : undefined,
              senderPsid: pending.senderPsid,
              assignedSaleId: pending.agentId,
              status: pending.status === 'rejected' ? 'lost' : pending.status === 'draft' ? 'new' : 'quoted',
              raw: { source: 'pending-order', pendingOrderId: String(pending._id), status: pending.status },
            },
          },
          upsert: true,
        },
      });
    }

    const orders = await this.orderModel
      .find({
        adGroupId: { $exists: true, $nin: [null, ''] },
        isActive: { $ne: false },
        ...this.buildOrderDateMatch(window.from, window.to),
      })
      .sort({ orderDate: 1, createdAt: 1 })
      .limit(limit)
      .lean();

    for (const order of orders as any[]) {
      const sourceLeadKey = `order:${order._id}`;
      operations.push({
        updateOne: {
          filter: { sourceLeadKey },
          update: {
            $set: {
              sourceLeadKey,
              sourcePlatform: 'other',
              leadCreatedAt: new Date(order.orderDate || order.createdAt || new Date()),
              adGroupId: order.adGroupId,
              customerName: order.customerName || order.receiverName,
              phone: order.receiverPhone,
              assignedSaleId: order.agentId,
              status: this.successStatuses.includes(order.orderStatus)
                ? 'won'
                : this.returnStatuses.includes(order.orderStatus)
                  ? 'lost'
                  : 'qualified',
              orderId: order._id,
              revenue: order.codCollectedBySupplier || 0,
              grossProfit: order.grossProfit || 0,
              netProfit: order.netProfit || 0,
              raw: { source: 'ordertest2', orderStatus: order.orderStatus },
            },
          },
          upsert: true,
        },
      });
    }

    if (!operations.length) {
      return { success: true, window, totalUpserts: 0, matched: 0, modified: 0 };
    }

    const result: any = await this.leadModel.bulkWrite(operations, { ordered: false });
    return {
      success: true,
      window,
      totalSignals: operations.length,
      totalUpserts: (result.upsertedCount || 0) + (result.modifiedCount || 0),
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
      upserted: result.upsertedCount || 0,
    };
  }

  async updateLead(leadId: string, body: UpdateMarketingLeadDto) {
    const update: Record<string, any> = { ...body };
    if (body.firstResponseAt) update.firstResponseAt = new Date(body.firstResponseAt);
    if (body.lastFollowUpAt) update.lastFollowUpAt = new Date(body.lastFollowUpAt);

    const lead = await this.leadModel.findByIdAndUpdate(leadId, update, { new: true }).lean();
    if (!lead) throw new NotFoundException('Marketing lead not found');
    return { success: true, lead };
  }

  async getOverview(query: LeadFunnelQueryDto) {
    const window = this.resolveWindow(query);
    const [funnel, planStats, evaluationStats, profitSummary, creativePerformance] = await Promise.all([
      this.getLeadFunnel(query),
      this.getPlanStats(window),
      this.getEvaluationStats(),
      this.adGroupProfitReportService.getProfitSummary({ startDate: window.from, endDate: window.to }),
      this.getCreativePerformance({ lookbackDays: window.lookbackDays }),
    ]);
    const rows = funnel.rows || [];
    const highQualityRows = rows.filter((row) => row.dataQualityScore >= 75).length;
    const mediumQualityRows = rows.filter((row) => row.dataQualityScore >= 50 && row.dataQualityScore < 75).length;
    const lowQualityRows = rows.filter((row) => row.dataQualityScore < 50).length;
    const dataReadinessStatus =
      rows.length > 0 && lowQualityRows === 0 && highQualityRows >= Math.ceil(rows.length * 0.6)
        ? 'production_ready_after_live_provider_validation'
        : rows.length > 0 && highQualityRows + mediumQualityRows >= Math.ceil(rows.length * 0.6)
          ? 'pilot_ready_with_approval_required'
          : 'analysis_only_until_data_quality_improves';
    const readinessStatus = AI_MARKETING_PROVIDER_EXECUTION_ENABLED
      ? dataReadinessStatus
      : dataReadinessStatus === 'analysis_only_until_data_quality_improves'
        ? dataReadinessStatus
        : 'plan_ready_canonical_v2_required';
    const avgDataQualityScore = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + (row.dataQualityScore || 0), 0) / rows.length)
      : 0;
    const assistantQuality = this.buildMarketingAssistantQuality({
      readinessStatus,
      totalRows: rows.length,
      highQualityRows,
      mediumQualityRows,
      lowQualityRows,
      avgDataQualityScore,
    });

    return {
      success: true,
      window,
      summary: {
        leads: funnel.summary.totalLeads,
        orders: funnel.summary.totalOrders,
        adsSpent: funnel.summary.adsSpent,
        netProfit: funnel.summary.netProfit,
        roi: funnel.summary.roi,
        saleIssueAdGroups: funnel.summary.saleIssueAdGroups,
        pendingPlans: planStats.pendingPlans,
        approvedItemsWaitingApply: planStats.approvedItemsWaitingApply,
        pendingEvaluations: evaluationStats.pending,
      },
      profitSummary,
      creativeSummary: creativePerformance.summary,
      funnel: funnel.summary,
      planStats,
      evaluationStats,
      assistantQuality,
      readiness: {
        status: readinessStatus,
        dataReadinessStatus,
        providerExecutionEnabled: AI_MARKETING_PROVIDER_EXECUTION_ENABLED,
        executionMode: AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? 'approval_required_live_apply' : 'canonical_v2_or_dry_run_only',
        canReadRealMoney: true,
        canSyncLeadsFromSignals: true,
        canDetectSalesIssues: highQualityRows > 0 ? 'strong_for_high_quality_rows' : 'limited_until_leads_and_orders_are_mapped',
        canGeneratePlan: true,
        canApplyWithApproval: AI_MARKETING_PROVIDER_EXECUTION_ENABLED && dataReadinessStatus !== 'analysis_only_until_data_quality_improves',
        canDryRunPlan: true,
        canEvaluateAfterApply: AI_MARKETING_PROVIDER_EXECUTION_ENABLED,
        canTrackCreativePerformance: true,
        dataQuality: {
          totalRows: rows.length,
          highQualityRows,
          mediumQualityRows,
          lowQualityRows,
          minScore: rows.length ? Math.min(...rows.map((row) => row.dataQualityScore || 0)) : 0,
          avgScore: avgDataQualityScore,
        },
        decisionStandard: assistantQuality.decisionStandard,
        missing: [
          ...(AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? [] : [CANONICAL_ADS_EXECUTION_REQUIRED.message]),
          'Provider creative-level spend is still estimated from ad group spend until platform creative spend sync is added.',
          'Live provider validation is still required before unattended production automation.',
        ],
      },
    };
  }

  private buildMarketingAssistantQuality(params: {
    readinessStatus: string;
    totalRows: number;
    highQualityRows: number;
    mediumQualityRows: number;
    lowQualityRows: number;
    avgDataQualityScore: number;
  }) {
    let score = params.avgDataQualityScore;
    if (params.readinessStatus === 'production_ready_after_live_provider_validation') score = Math.min(92, score + 10);
    if (params.readinessStatus === 'pilot_ready_with_approval_required') score = Math.min(84, score + 5);
    if (!params.totalRows) score = 35;
    if (params.lowQualityRows > 0) score -= Math.min(25, params.lowQualityRows * 5);
    score = Math.max(0, Math.min(100, Math.round(score)));

    const blockers: string[] = [];
    if (!params.totalRows) blockers.push('No mapped ad group rows in the selected window.');
    if (params.lowQualityRows > 0) blockers.push(`${params.lowQualityRows} ad groups have low data quality.`);
    if (!AI_MARKETING_PROVIDER_EXECUTION_ENABLED) {
      blockers.push(CANONICAL_ADS_EXECUTION_REQUIRED.message);
    }
    if (params.readinessStatus !== 'production_ready_after_live_provider_validation') {
      blockers.push('Live provider validation is required before unattended automation.');
    }

    return {
      target: '9+',
      score,
      confidence: gradeAssistantConfidence(score),
      providerExecutionEnabled: AI_MARKETING_PROVIDER_EXECUTION_ENABLED,
      executionMode: AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? 'approval_required_live_apply' : 'canonical_v2_or_dry_run_only',
      directives: buildAiAssistantQualityDirectives('marketing'),
      decisionStandard: [
        'Increase budget: dataQualityScore >= 70, cashflow not blocked, then hand off to the canonical V2 validateOnly and approval workflow.',
        'Decrease budget: dataQualityScore >= 55, then hand off to the canonical V2 validateOnly and approval workflow.',
        'Pause ad group: dataQualityScore >= 45 unless ROI < 0 with enough evidence; live pause only runs through canonical V2.',
        'Sales follow-up task: allowed when lead volume is meaningful and conversion/follow-up is weak.',
        'Creative test: allowed when close rate is weak or creative library coverage is missing.',
      ],
      blockers,
      canApplyWithApproval: AI_MARKETING_PROVIDER_EXECUTION_ENABLED && params.readinessStatus !== 'analysis_only_until_data_quality_improves',
      canDryRunPlan: true,
    };
  }

  async getLeadFunnel(query: LeadFunnelQueryDto) {
    const window = this.resolveWindow(query);
    const metrics = await this.buildFunnelMetrics(window, {
      adGroupId: query.adGroupId,
      platform: query.platform,
    });

    const rows = [...metrics.values()].sort((a, b) => b.netProfit - a.netProfit);
    const adsSpent = rows.reduce((sum, row) => sum + row.adsSpent, 0);
    const netProfit = rows.reduce((sum, row) => sum + row.netProfit, 0);
    const totalLeads = rows.reduce((sum, row) => sum + row.totalLeads, 0);
    const totalOrders = rows.reduce((sum, row) => sum + row.totalOrders, 0);

    return {
      success: true,
      window,
      summary: {
        totalAdGroups: rows.length,
        totalLeads,
        totalOrders,
        adsSpent,
        netProfit,
        roi: adsSpent > 0 ? (netProfit / adsSpent) * 100 : 0,
        closeRate: totalLeads > 0 ? totalOrders / totalLeads : 0,
        saleIssueAdGroups: rows.filter((row) => row.saleIssue).length,
      },
      rows,
    };
  }

  async createCreative(currentUser: any, body: CreateCreativeAssetDto) {
    const status = (body.status as any) || 'draft';
    const creative = await this.creativeModel.findOneAndUpdate(
      { creativeId: body.creativeId },
      {
        $set: {
          ...body,
          status,
          adGroupIds: body.adGroupIds || [],
          approvedBy: ['approved', 'active'].includes(status) ? this.getUserLabel(currentUser) : undefined,
          approvedAt: ['approved', 'active'].includes(status) ? new Date() : undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return { success: true, creative };
  }

  async updateCreative(currentUser: any, creativeId: string, body: UpdateCreativeAssetDto) {
    const update: Record<string, any> = { ...body };
    if (body.status && ['approved', 'active'].includes(body.status)) {
      update.approvedBy = this.getUserLabel(currentUser);
      update.approvedAt = new Date();
    }

    const creative = await this.creativeModel.findOneAndUpdate({ creativeId }, { $set: update }, { new: true }).lean();
    if (!creative) throw new NotFoundException('Creative asset not found');
    return { success: true, creative };
  }

  async listCreatives(query: CreativePerformanceQueryDto) {
    const filter: Record<string, any> = {};
    if (query.creativeId) filter.creativeId = query.creativeId;
    if (query.platform) filter.platform = query.platform;
    if (query.adGroupId) filter.adGroupIds = query.adGroupId;

    const limit = query.limit || 50;
    const creatives = await this.creativeModel.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
    return { success: true, creatives, total: creatives.length };
  }

  async getCreativePerformance(query: CreativePerformanceQueryDto) {
    const window = this.resolveWindow(query);
    const creativeFilter: Record<string, any> = {};
    if (query.creativeId) creativeFilter.creativeId = query.creativeId;
    if (query.platform) creativeFilter.platform = query.platform;
    if (query.adGroupId) creativeFilter.adGroupIds = query.adGroupId;

    const limit = query.limit || 50;
    const creatives = await this.creativeModel.find(creativeFilter).limit(limit).lean();
    const creativeIds = creatives.map((creative) => creative.creativeId);
    const adGroupIds = [...new Set(creatives.flatMap((creative) => creative.adGroupIds || []))];

    const [leadRows, spendRows] = await Promise.all([
      creativeIds.length
        ? this.leadModel.aggregate([
            {
              $match: {
                creativeId: { $in: creativeIds },
                leadCreatedAt: { $gte: window.from, $lte: window.to },
                ...(query.adGroupId ? { adGroupId: query.adGroupId } : {}),
              },
            },
            {
              $group: {
                _id: '$creativeId',
                totalLeads: { $sum: 1 },
                contactedLeads: { $sum: { $cond: [{ $in: ['$status', ['contacted', 'qualified', 'quoted', 'won', 'lost']] }, 1, 0] } },
                wonLeads: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
                lostLeads: { $sum: { $cond: [{ $in: ['$status', ['lost', 'not_qualified']] }, 1, 0] } },
                revenue: { $sum: { $ifNull: ['$revenue', 0] } },
                grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
                netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
              },
            },
            { $project: { _id: 0, creativeId: '$_id', totalLeads: 1, contactedLeads: 1, wonLeads: 1, lostLeads: 1, revenue: 1, grossProfit: 1, netProfit: 1 } },
          ])
        : [],
      adGroupIds.length ? this.aggregateAdSpend(window, adGroupIds) : [],
    ]);

    const leadByCreative = new Map(leadRows.map((row: any) => [row.creativeId, row]));
    const spendByAdGroup = new Map(spendRows.map((row: any) => [row.adGroupId, row.adsSpent || 0]));
    const activeCreativeCountByAdGroup = new Map<string, number>();
    for (const adGroupId of adGroupIds) {
      const count = creatives.filter((creative) =>
        (creative.adGroupIds || []).includes(adGroupId) && ['approved', 'active'].includes(creative.status),
      ).length;
      activeCreativeCountByAdGroup.set(adGroupId, Math.max(1, count));
    }

    const rows = creatives.map((creative) => {
      const lead = leadByCreative.get(creative.creativeId) || {};
      const estimatedSpend = (creative.adGroupIds || []).reduce((sum, adGroupId) => {
        const spend = Number(spendByAdGroup.get(adGroupId) || 0);
        const creativeCount = activeCreativeCountByAdGroup.get(adGroupId) || 1;
        return sum + spend / creativeCount;
      }, 0);
      const netProfit = Number((lead as any).netProfit || 0);
      const totalLeads = Number((lead as any).totalLeads || 0);
      const wonLeads = Number((lead as any).wonLeads || 0);

      return {
        creative,
        creativeId: creative.creativeId,
        platform: creative.platform,
        name: creative.name,
        status: creative.status,
        adGroupIds: creative.adGroupIds || [],
        totalLeads,
        contactedLeads: Number((lead as any).contactedLeads || 0),
        wonLeads,
        lostLeads: Number((lead as any).lostLeads || 0),
        revenue: Number((lead as any).revenue || 0),
        grossProfit: Number((lead as any).grossProfit || 0),
        netProfit,
        estimatedSpend,
        roi: estimatedSpend > 0 ? (netProfit / estimatedSpend) * 100 : 0,
        closeRate: totalLeads > 0 ? wonLeads / totalLeads : 0,
        attributionMode: totalLeads > 0 ? 'direct_lead_creative_id' : 'library_only_no_lead_attribution',
      };
    });

    rows.sort((a, b) => b.netProfit - a.netProfit);

    return {
      success: true,
      window,
      summary: {
        totalCreatives: rows.length,
        creativesWithLeadAttribution: rows.filter((row) => row.totalLeads > 0).length,
        totalLeads: rows.reduce((sum, row) => sum + row.totalLeads, 0),
        totalWon: rows.reduce((sum, row) => sum + row.wonLeads, 0),
        totalEstimatedSpend: rows.reduce((sum, row) => sum + row.estimatedSpend, 0),
        totalNetProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
      },
      rows,
      notes: [
        'Best attribution uses MarketingLead.creativeId.',
        'Spend is estimated from ad group spend split across approved/active creatives until provider creative spend is synced.',
      ],
    };
  }

  async generatePlan(currentUser: any, body: GenerateAdsPlanDto) {
    const window = this.resolveWindow(body);
    const minRoi = body.minRoi ?? -1000000;
    const maxIncrease = (body.maxBudgetIncreasePercent ?? 20) / 100;
    const maxDecrease = (body.maxBudgetDecreasePercent ?? 30) / 100;
    const minLeadsForSaleIssue = body.minLeadsForSaleIssue ?? 10;

    const [suggestions, funnel] = await Promise.all([
      this.adGroupProfitReportService.getOptimalSpendSuggestions({
        lookbackDays: window.lookbackDays,
        minROI: minRoi,
        minProfit: -1000000000,
      }),
      this.buildFunnelMetrics(window),
    ]);

    const adGroups = await this.adGroupModel
      .find({ adGroupId: { $in: suggestions.map((s) => s.adGroupId) } })
      .lean();
    const adGroupById = new Map(adGroups.map((group) => [group.adGroupId, group]));

    const items: Partial<AdsActionPlanItem>[] = [];

    for (const suggestion of suggestions) {
      if (suggestion.scaleAction === 'maintain') continue;

      const adGroup = adGroupById.get(suggestion.adGroupId);
      const currentBudget = this.pickCurrentBudget(adGroup, suggestion.lastSpend);
      const targetBudget = this.clampBudgetChange(
        currentBudget,
        suggestion.appliedSpend,
        maxIncrease,
        maxDecrease,
        suggestion.scaleAction,
      );
      const actionType = this.mapScaleActionToPlanAction(suggestion.scaleAction);
      const funnelRow = funnel.get(suggestion.adGroupId);
      const dataQualityBlocker = this.validateDataQualityForProviderAction({
        actionType,
        beforeSnapshot: { funnel: funnelRow },
      } as unknown as AdsActionPlanItem);

      items.push({
        actionType,
        adGroupId: suggestion.adGroupId,
        adGroupName: suggestion.adGroupName,
        platform: adGroup?.platform,
        targetId: suggestion.adGroupId,
        currentValue: currentBudget,
        targetValue: actionType === 'pause_ad_group' ? 0 : targetBudget,
        expectedProfit: suggestion.expectedProfit,
        expectedRoi: suggestion.expectedROI,
        confidence: suggestion.confidence,
        riskLevel: suggestion.confidence >= 80 ? 'low' : suggestion.confidence >= 60 ? 'medium' : 'high',
        reason: suggestion.reason,
        requiresApproval: true,
        status: 'pending',
        beforeSnapshot: {
          suggestion,
          funnel: funnelRow,
          adGroup: this.summarizeAdGroup(adGroup),
        },
        metadata: {
          providerExecutionEnabled: AI_MARKETING_PROVIDER_EXECUTION_ENABLED,
          executionMode: AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? 'approval_required_live_apply' : 'canonical_v2_or_dry_run_only',
          eligibility: dataQualityBlocker ? 'review_only' : 'dry_run_ready',
          blockers: [
            ...(!AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? [CANONICAL_ADS_EXECUTION_REQUIRED.message] : []),
            ...(dataQualityBlocker ? [dataQualityBlocker] : []),
          ],
          dataQualityScore: funnelRow?.dataQualityScore,
          dataQualityGrade: funnelRow?.dataQualityGrade,
          dataQualityReasons: funnelRow?.dataQualityReasons || [],
        },
      });
    }

    for (const row of funnel.values()) {
      if (row.totalLeads < minLeadsForSaleIssue || !row.saleIssue) continue;
      items.push({
        actionType: 'sale_followup_task',
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        platform: row.platform,
        currentValue: row.unhandledLeads,
        targetValue: 0,
        confidence: 75,
        riskLevel: 'medium',
        reason: row.saleIssueReason || 'Lead volume is meaningful but follow-up/conversion is weak.',
        requiresApproval: true,
        status: 'pending',
        beforeSnapshot: { funnel: row },
        metadata: {
          task: 'Audit unhandled leads, response SLA, lead assignment, and sale follow-up notes.',
        },
      });
    }

    const creativeCounts = await this.getActiveCreativeCounts([...funnel.keys()]);
    let creativeTestItems = 0;
    for (const row of funnel.values()) {
      if (creativeTestItems >= 10) break;
      const activeCreativeCount = creativeCounts.get(row.adGroupId) || 0;
      const weakCreativeSignal = row.totalLeads >= minLeadsForSaleIssue && row.closeRate < 0.08;
      const missingCreativeCoverage = row.adsSpent > 0 && activeCreativeCount === 0;
      if (!weakCreativeSignal && !missingCreativeCoverage) continue;

      items.push({
        actionType: 'creative_test',
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        platform: row.platform,
        currentValue: activeCreativeCount,
        targetValue: Math.max(activeCreativeCount + 2, 3),
        confidence: missingCreativeCoverage ? 85 : 70,
        riskLevel: 'low',
        reason: missingCreativeCoverage
          ? 'Ad group has spend but no approved/active creative tracked in Creative Library.'
          : `Close rate ${(row.closeRate * 100).toFixed(1)}% is weak; create new hooks/assets before scaling budget.`,
        requiresApproval: true,
        status: 'pending',
        beforeSnapshot: { funnel: row, activeCreativeCount },
        metadata: {
          task: 'Create 2-3 new creative variants and map them to Creative Library with creativeId before next scale.',
        },
      });
      creativeTestItems += 1;
    }

    const funnelRows = [...funnel.values()];
    const assistantQuality = this.buildMarketingAssistantQuality({
      readinessStatus: funnelRows.length && funnelRows.every((row) => row.dataQualityScore >= 50)
        ? 'pilot_ready_with_approval_required'
        : 'analysis_only_until_data_quality_improves',
      totalRows: funnelRows.length,
      highQualityRows: funnelRows.filter((row) => row.dataQualityScore >= 75).length,
      mediumQualityRows: funnelRows.filter((row) => row.dataQualityScore >= 50 && row.dataQualityScore < 75).length,
      lowQualityRows: funnelRows.filter((row) => row.dataQualityScore < 50).length,
      avgDataQualityScore: funnelRows.length
        ? Math.round(funnelRows.reduce((sum, row) => sum + (row.dataQualityScore || 0), 0) / funnelRows.length)
        : 0,
    });

    const plan = await this.planModel.create({
      title: body.title || `AI Marketing plan ${this.formatDate(window.to)}`,
      status: items.length ? 'pending_approval' : 'draft',
      source: 'ai-marketing',
      mode: AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? 'approval_required' : 'suggest_only',
      dateWindow: window,
      summary: {
        generatedAt: new Date(),
        providerExecutionEnabled: AI_MARKETING_PROVIDER_EXECUTION_ENABLED,
        executionMode: AI_MARKETING_PROVIDER_EXECUTION_ENABLED ? 'approval_required_live_apply' : 'canonical_v2_or_dry_run_only',
        totalItems: items.length,
        budgetItems: items.filter((item) => this.isBudgetAction(item.actionType)).length,
        providerActionItems: items.filter((item) => ['increase_budget', 'decrease_budget', 'pause_ad_group', 'resume_ad_group'].includes(item.actionType || '')).length,
        saleFollowUpItems: items.filter((item) => item.actionType === 'sale_followup_task').length,
        creativeTestItems,
        dataSources: ['marketing_leads', 'creative_assets', 'chat_messages', 'pending_orders', 'ordertest2', 'advertising_costs'],
        assistantQuality,
      },
      items,
      createdBy: this.getUserLabel(currentUser),
    });

    return { success: true, plan };
  }

  async listPlans(query: ListPlansQueryDto) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;

    const limit = query.limit || 30;
    const plans = await this.planModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

    return { success: true, plans, total: plans.length };
  }

  async getPlan(planId: string) {
    const plan = await this.planModel.findById(planId).lean();
    if (!plan) throw new NotFoundException('Ads action plan not found');
    return { success: true, plan };
  }

  async approvePlanItem(currentUser: any, planId: string, itemId: string, body: ApprovePlanItemDto) {
    const plan = await this.planModel.findById(planId);
    if (!plan) throw new NotFoundException('Ads action plan not found');

    const item = this.findPlanItem(plan, itemId);
    if (!item) throw new NotFoundException('Plan item not found');

    if (['applied', 'failed', 'skipped'].includes(item.status)) {
      throw new BadRequestException(`Cannot change approval after item status is ${item.status}`);
    }

    if (body.confirmedTargetValue !== undefined) {
      item.targetValue = body.confirmedTargetValue;
    }

    if (body.approved) {
      item.status = 'approved';
      item.approvedAt = new Date();
      item.approvedBy = this.getUserLabel(currentUser);
      item.rejectionReason = undefined;
      if (body.note) item.metadata = { ...(item.metadata || {}), approvalNote: body.note };
    } else {
      item.status = 'rejected';
      item.rejectionReason = body.note || 'Rejected by approver';
    }

    this.refreshPlanStatus(plan);
    plan.markModified('items');
    await plan.save();

    return { success: true, plan };
  }

  async applyPlan(currentUser: any, planId: string, body: ApplyPlanDto) {
    const plan = await this.planModel.findById(planId);
    if (!plan) throw new NotFoundException('Ads action plan not found');

    const requestedItemIds = new Set(body.itemIds || []);
    const candidates = plan.items.filter((item: any) => {
      const id = String(item._id);
      return item.status === 'approved' && (!requestedItemIds.size || requestedItemIds.has(id));
    });

    if (!candidates.length) {
      return {
        success: true,
        message: 'No approved plan items to apply.',
        applied: 0,
        failed: 0,
        skipped: 0,
        logs: [],
      };
    }

    const logs: AdsActionExecutionLog[] = [];
    const evaluationDays = body.evaluationDays || 3;
    const dryRun = body.dryRun ?? ADS_SAFETY_CONFIG.dryRun;

    for (const item of candidates as any[]) {
      const log = await this.executePlanItem(plan, item, {
        dryRun,
        currentUser,
        evaluationDays,
      });
      logs.push(log as any);
    }

    this.refreshPlanStatus(plan);
    plan.markModified('items');
    await plan.save();

    return {
      success: true,
      applied: logs.filter((log: any) => log.status === 'success').length,
      dryRun: logs.filter((log: any) => log.status === 'dry_run').length,
      failed: logs.filter((log: any) => log.status === 'failed').length,
      skipped: logs.filter((log: any) => log.status === 'skipped').length,
      logs,
      plan,
    };
  }

  async listEvaluations(query: EvaluationQueryDto) {
    if (query.refresh) {
      await this.evaluateDueActions(false);
    }

    const filter: Record<string, any> = {};
    if (query.adGroupId) filter.adGroupId = query.adGroupId;
    if (query.status) filter.status = query.status;

    const limit = query.limit || 50;
    const evaluations = await this.evaluationModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const summary = {
      total: evaluations.length,
      pending: evaluations.filter((item) => item.status === 'pending').length,
      evaluated: evaluations.filter((item) => item.status === 'evaluated').length,
      improved: evaluations.filter((item) => item.verdict === 'improved').length,
      regressed: evaluations.filter((item) => item.verdict === 'regressed').length,
    };

    return { success: true, summary, evaluations };
  }

  async runEvaluations(force = false) {
    const result = await this.evaluateDueActions(force);
    return { success: true, ...result };
  }

  async runDirectAdGroupAction(currentUser: any, adGroupId: string, body: DirectAdGroupActionDto) {
    if (body.action === 'set_budget' && typeof body.targetBudget !== 'number') {
      throw new BadRequestException('targetBudget is required for set_budget action.');
    }

    const context = await this.budgetApplyService.resolveContext(adGroupId);
    if (!context.adGroup) throw new NotFoundException('Ad group not found');

    const currentBudget = this.pickCurrentBudget(context.adGroup, 0);
    const dryRun = body.dryRun ?? ADS_SAFETY_CONFIG.dryRun;
    const requiresApproval = ADS_SAFETY_CONFIG.requireApproval;
    const actionType: AdsActionType =
      body.action === 'pause'
        ? 'pause_ad_group'
        : body.action === 'resume'
          ? 'resume_ad_group'
          : body.targetBudget! >= currentBudget
            ? 'increase_budget'
            : 'decrease_budget';

    const plan = await this.planModel.create({
      title: `Direct ${body.action} ${adGroupId} ${this.formatDate(new Date())}`,
      status: requiresApproval ? 'pending_approval' : 'approved',
      source: 'ai-marketing-direct',
      mode: 'suggest_only',
      dateWindow: this.resolveWindow({ lookbackDays: 7 }),
      summary: {
        generatedAt: new Date(),
        directAction: true,
        action: body.action,
        dryRun,
      },
      items: [
        {
          actionType,
          adGroupId,
          adGroupName: (context.adGroup as any).name,
          platform: (context.adGroup as any).platform,
          targetId: adGroupId,
          currentValue: currentBudget,
          targetValue: body.action === 'set_budget' ? Math.round(body.targetBudget || 0) : currentBudget,
          confidence: 100,
          riskLevel: 'medium',
          reason: body.note || `Direct ${body.action} requested by manager.`,
          requiresApproval: true,
          status: requiresApproval ? 'pending' : 'approved',
          ...(requiresApproval
            ? {}
            : {
                approvedBy: this.getUserLabel(currentUser),
                approvedAt: new Date(),
              }),
          beforeSnapshot: {
            adGroup: this.summarizeAdGroup(context.adGroup as any),
          },
          metadata: {
            directAction: true,
            note: body.note,
          },
        },
      ],
      createdBy: this.getUserLabel(currentUser),
      notes: body.note,
    });

    const hydratedPlan = await this.planModel.findById(plan._id);
    if (!hydratedPlan || !hydratedPlan.items.length) throw new NotFoundException('Direct action plan could not be loaded');

    if (requiresApproval) {
      return {
        success: true,
        dryRun,
        status: 'pending_approval',
        plan: hydratedPlan,
      };
    }

    const log = await this.executePlanItem(hydratedPlan, hydratedPlan.items[0], {
      dryRun,
      currentUser,
      evaluationDays: 3,
    });
    this.refreshPlanStatus(hydratedPlan);
    hydratedPlan.markModified('items');
    await hydratedPlan.save();

    return {
      success: true,
      dryRun,
      status: log.status,
      log,
      plan: hydratedPlan,
    };
  }

  private async executePlanItem(
    plan: AdsActionPlanDocument,
    item: AdsActionPlanItem,
    options: { dryRun: boolean; currentUser: any; evaluationDays: number },
  ) {
    const itemId = (item as any)._id as Types.ObjectId;
    const beforeSnapshot = await this.captureActionSnapshot(item.adGroupId);
    let status: AdsExecutionStatus = options.dryRun ? 'dry_run' : 'success';
    let errorMessage: string | undefined;
    let providerResponse: Record<string, any> | undefined;

    if (this.isBudgetAction(item.actionType)) {
      if (typeof item.targetValue !== 'number' || item.targetValue < 0) {
        status = 'failed';
        errorMessage = 'Budget action is missing a valid targetValue.';
      } else {
        const safetyError = this.validateBudgetSafety(item);
        if (safetyError) {
          status = 'failed';
          errorMessage = safetyError;
        }
      }
      if (status !== 'failed') {
        const qualityError = this.validateDataQualityForProviderAction(item);
        if (qualityError) {
          status = 'failed';
          errorMessage = qualityError;
        }
      }

      if (status !== 'failed' && !options.dryRun) {
        status = 'failed';
        errorMessage = CANONICAL_ADS_EXECUTION_REQUIRED.message;
        providerResponse = {
          applied: false,
          providerExecutionEnabled: false,
          code: CANONICAL_ADS_EXECUTION_REQUIRED.code,
        };
      } else if (status !== 'failed' && options.dryRun) {
        providerResponse = { applied: false, dryRun: true };
      }
    } else if (['pause_ad_group', 'resume_ad_group'].includes(item.actionType)) {
      const qualityError = this.validateDataQualityForProviderAction(item);
      if (qualityError) {
        status = 'failed';
        errorMessage = qualityError;
      }

      if (status !== 'failed' && !options.dryRun) {
        status = 'failed';
        errorMessage = CANONICAL_ADS_EXECUTION_REQUIRED.message;
        providerResponse = {
          applied: false,
          providerExecutionEnabled: false,
          code: CANONICAL_ADS_EXECUTION_REQUIRED.code,
          actionType: item.actionType,
        };
      } else if (status !== 'failed' && options.dryRun) {
        providerResponse = { applied: false, dryRun: true, actionType: item.actionType };
      }
    } else {
      status = 'skipped';
      providerResponse = {
        applied: false,
        reason: 'Internal/non-provider task. Keep it in plan history for manager follow-up.',
      };
    }

    const afterSnapshot = await this.captureActionSnapshot(item.adGroupId);
    const executedAt = new Date();
    const evaluationDueAt = this.addDays(executedAt, options.evaluationDays);
    const log = await this.executionLogModel.create({
      planId: plan._id,
      itemId,
      actionType: item.actionType,
      adGroupId: item.adGroupId,
      platform: item.platform,
      currentValue: item.currentValue,
      targetValue: item.targetValue,
      status,
      dryRun: options.dryRun,
      approvedBy: item.approvedBy || this.getUserLabel(options.currentUser),
      executedAt,
      beforeSnapshot,
      afterSnapshot,
      requestPayload: {
        actionType: item.actionType,
        adGroupId: item.adGroupId,
        targetValue: item.targetValue,
      },
      providerResponse: redactSecrets(providerResponse),
      errorMessage: errorMessage ? redactSecretString(errorMessage) : undefined,
      evaluationDueAt,
    });

    item.executionLogId = log._id;
    item.status =
      status === 'success'
        ? 'applied'
        : status === 'dry_run'
          ? 'approved'
          : status === 'skipped'
            ? 'skipped'
            : 'failed';

    if (status === 'success' && item.adGroupId) {
      const evaluation = await this.createEvaluationForLog(log, options.evaluationDays);
      item.evaluationId = evaluation._id;
    }

    return log;
  }

  private async createEvaluationForLog(log: AdsActionExecutionLogDocument, evaluationDays: number) {
    const baselineTo = log.executedAt;
    const baselineFrom = this.addDays(baselineTo, -evaluationDays);
    const evaluationFrom = log.executedAt;
    const evaluationTo = this.addDays(evaluationFrom, evaluationDays);

    return this.evaluationModel.create({
      executionLogId: log._id,
      planId: log.planId,
      itemId: log.itemId,
      adGroupId: log.adGroupId,
      platform: log.platform,
      baselineWindow: { from: baselineFrom, to: baselineTo },
      evaluationWindow: { from: evaluationFrom, to: evaluationTo },
      status: 'pending',
    });
  }

  private async evaluateDueActions(force: boolean) {
    const now = new Date();
    const filter: Record<string, any> = { status: 'pending' };
    if (!force) filter['evaluationWindow.to'] = { $lte: now };

    const evaluations = await this.evaluationModel.find(filter).limit(100);
    let evaluated = 0;
    let insufficientData = 0;

    for (const evaluation of evaluations) {
      if (!evaluation.adGroupId) {
        evaluation.status = 'insufficient_data';
        evaluation.insight = 'Missing adGroupId on evaluation.';
        evaluation.evaluatedAt = now;
        await evaluation.save();
        insufficientData += 1;
        continue;
      }

      const beforeMetrics = await this.getMetricsForAdGroup(
        evaluation.adGroupId,
        evaluation.baselineWindow.from,
        evaluation.baselineWindow.to,
      );
      const afterMetrics = await this.getMetricsForAdGroup(
        evaluation.adGroupId,
        evaluation.evaluationWindow.from,
        evaluation.evaluationWindow.to,
      );

      if (afterMetrics.adsSpent <= 0 && afterMetrics.totalOrders <= 0 && afterMetrics.totalLeads <= 0) {
        evaluation.status = 'insufficient_data';
        evaluation.beforeMetrics = beforeMetrics as any;
        evaluation.afterMetrics = afterMetrics as any;
        evaluation.insight = 'No spend, lead, or order data in evaluation window.';
        evaluation.evaluatedAt = now;
        await evaluation.save();
        insufficientData += 1;
        continue;
      }

      const delta = this.calculateDelta(beforeMetrics, afterMetrics);
      const verdict = this.pickEvaluationVerdict(delta);
      evaluation.status = 'evaluated';
      evaluation.beforeMetrics = beforeMetrics as any;
      evaluation.afterMetrics = afterMetrics as any;
      evaluation.delta = delta;
      evaluation.verdict = verdict;
      evaluation.insight = this.buildEvaluationInsight(verdict, delta);
      evaluation.evaluatedAt = now;
      await evaluation.save();
      evaluated += 1;
    }

    return { checked: evaluations.length, evaluated, insufficientData };
  }

  private async buildFunnelMetrics(
    window: DateWindow,
    filters?: { adGroupId?: string; platform?: string },
  ): Promise<Map<string, AdGroupMarketingMetrics>> {
    const adGroups = await this.adGroupModel
      .find({
        ...(filters?.adGroupId ? { adGroupId: filters.adGroupId } : {}),
        ...(filters?.platform ? { platform: filters.platform } : {}),
      })
      .lean();
    const adGroupById = new Map(adGroups.map((group) => [group.adGroupId, group]));
    const adGroupFilter = filters?.adGroupId ? [filters.adGroupId] : adGroups.map((group) => group.adGroupId);

    const [leadRows, chatRows, pendingRows, orderRows, spendRows] = await Promise.all([
      this.aggregateMarketingLeads(window, adGroupFilter),
      this.aggregateConversationLeads(window, adGroupFilter),
      this.aggregatePendingOrders(window, adGroupFilter),
      this.aggregateOrders(window, adGroupFilter),
      this.aggregateAdSpend(window, adGroupFilter),
    ]);

    const keys = new Set<string>();
    for (const row of [...leadRows, ...chatRows, ...pendingRows, ...orderRows, ...spendRows]) {
      if (row.adGroupId) keys.add(row.adGroupId);
    }
    for (const id of adGroupFilter) {
      if (id) keys.add(id);
    }

    const metrics = new Map<string, AdGroupMarketingMetrics>();
    for (const adGroupId of keys) {
      const adGroup = adGroupById.get(adGroupId);
      metrics.set(adGroupId, {
        adGroupId,
        adGroupName: adGroup?.name,
        platform: adGroup?.platform,
        assignedEmployeeId: adGroup?.assignedEmployeeId ? String(adGroup.assignedEmployeeId) : undefined,
        adsSpent: 0,
        explicitLeads: 0,
        inferredConversationLeads: 0,
        totalLeads: 0,
        contactedLeads: 0,
        qualifiedLeads: 0,
        wonLeads: 0,
        lostLeads: 0,
        noResponseLeads: 0,
        unhandledLeads: 0,
        pendingOrders: 0,
        totalOrders: 0,
        successOrders: 0,
        returnOrders: 0,
        revenue: 0,
        grossProfit: 0,
        netProfit: 0,
        roi: 0,
        closeRate: 0,
        costPerLead: 0,
        costPerOrder: 0,
        saleIssue: false,
        dataQuality: 'orders_only',
        dataQualityScore: 0,
        dataQualityGrade: 'low',
        dataQualityReasons: [],
      });
    }

    this.mergeRows(metrics, leadRows, (metric, row) => {
      metric.explicitLeads = row.totalLeads || 0;
      metric.contactedLeads = row.contactedLeads || 0;
      metric.qualifiedLeads = row.qualifiedLeads || 0;
      metric.wonLeads = row.wonLeads || 0;
      metric.lostLeads = row.lostLeads || 0;
      metric.noResponseLeads = row.noResponseLeads || 0;
      metric.unhandledLeads = row.unhandledLeads || 0;
    });
    this.mergeRows(metrics, chatRows, (metric, row) => {
      metric.inferredConversationLeads = row.inferredConversationLeads || 0;
    });
    this.mergeRows(metrics, pendingRows, (metric, row) => {
      metric.pendingOrders = row.pendingOrders || 0;
    });
    this.mergeRows(metrics, orderRows, (metric, row) => {
      metric.totalOrders = row.totalOrders || 0;
      metric.successOrders = row.successOrders || 0;
      metric.returnOrders = row.returnOrders || 0;
      metric.revenue = row.revenue || 0;
      metric.grossProfit = row.grossProfit || 0;
      metric.netProfit = row.netProfit || 0;
    });
    this.mergeRows(metrics, spendRows, (metric, row) => {
      metric.adsSpent = row.adsSpent || 0;
    });

    for (const metric of metrics.values()) {
      metric.totalLeads =
        metric.explicitLeads > 0 ? metric.explicitLeads : metric.inferredConversationLeads + metric.pendingOrders;
      metric.dataQuality =
        metric.explicitLeads > 0
          ? 'explicit_leads'
          : metric.inferredConversationLeads > 0
            ? 'inferred_from_chat'
            : 'orders_only';
      const quality = this.scoreDataQuality(metric);
      metric.dataQualityScore = quality.score;
      metric.dataQualityGrade = quality.grade;
      metric.dataQualityReasons = quality.reasons;
      metric.roi = metric.adsSpent > 0 ? (metric.netProfit / metric.adsSpent) * 100 : 0;
      metric.closeRate = metric.totalLeads > 0 ? metric.totalOrders / metric.totalLeads : 0;
      metric.costPerLead = metric.totalLeads > 0 ? metric.adsSpent / metric.totalLeads : 0;
      metric.costPerOrder = metric.totalOrders > 0 ? metric.adsSpent / metric.totalOrders : 0;

      const inferredUnhandled =
        metric.explicitLeads > 0
          ? metric.unhandledLeads
          : Math.max(0, metric.inferredConversationLeads - metric.pendingOrders - metric.totalOrders);
      metric.unhandledLeads = inferredUnhandled;

      const weakCloseRate = metric.totalLeads >= 10 && metric.closeRate < 0.05;
      const manyUnhandled = inferredUnhandled >= Math.max(5, Math.ceil(metric.totalLeads * 0.4));
      metric.saleIssue = weakCloseRate || manyUnhandled;
      if (metric.saleIssue) {
        metric.saleIssueReason = manyUnhandled
          ? `${inferredUnhandled} leads/conversations have no clear follow-up or order signal.`
          : `Close rate ${(metric.closeRate * 100).toFixed(1)}% is weak for ${metric.totalLeads} leads.`;
      }
    }

    return metrics;
  }

  private async aggregateMarketingLeads(window: DateWindow, adGroupIds: string[]) {
    return this.leadModel.aggregate([
      {
        $match: {
          ...this.optionalAdGroupMatch(adGroupIds),
          leadCreatedAt: { $gte: window.from, $lte: window.to },
        },
      },
      {
        $group: {
          _id: '$adGroupId',
          totalLeads: { $sum: 1 },
          contactedLeads: { $sum: { $cond: [{ $in: ['$status', ['contacted', 'qualified', 'quoted', 'won', 'lost']] }, 1, 0] } },
          qualifiedLeads: { $sum: { $cond: [{ $in: ['$status', ['qualified', 'quoted', 'won']] }, 1, 0] } },
          wonLeads: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
          lostLeads: { $sum: { $cond: [{ $in: ['$status', ['lost', 'not_qualified']] }, 1, 0] } },
          noResponseLeads: { $sum: { $cond: [{ $eq: ['$status', 'no_response'] }, 1, 0] } },
          unhandledLeads: { $sum: { $cond: [{ $in: ['$status', ['new', 'no_response']] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, adGroupId: '$_id', totalLeads: 1, contactedLeads: 1, qualifiedLeads: 1, wonLeads: 1, lostLeads: 1, noResponseLeads: 1, unhandledLeads: 1 } },
    ]);
  }

  private async aggregateConversationLeads(window: DateWindow, adGroupIds: string[]) {
    return this.chatMessageModel.aggregate([
      {
        $match: {
          ...this.requiredAdGroupMatch(adGroupIds),
          direction: 'in',
          receivedAt: { $gte: window.from, $lte: window.to },
        },
      },
      { $group: { _id: { adGroupId: '$adGroupId', senderPsid: '$senderPsid' } } },
      { $group: { _id: '$_id.adGroupId', inferredConversationLeads: { $sum: 1 } } },
      { $project: { _id: 0, adGroupId: '$_id', inferredConversationLeads: 1 } },
    ]);
  }

  private async aggregatePendingOrders(window: DateWindow, adGroupIds: string[]) {
    return this.pendingOrderModel.aggregate([
      {
        $match: {
          ...this.requiredAdGroupMatch(adGroupIds),
          capturedAt: { $gte: window.from, $lte: window.to },
        },
      },
      { $group: { _id: '$adGroupId', pendingOrders: { $sum: 1 } } },
      { $project: { _id: 0, adGroupId: '$_id', pendingOrders: 1 } },
    ]);
  }

  private async aggregateOrders(window: DateWindow, adGroupIds: string[]) {
    return this.orderModel.aggregate([
      {
        $match: {
          ...this.requiredAdGroupMatch(adGroupIds),
          isActive: { $ne: false },
          ...this.buildOrderDateMatch(window.from, window.to),
        },
      },
      {
        $group: {
          _id: '$adGroupId',
          totalOrders: { $sum: 1 },
          successOrders: { $sum: { $cond: [{ $in: ['$orderStatus', this.successStatuses] }, 1, 0] } },
          returnOrders: { $sum: { $cond: [{ $in: ['$orderStatus', this.returnStatuses] }, 1, 0] } },
          revenue: { $sum: { $ifNull: ['$codCollectedBySupplier', 0] } },
          grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
          netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
        },
      },
      { $project: { _id: 0, adGroupId: '$_id', totalOrders: 1, successOrders: 1, returnOrders: 1, revenue: 1, grossProfit: 1, netProfit: 1 } },
    ]);
  }

  private async aggregateAdSpend(window: DateWindow, adGroupIds: string[]) {
    return this.advertisingCostModel.aggregate([
      {
        $match: {
          ...this.requiredAdGroupMatch(adGroupIds),
          date: { $gte: window.from, $lte: window.to },
        },
      },
      { $group: { _id: '$adGroupId', adsSpent: { $sum: { $ifNull: ['$spentAmount', 0] } } } },
      { $project: { _id: 0, adGroupId: '$_id', adsSpent: 1 } },
    ]);
  }

  private async getMetricsForAdGroup(adGroupId: string, from: Date, to: Date) {
    const window = { from, to, lookbackDays: Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000)) };
    const metrics = await this.buildFunnelMetrics(window, { adGroupId });
    return metrics.get(adGroupId) || {
      adGroupId,
      adsSpent: 0,
      totalLeads: 0,
      totalOrders: 0,
      successOrders: 0,
      revenue: 0,
      netProfit: 0,
      roi: 0,
      closeRate: 0,
    };
  }

  private async captureActionSnapshot(adGroupId?: string) {
    if (!adGroupId) return {};
    const context = await this.budgetApplyService.resolveContext(adGroupId);
    const metrics = await this.getMetricsForAdGroup(adGroupId, this.addDays(new Date(), -7), new Date());
    return {
      adGroup: this.summarizeAdGroup(context.adGroup as any),
      adAccount: context.adAccount
        ? {
            id: (context.adAccount as any)._id,
            accountId: (context.adAccount as any).accountId,
            name: (context.adAccount as any).name,
            accountType: (context.adAccount as any).accountType,
          }
        : null,
      last7Days: metrics,
    };
  }

  private async getPlanStats(window: DateWindow) {
    const plans = await this.planModel
      .find({ createdAt: { $gte: window.from, $lte: window.to } })
      .select({ status: 1, items: 1 })
      .lean();

    let approvedItemsWaitingApply = 0;
    let pendingItems = 0;
    for (const plan of plans) {
      for (const item of plan.items || []) {
        if (item.status === 'approved') approvedItemsWaitingApply += 1;
        if (item.status === 'pending') pendingItems += 1;
      }
    }

    return {
      totalPlans: plans.length,
      pendingPlans: plans.filter((plan) => ['draft', 'pending_approval', 'partially_approved'].includes(plan.status)).length,
      approvedItemsWaitingApply,
      pendingItems,
    };
  }

  private async getEvaluationStats() {
    const rows = await this.evaluationModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byStatus = new Map(rows.map((row) => [row._id, row.count]));
    return {
      pending: byStatus.get('pending') || 0,
      evaluated: byStatus.get('evaluated') || 0,
      insufficientData: byStatus.get('insufficient_data') || 0,
    };
  }

  private async getActiveCreativeCounts(adGroupIds: string[]) {
    const ids = adGroupIds.filter(Boolean);
    const rows = ids.length
      ? await this.creativeModel.aggregate([
          { $match: { adGroupIds: { $in: ids }, status: { $in: ['approved', 'active'] } } },
          { $unwind: '$adGroupIds' },
          { $match: { adGroupIds: { $in: ids } } },
          { $group: { _id: '$adGroupIds', count: { $sum: 1 } } },
        ])
      : [];
    return new Map(rows.map((row: any) => [row._id, row.count || 0]));
  }

  private scoreDataQuality(metric: AdGroupMarketingMetrics): {
    score: number;
    grade: 'high' | 'medium' | 'low';
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    if (metric.explicitLeads > 0) {
      score += 30;
    } else if (metric.inferredConversationLeads > 0) {
      score += 18;
      reasons.push('Lead count is inferred from chat conversations.');
    } else {
      reasons.push('No explicit lead or conversation lead signal.');
    }

    if (metric.adsSpent > 0) {
      score += 25;
    } else {
      reasons.push('No synced ad spend in the selected window.');
    }

    if (metric.totalOrders > 0) {
      score += 25;
    } else if (metric.pendingOrders > 0) {
      score += 10;
      reasons.push('Only pending order signal is available.');
    } else {
      reasons.push('No order signal in the selected window.');
    }

    if (metric.platform && metric.adGroupName) {
      score += 10;
    } else {
      reasons.push('Ad group metadata is incomplete.');
    }

    if (metric.totalLeads >= 10 || metric.totalOrders >= 3) {
      score += 10;
    } else {
      reasons.push('Sample size is small.');
    }

    const normalizedScore = Math.min(100, score);
    const grade = normalizedScore >= 75 ? 'high' : normalizedScore >= 50 ? 'medium' : 'low';
    return { score: normalizedScore, grade, reasons };
  }

  private mergeRows(
    metrics: Map<string, AdGroupMarketingMetrics>,
    rows: any[],
    apply: (metric: AdGroupMarketingMetrics, row: any) => void,
  ) {
    for (const row of rows) {
      if (!row.adGroupId) continue;
      const metric = metrics.get(row.adGroupId);
      if (!metric) continue;
      apply(metric, row);
    }
  }

  private optionalAdGroupMatch(adGroupIds: string[]) {
    const ids = adGroupIds.filter(Boolean);
    return ids.length ? { adGroupId: { $in: ids } } : {};
  }

  private requiredAdGroupMatch(adGroupIds: string[]) {
    const ids = adGroupIds.filter(Boolean);
    return ids.length
      ? { adGroupId: { $in: ids } }
      : { adGroupId: { $exists: true, $nin: [null, ''] } };
  }

  private buildOrderDateMatch(from: Date, to: Date) {
    return {
      $or: [
        { orderDate: { $gte: from, $lte: to } },
        { orderDate: { $exists: false }, createdAt: { $gte: from, $lte: to } },
        { orderDate: null, createdAt: { $gte: from, $lte: to } },
      ],
    };
  }

  private resolveWindow(query?: { from?: string; to?: string; lookbackDays?: number }): DateWindow {
    const to = query?.to ? new Date(query.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const lookbackDays = query?.lookbackDays || 7;
    const from = query?.from ? new Date(query.from) : this.addDays(to, -(lookbackDays - 1));
    from.setHours(0, 0, 0, 0);
    return { from, to, lookbackDays };
  }

  private pickCurrentBudget(adGroup: any, fallback: number) {
    const current = Number(adGroup?.dailyBudget || 0);
    if (Number.isFinite(current) && current > 0) return current;
    if (Number.isFinite(fallback) && fallback > 0) return Math.round(fallback);
    return 0;
  }

  private clampBudgetChange(
    currentBudget: number,
    targetBudget: number,
    maxIncrease: number,
    maxDecrease: number,
    scaleAction: string,
  ) {
    if (!Number.isFinite(targetBudget)) return currentBudget;
    if (currentBudget <= 0) return Math.max(0, Math.round(targetBudget));
    if (scaleAction === 'increase') {
      return Math.round(Math.min(targetBudget, currentBudget * (1 + maxIncrease)));
    }
    if (scaleAction === 'decrease') {
      return Math.round(Math.max(targetBudget, currentBudget * (1 - maxDecrease)));
    }
    return Math.max(0, Math.round(targetBudget));
  }

  private validateBudgetSafety(item: AdsActionPlanItem): string | undefined {
    const target = Number(item.targetValue || 0);
    const current = Number(item.currentValue || 0);
    const maxDailyBudget = 10_000_000;
    const minActiveBudget = 50_000;

    if (!Number.isFinite(target) || target < 0) {
      return 'Target budget is invalid.';
    }
    if (target > maxDailyBudget) {
      return `Target budget ${Math.round(target)} exceeds safety cap ${maxDailyBudget}.`;
    }
    if (item.actionType === 'pause_ad_group') {
      return target === 0 ? undefined : 'Pause action must set target budget to 0.';
    }
    if (target > 0 && target < minActiveBudget) {
      return `Target budget ${Math.round(target)} is below minimum active budget ${minActiveBudget}.`;
    }
    if (current > 0 && item.actionType === 'increase_budget' && target > current * 1.2 + 1) {
      return 'Increase exceeds +20% safety cap. Generate a new staged plan instead.';
    }
    if (current > 0 && item.actionType === 'decrease_budget' && target < current * 0.7 - 1) {
      return 'Decrease exceeds -30% safety cap. Use pause action or staged decrease.';
    }
    return undefined;
  }

  private validateDataQualityForProviderAction(item: AdsActionPlanItem): string | undefined {
    if (item.actionType === 'resume_ad_group') return undefined;

    const funnel = (item.beforeSnapshot as any)?.funnel;
    const score = Number(funnel?.dataQualityScore);
    if (!Number.isFinite(score)) {
      return undefined;
    }

    const actionThresholds: Record<string, number> = {
      increase_budget: 70,
      decrease_budget: 55,
      pause_ad_group: 45,
    };
    const threshold = actionThresholds[item.actionType] ?? 50;

    if (item.actionType === 'pause_ad_group') {
      const roi = Number(funnel?.roi || 0);
      const totalOrders = Number(funnel?.totalOrders || 0);
      const adsSpent = Number(funnel?.adsSpent || 0);
      if (roi < 0 && totalOrders >= 3 && adsSpent > 0) return undefined;
    }

    if (score < threshold) {
      return `Data quality score ${score} is below ${threshold} for ${item.actionType}. Sync/map leads, orders, and ad spend before applying.`;
    }
    return undefined;
  }

  private mapScaleActionToPlanAction(scaleAction: string): AdsActionType {
    if (scaleAction === 'increase') return 'increase_budget';
    if (scaleAction === 'decrease') return 'decrease_budget';
    if (scaleAction === 'kill') return 'pause_ad_group';
    return 'decrease_budget';
  }

  private isBudgetAction(actionType?: string): actionType is AdsActionType {
    return ['increase_budget', 'decrease_budget'].includes(actionType || '');
  }

  private findPlanItem(plan: AdsActionPlanDocument, itemId: string): AdsActionPlanItem | undefined {
    return (plan.items as any[]).find((item) => String(item._id) === itemId);
  }

  private refreshPlanStatus(plan: AdsActionPlanDocument) {
    const statuses = (plan.items || []).map((item) => item.status);
    if (!statuses.length) {
      plan.status = 'draft';
      return;
    }
    if (statuses.every((status) => status === 'rejected')) {
      plan.status = 'rejected';
      return;
    }
    if (statuses.every((status) => ['applied', 'skipped'].includes(status))) {
      plan.status = 'applied';
      return;
    }
    if (statuses.some((status) => ['applied', 'failed', 'skipped'].includes(status))) {
      plan.status = 'partially_applied';
      return;
    }
    if (statuses.every((status) => ['approved', 'rejected'].includes(status))) {
      plan.status = statuses.some((status) => status === 'approved') ? 'approved' : 'rejected';
      return;
    }
    if (statuses.some((status) => status === 'approved')) {
      plan.status = 'partially_approved';
      return;
    }
    plan.status = 'pending_approval';
  }

  private summarizeAdGroup(adGroup: any) {
    if (!adGroup) return null;
    return {
      id: adGroup._id,
      adGroupId: adGroup.adGroupId,
      name: adGroup.name,
      platform: adGroup.platform,
      dailyBudget: adGroup.dailyBudget,
      remoteStatus: adGroup.remoteStatus,
      effectiveStatus: adGroup.effectiveStatus,
      adAccountId: adGroup.adAccountId,
      assignedEmployeeId: adGroup.assignedEmployeeId,
    };
  }

  private calculateDelta(beforeMetrics: any, afterMetrics: any) {
    const fields = ['adsSpent', 'totalLeads', 'totalOrders', 'successOrders', 'revenue', 'netProfit', 'roi', 'closeRate'];
    const delta: Record<string, any> = {};
    for (const field of fields) {
      const before = Number(beforeMetrics[field] || 0);
      const after = Number(afterMetrics[field] || 0);
      delta[field] = {
        before,
        after,
        absolute: after - before,
        percent: before !== 0 ? ((after - before) / Math.abs(before)) * 100 : after > 0 ? 100 : 0,
      };
    }
    return delta;
  }

  private pickEvaluationVerdict(delta: Record<string, any>): 'improved' | 'regressed' | 'mixed' | 'unchanged' {
    const profitDelta = delta.netProfit?.absolute || 0;
    const roiDelta = delta.roi?.absolute || 0;
    const ordersDelta = delta.totalOrders?.absolute || 0;

    if (Math.abs(profitDelta) < 1 && Math.abs(roiDelta) < 1 && ordersDelta === 0) return 'unchanged';
    if (profitDelta > 0 && roiDelta >= 0) return 'improved';
    if (profitDelta < 0 && roiDelta < 0) return 'regressed';
    return 'mixed';
  }

  private buildEvaluationInsight(verdict: string, delta: Record<string, any>) {
    const profitDelta = Math.round(delta.netProfit?.absolute || 0);
    const roiDelta = Number(delta.roi?.absolute || 0).toFixed(1);
    const orderDelta = Math.round(delta.totalOrders?.absolute || 0);
    return `Verdict ${verdict}: net profit delta ${profitDelta}, ROI delta ${roiDelta} points, order delta ${orderDelta}.`;
  }

  private getUserLabel(user: any) {
    return String(user?.email || user?.username || user?.fullName || user?._id || user?.id || 'system');
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
